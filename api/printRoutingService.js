const { appPool } = require('../database/appConnection');
const { printer: ThermalPrinter, types: PrinterTypes } = require('node-thermal-printer');

const STATION_TYPES = {
  CASHIER: 'cashier',
  EXPO: 'expo',
  KITCHEN: 'kitchen'
};

const DEFAULT_PRINT_CONFIG = {
  paper_width_mm: 80,
  font_family: 'A',
  font_scale: 1,
  header_font_scale: 2,
  chars_per_line: 48,
  print_copies: 1,
  cut_paper: true,
  open_cash_drawer: false,
  printer_timeout_ms: 7000
};

function formatOrderTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

function getOrderHeader(order) {
  return {
    tableNo: order.table_no,
    guestCount: order.guest_count,
    orderTime: formatOrderTime(order.created_at ? new Date(order.created_at) : new Date())
  };
}

async function getPrintConfig(connection = null) {
  const executor = connection || appPool;
  const [rows] = await executor.query(
    `SELECT setting_key, setting_value
     FROM pos_print_settings`
  );
  const cfg = { ...DEFAULT_PRINT_CONFIG };
  rows.forEach((row) => {
    const key = row.setting_key;
    const value = row.setting_value;
    if (value === null || value === undefined) return;
    if (['cut_paper', 'open_cash_drawer'].includes(key)) {
      cfg[key] = ['1', 'true', 'yes'].includes(String(value).toLowerCase());
      return;
    }
    if (['paper_width_mm', 'font_scale', 'header_font_scale', 'chars_per_line', 'print_copies', 'printer_timeout_ms'].includes(key)) {
      cfg[key] = Number(value);
      return;
    }
    cfg[key] = value;
  });
  return cfg;
}

function createPrinterClient(station, printConfig) {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: `tcp://${station.printer_ip}:${station.printer_port || 9100}`,
    options: {
      timeout: Number(printConfig?.printer_timeout_ms || DEFAULT_PRINT_CONFIG.printer_timeout_ms)
    }
  });
}

function applyFontScale(printer, scale = 1) {
  const safeScale = Math.min(3, Math.max(1, Number(scale || 1)));
  if (safeScale >= 2) {
    if (typeof printer.setTextDoubleWidth === 'function') printer.setTextDoubleWidth();
    if (typeof printer.setTextDoubleHeight === 'function') printer.setTextDoubleHeight();
  } else if (typeof printer.setTextNormal === 'function') {
    printer.setTextNormal();
  }
}

function applyFontFamily(printer, family = 'A') {
  const normalized = String(family || 'A').toUpperCase();
  if (normalized === 'B' && typeof printer.setTypeFontB === 'function') {
    printer.setTypeFontB();
    return;
  }
  if (typeof printer.setTypeFontA === 'function') {
    printer.setTypeFontA();
  }
}

function fitText(text, maxChars) {
  const value = String(text || '');
  const limit = Number(maxChars || 48);
  if (!Number.isFinite(limit) || limit < 10) return value;
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function renderHeader(printer, stationName, header, printConfig) {
  printer.clear();
  applyFontFamily(printer, printConfig.font_family || 'A');
  printer.alignCenter();
  printer.bold(true);
  printer.println(stationName);
  printer.bold(false);
  printer.drawLine();

  applyFontScale(printer, printConfig.header_font_scale || 2);
  printer.println(`طاولة: ${header.tableNo}`);
  if (typeof printer.setTextNormal === 'function') printer.setTextNormal();

  applyFontScale(printer, printConfig.font_scale || 1);
  printer.println(`الأشخاص: ${header.guestCount}`);
  printer.println(`الوقت: ${header.orderTime}`);
  printer.drawLine();
  printer.alignLeft();
}

function renderCashierTicket(printer, order, items, header, printConfig) {
  renderHeader(printer, 'فاتورة الكاشير', header, printConfig);
  items.forEach((item) => {
    const lineTotal = Number(item.quantity) * Number(item.unit_price);
    printer.leftRight(fitText(`${item.quantity}x ${item.item_name}`, printConfig.chars_per_line), `${lineTotal.toFixed(2)}`);
    if (item.notes) {
      printer.println(`  ملاحظة: ${item.notes}`);
    }
  });
  printer.drawLine();
  printer.bold(true);
  printer.leftRight('المجموع', Number(order.total_amount).toFixed(2));
  printer.bold(false);
}

function renderExpoTicket(printer, items, header, printConfig) {
  renderHeader(printer, 'تيكت التجميع / الكنترول', header, printConfig);
  items.forEach((item) => {
    printer.println(fitText(`${item.quantity}x ${item.item_name}`, printConfig.chars_per_line));
    if (item.notes) {
      printer.println(`  ملاحظة: ${item.notes}`);
    }
  });
}

function renderKitchenStationTicket(printer, station, items, header, printConfig) {
  renderHeader(printer, `قسم: ${station.station_name}`, header, printConfig);
  items.forEach((item) => {
    printer.println(fitText(`${item.quantity}x ${item.item_name}`, printConfig.chars_per_line));
    if (item.notes) {
      printer.println(`  ملاحظة: ${item.notes}`);
    }
  });
}

async function executePrintJob(station, printConfig, renderFn) {
  const printer = createPrinterClient(station, printConfig);
  const isConnected = await printer.isPrinterConnected();
  if (!isConnected) {
    throw new Error(`تعذر الاتصال بالطابعة ${station.station_name} (${station.printer_ip})`);
  }

  for (let copyIndex = 0; copyIndex < Number(printConfig.print_copies || 1); copyIndex += 1) {
    renderFn(printer);
    printer.newLine();
    if (printConfig.cut_paper) {
      printer.cut();
    }
    if (printConfig.open_cash_drawer && typeof printer.openCashDrawer === 'function') {
      printer.openCashDrawer();
    }
    await printer.execute();
  }
}

async function sendTestPrint(station, metadata = {}) {
  const printConfig = await getPrintConfig();
  await executePrintJob(station, printConfig, (printer) => {
    printer.alignCenter();
    printer.bold(true);
    printer.println('TEST PRINT');
    printer.bold(false);
    printer.drawLine();
    printer.println(`Station: ${station.station_name}`);
    printer.println(`Code: ${station.station_code}`);
    printer.println(`Paper: ${printConfig.paper_width_mm}mm`);
    printer.println(`Font: ${printConfig.font_family} x${printConfig.font_scale}`);
    printer.println(`Header Font: x${printConfig.header_font_scale}`);
    printer.println(`Time: ${formatOrderTime(new Date())}`);
    if (metadata.requestedBy) {
      printer.println(`By: ${metadata.requestedBy}`);
    }
    printer.drawLine();
    printer.alignLeft();
    printer.println('If this ticket is printed,');
    printer.println('network and printer settings are OK.');
  });
}

function validatePayload(orderPayload) {
  if (!orderPayload || typeof orderPayload !== 'object') {
    throw new Error('Order payload غير صالح');
  }
  if (!orderPayload.tableNo || !orderPayload.guestCount) {
    throw new Error('رقم الطاولة وعدد الأشخاص مطلوبان');
  }
  if (!Array.isArray(orderPayload.items) || orderPayload.items.length === 0) {
    throw new Error('يجب إرسال عنصر واحد على الأقل داخل items');
  }
}

async function createOrderAndRoutePrint(orderPayload, userId) {
  validatePayload(orderPayload);

  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const itemsTotal = orderPayload.items.reduce((sum, item) => {
      return sum + (Number(item.unitPrice || 0) * Number(item.quantity || 0));
    }, 0);

    const [orderInsert] = await connection.execute(
      `INSERT INTO pos_orders (table_no, guest_count, total_amount, created_by)
       VALUES (?, ?, ?, ?)`,
      [String(orderPayload.tableNo), Number(orderPayload.guestCount), Number(itemsTotal), userId || null]
    );

    const orderId = orderInsert.insertId;

    const itemIds = orderPayload.items
      .map(item => item.itemId)
      .filter(Boolean);

    const stationByItemId = {};
    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => '?').join(',');
      const [mappingRows] = await connection.query(
        `SELECT pi.id AS item_id, ps.id AS station_id, ps.station_name, ps.station_code, ps.station_type,
                ps.printer_ip, ps.printer_port, ps.is_active
         FROM pos_items pi
         JOIN pos_stations ps ON ps.id = pi.station_id
         WHERE pi.id IN (${placeholders})`,
        itemIds
      );

      mappingRows.forEach((row) => {
        stationByItemId[row.item_id] = row;
      });
    }

    const normalizedItems = [];
    for (const item of orderPayload.items) {
      const mappedStation = item.itemId ? stationByItemId[item.itemId] : null;
      const [itemInsert] = await connection.execute(
        `INSERT INTO pos_order_items
         (order_id, item_id, item_name, quantity, unit_price, notes, station_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.itemId || null,
          item.itemName,
          Number(item.quantity),
          Number(item.unitPrice || 0),
          item.notes || null,
          mappedStation ? mappedStation.station_id : null
        ]
      );

      normalizedItems.push({
        id: itemInsert.insertId,
        item_id: item.itemId || null,
        item_name: item.itemName,
        quantity: Number(item.quantity),
        unit_price: Number(item.unitPrice || 0),
        notes: item.notes || '',
        station_id: mappedStation ? mappedStation.station_id : null
      });
    }

    const [stations] = await connection.query(
      `SELECT id, station_code, station_name, station_type, printer_ip, printer_port, is_active
       FROM pos_stations
       WHERE is_active = 1`
    );

    const cashier = stations.find(s => s.station_type === STATION_TYPES.CASHIER);
    const expo = stations.find(s => s.station_type === STATION_TYPES.EXPO);
    const kitchenStations = stations.filter(s => s.station_type === STATION_TYPES.KITCHEN);

    const order = {
      id: orderId,
      table_no: String(orderPayload.tableNo),
      guest_count: Number(orderPayload.guestCount),
      total_amount: Number(itemsTotal),
      created_at: new Date()
    };
    const header = getOrderHeader(order);

    const printConfig = await getPrintConfig(connection);
    const printTasks = [];

    if (cashier) {
      printTasks.push({
        station: cashier,
        ticketType: 'cashier',
        items: normalizedItems,
        printAction: () => executePrintJob(cashier, printConfig, (printer) => renderCashierTicket(printer, order, normalizedItems, header, printConfig))
      });
    }

    if (expo) {
      printTasks.push({
        station: expo,
        ticketType: 'expo',
        items: normalizedItems,
        printAction: () => executePrintJob(expo, printConfig, (printer) => renderExpoTicket(printer, normalizedItems, header, printConfig))
      });
    }

    for (const station of kitchenStations) {
      const stationItems = normalizedItems.filter(i => i.station_id === station.id);
      if (stationItems.length === 0) continue;
      printTasks.push({
        station,
        ticketType: 'station',
        items: stationItems,
        printAction: () => executePrintJob(station, printConfig, (printer) => renderKitchenStationTicket(printer, station, stationItems, header, printConfig))
      });
    }

    const printResults = await Promise.allSettled(printTasks.map(task => task.printAction()));
    const mappedResults = [];

    for (let i = 0; i < printResults.length; i += 1) {
      const result = printResults[i];
      const task = printTasks[i];
      const isSuccess = result.status === 'fulfilled';
      const errorMessage = isSuccess ? null : String(result.reason?.message || result.reason || 'طباعة فاشلة');

      await connection.execute(
        `INSERT INTO pos_print_jobs (order_id, station_id, ticket_type, status, error_message)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, task.station.id, task.ticketType, isSuccess ? 'success' : 'failed', errorMessage]
      );

      mappedResults.push({
        stationId: task.station.id,
        stationName: task.station.station_name,
        stationCode: task.station.station_code,
        ticketType: task.ticketType,
        status: isSuccess ? 'success' : 'failed',
        error: errorMessage
      });
    }

    await connection.commit();

    return {
      orderId,
      tableNo: order.table_no,
      guestCount: order.guest_count,
      totalAmount: order.total_amount,
      printResults: mappedResults
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createOrderAndRoutePrint,
  getPrintConfig,
  sendTestPrint,
  STATION_TYPES
};
