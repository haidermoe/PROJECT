/**
 * ======================================================
 * POS Restaurant Controller - نظام الصالات وطلبات الويترية
 * معتمد على معايير Odoo 19 POS Restaurant
 * ======================================================
 */

const { appPool } = require('../database/appConnection');
const { authPool } = require('../database/authConnection');
const { createOrderAndRoutePrint } = require('./printRoutingService');
const { depleteOrderFromStation } = require('./stationStockService');
const cacheService = require('./cacheService');

// ===============================
// 1) جلب الصالات والطاولات وحالتها والعناصر المعمارية
// ===============================
exports.getFloorsAndTables = async (req, res) => {
  try {
    const [floors] = await appPool.query(`
      SELECT * FROM pos_floors WHERE is_active = 1 ORDER BY sequence ASC, id ASC
    `);

    const [tables] = await appPool.query(`
      SELECT 
        t.*,
        f.name AS floor_name,
        o.id AS active_order_id,
        o.total_amount AS order_total,
        o.guest_count,
        o.created_at AS order_start_time,
        o.waiter_name
      FROM pos_tables t
      JOIN pos_floors f ON t.floor_id = f.id
      LEFT JOIN pos_orders o ON t.current_order_id = o.id AND o.status IN ('draft', 'ordered', 'billed')
      WHERE t.is_active = 1
      ORDER BY t.floor_id ASC, t.id ASC
    `);

    // جلب العناصر المعمارية (جدران، أبواب، كاونترات، محطات خدمة)
    const [elements] = await appPool.query(`
      SELECT * FROM pos_floor_elements ORDER BY floor_id ASC, id ASC
    `);

    // تجميع الطاولات والعناصر داخل كل صالة
    const floorMap = floors.map(floor => ({
      ...floor,
      tables: tables.filter(t => t.floor_id === floor.id),
      elements: elements.filter(el => el.floor_id === floor.id)
    }));

    res.json({
      status: 'success',
      data: {
        floors: floorMap,
        stats: {
          totalTables: tables.length,
          availableTables: tables.filter(t => t.status === 'available').length,
          occupiedTables: tables.filter(t => t.status === 'occupied').length,
          billedTables: tables.filter(t => t.status === 'billed').length
        }
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getFloorsAndTables:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 2) جلب قائمة الطعام المتاحة للطلب
// ===============================
exports.getMenu = async (req, res) => {
  try {
    // جلب الأصناف من جدول pos_items وربطها بالمحطات (المطبخ، البار، الكاشير)
    const [items] = await appPool.query(`
      SELECT 
        i.id,
        i.item_name,
        i.category,
        i.price,
        i.station_id,
        i.recipe_id,
        r.name AS recipe_name,
        s.station_name,
        s.station_type
      FROM pos_items i
      LEFT JOIN pos_stations s ON i.station_id = s.id
      LEFT JOIN recipes r ON i.recipe_id = r.id
      WHERE i.is_active = 1
      ORDER BY i.category ASC, i.item_name ASC
    `);

    // إذا لم تكن هناك أصناف في pos_items بعد، نقوم بجلب الوصفات كأصناف منيو افتراضية
    let menuItems = items;
    if (menuItems.length === 0) {
      const [recipes] = await appPool.query(`
        SELECT id, name AS item_name, 10.00 AS price, 'المطبخ الرئيسي' AS station_name, 'kitchen' AS station_type
        FROM recipes
        LIMIT 30
      `);
      menuItems = recipes;
    }

    res.json({ status: 'success', data: menuItems });
  } catch (err) {
    console.error('❌ خطأ في getMenu:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 3) جلب تفاصيل طلب طاولة معينة
// ===============================
exports.getTableOrder = async (req, res) => {
  try {
    const { tableId } = req.params;
    const [tableRows] = await appPool.query(`SELECT * FROM pos_tables WHERE id = ?`, [tableId]);
    if (!tableRows.length) {
      return res.status(404).json({ status: 'error', message: 'الطاولة غير موجودة' });
    }

    const table = tableRows[0];
    if (!table.current_order_id) {
      return res.json({ status: 'success', data: null, message: 'الطاولة شاغرة حالياً' });
    }

    const [orderRows] = await appPool.query(`SELECT * FROM pos_orders WHERE id = ?`, [table.current_order_id]);
    if (!orderRows.length) {
      return res.json({ status: 'success', data: null });
    }

    const order = orderRows[0];
    const [items] = await appPool.query(`SELECT * FROM pos_order_items WHERE order_id = ?`, [order.id]);
    order.items = items;

    res.json({ status: 'success', data: order });
  } catch (err) {
    console.error('❌ خطأ في getTableOrder:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 4) إرسال طلب جديد من الويتر للمطبخ وتوجيه الطباعة
// ===============================
exports.sendWaiterOrder = async (req, res) => {
  try {
    const { tableId, floorId, tableNo, guestCount = 2, items, notes } = req.body;

    if (!tableNo || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: 'error', message: 'رقم الطاولة وقائمة الأصناف مطلوبة' });
    }

    const waiterId = req.user?.id || null;
    const waiterName = req.user?.username || 'ويتر';

    // 1. استخدام محرك توجيه الطباعة وإدراج الطلب الرئيسي وتفاصيل الأصناف
    const orderPayload = {
      tableNo: String(tableNo),
      guestCount: Number(guestCount) || 1,
      items: items.map(it => ({
        itemId: it.itemId || it.id || null,
        itemName: it.itemName || it.name,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.price || it.unitPrice || 0),
        notes: it.notes || ''
      }))
    };

    // إرسال الطلب وحفظه وتشغيل طابعات المطبخ والأقسام
    const printResult = await createOrderAndRoutePrint(orderPayload, waiterId);
    const orderId = printResult.orderId;

    // 2. تحديث بيانات إضافية للطلب (الويتر، الصالة، الحالة، والفرع)
    const branchId = req.headers['x-branch-id'] || req.body.branchId || 1;
    await appPool.query(`
      UPDATE pos_orders 
      SET status = 'ordered',
          floor_id = ?,
          table_id = ?,
          waiter_id = ?,
          waiter_name = ?,
          notes = ?,
          branch_id = ?,
          guest_count = ?,
          seated_at = COALESCE(seated_at, NOW())
      WHERE id = ?
    `, [floorId || null, tableId || null, waiterId, waiterName, notes || null, branchId, Number(guestCount) || 2, orderId]);

    // 3. تحديث حالة الطاولة في الخريطة إلى 'مشغولة'
    if (tableId) {
      await appPool.query(`
        UPDATE pos_tables 
        SET status = 'occupied',
            current_order_id = ?
        WHERE id = ?
      `, [orderId, tableId]);
    }

    // 4. خصم مكونات الوجبات فورياً من رصيد السكشن المسؤول (مخزون الشفت التشغيلي)
    try {
      await depleteOrderFromStation(orderId);
    } catch (depleteErr) {
      console.warn('⚠️ [Deplete on Send Order]:', depleteErr.message);
    }

    res.json({
      status: 'success',
      message: `تم إرسال الطلب بنجاح إلى المطبخ وطباعة كبونات التحضير (طلب رقم #${orderId})`,
      data: {
        orderId,
        tableNo,
        totalAmount: printResult.totalAmount,
        items: printResult.items,
        printResults: printResult.printResults
      }
    });

  } catch (err) {
    console.error('❌ خطأ في sendWaiterOrder:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 5) دفع الحساب وإخلاء الطاولة + إنشاء قيد محاسبي تلقائي (Odoo Auto Journal Entry)
// ===============================
exports.payAndCloseOrder = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const { orderId, tableId, paymentMethod = 'cash' } = req.body;
    if (!orderId) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'رقم الطلب مطلوب' });
    }

    const [orderRows] = await connection.query(`SELECT * FROM pos_orders WHERE id = ?`, [orderId]);
    if (!orderRows.length) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'الطلب غير موجود' });
    }

    const order = orderRows[0];
    const totalAmount = parseFloat(order.total_amount) || 0;

    // 1. تحديث حالة الطلب إلى 'paid' وتوثيق مدة الجلوس
    await connection.query(`
      UPDATE pos_orders 
      SET status = 'paid', 
          payment_method = ?,
          closed_at = NOW(),
          duration_minutes = GREATEST(1, TIMESTAMPDIFF(MINUTE, COALESCE(seated_at, created_at), NOW()))
      WHERE id = ?
    `, [paymentMethod, orderId]);

    // 2. إخلاء الطاولة وتصفير الطلب النشط
    if (tableId || order.table_id) {
      const targetTableId = tableId || order.table_id;
      await connection.query(`
        UPDATE pos_tables 
        SET status = 'available', current_order_id = NULL
        WHERE id = ?
      `, [targetTableId]);
    }

    // 3. إنشاء قيد محاسبي تلقائي في شجرة الحسابات طبقاً لمعايير Odoo:
    // المدين: الصندوق 101000 (أو البنك 102000 في حال الدفع بالبطاقة)
    // الدائن: إيرادات مبيعات الأطعمة 401000
    if (totalAmount > 0) {
      const debitAccountCode = paymentMethod === 'card' ? '102000' : '101000';
      const [debitAcc] = await connection.query('SELECT id FROM account_account WHERE code = ?', [debitAccountCode]);
      const [creditAcc] = await connection.query('SELECT id FROM account_account WHERE code = ?', ['401000']);
      const [posJournal] = await connection.query('SELECT id FROM account_journal WHERE code = ?', ['POS']);

      if (debitAcc.length && creditAcc.length && posJournal.length) {
        const year = new Date().getFullYear();
        const todayStr = new Date().toISOString().split('T')[0];
        const moveName = `POS/${year}/${String(orderId).padStart(4, '0')}`;

        const [moveRes] = await connection.query(`
          INSERT INTO account_move (name, date, ref, journal_id, state, total_amount, created_by, branch_id)
          VALUES (?, ?, ?, ?, 'posted', ?, ?, ?)
        `, [
          moveName,
          todayStr,
          `مبيعات طاولة ${order.table_no} - طلب #${orderId} (${paymentMethod === 'card' ? 'بطاقة/شبكة' : 'نقداً'})`,
          posJournal[0].id,
          totalAmount,
          req.user?.id || null,
          order.branch_id || 1
        ]);

        const moveId = moveRes.insertId;

        // سطر المدين (النقدية أو البنك)
        await connection.query(`
          INSERT INTO account_move_line (move_id, account_id, name, debit, credit)
          VALUES (?, ?, ?, ?, 0.00)
        `, [moveId, debitAcc[0].id, `تحصيل مبيعات طلب #${orderId}`, totalAmount]);

        // سطر الدائن (إيرادات المبيعات)
        await connection.query(`
          INSERT INTO account_move_line (move_id, account_id, name, debit, credit)
          VALUES (?, ?, ?, 0.00, ?)
        `, [moveId, creditAcc[0].id, `إيراد مبيعات طاولة ${order.table_no}`, totalAmount]);
      }
    }

    // 4. خصم مكونات كروت الوصفات تلقائياً من رصيد السكشن المسؤول
    try {
      await depleteOrderFromStation(orderId, connection);
    } catch (depleteErr) {
      console.warn('⚠️ تنبيه أثناء خصم رصيد السكشن:', depleteErr.message);
    }

    await connection.commit();

    // إبطال كاش الحسابات والفروع فورياً لتحديث الإيرادات والمبيعات الموحدة
    cacheService.invalidate(['accounting', 'branches']);

    res.json({
      status: 'success',
      message: `تم تحصيل الطلب #${orderId} بنجاح وإخلاء الطاولة وتسجيل القيد المحاسبي التلقائي.`,
      data: {
        orderId,
        totalAmount,
        paymentMethod
      }
    });

  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في payAndCloseOrder:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
// 6) إدارة الصالات والطاولات (إضافة صالة / طاولة)
// ===============================
exports.createFloor = async (req, res) => {
  try {
    const { name, sequence = 1 } = req.body;
    if (!name) return res.status(400).json({ status: 'error', message: 'اسم الصالة مطلوب' });

    const [resInsert] = await appPool.query(
      `INSERT INTO pos_floors (name, sequence) VALUES (?, ?)`,
      [name, sequence]
    );
    res.json({ status: 'success', message: 'تم إنشاء الصالة بنجاح', floorId: resInsert.insertId });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.createTable = async (req, res) => {
  try {
    const { 
      floor_id, 
      table_number, 
      seats = 4, 
      shape = 'square', 
      position_x = 100, 
      position_y = 100, 
      width = 120, 
      height = 120 
    } = req.body;

    if (!floor_id || !table_number) {
      return res.status(400).json({ status: 'error', message: 'الصالة ورقم الطاولة مطلوبان' });
    }

    const [resInsert] = await appPool.query(
      `INSERT INTO pos_tables (floor_id, table_number, seats, shape, position_x, position_y, width, height) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        floor_id, 
        table_number.trim(), 
        parseInt(seats) || 4, 
        shape, 
        parseInt(position_x) || 100, 
        parseInt(position_y) || 100, 
        parseInt(width) || 120, 
        parseInt(height) || 120
      ]
    );

    res.json({
      status: 'success', 
      message: 'تم إنشاء الطاولة بنجاح', 
      tableId: resInsert.insertId 
    });
  } catch (err) {
    console.error('❌ خطأ في createTable:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { table_number, seats, shape, width, height, position_x, position_y } = req.body;

    await appPool.query(`
      UPDATE pos_tables
      SET table_number = COALESCE(?, table_number),
          seats = COALESCE(?, seats),
          shape = COALESCE(?, shape),
          width = COALESCE(?, width),
          height = COALESCE(?, height),
          position_x = COALESCE(?, position_x),
          position_y = COALESCE(?, position_y)
      WHERE id = ?
    `, [table_number, seats, shape, width, height, position_x, position_y, id]);

    res.json({ status: 'success', message: 'تم تحديث بيانات الطاولة بنجاح' });
  } catch (err) {
    console.error('❌ خطأ في updateTable:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.deleteFloor = async (req, res) => {
  try {
    const { id } = req.params;
    const [occupied] = await appPool.query(
      `SELECT id FROM pos_tables WHERE floor_id = ? AND status = 'occupied'`,
      [id]
    );
    if (occupied.length > 0) {
      return res.status(400).json({ status: 'error', message: 'لا يمكن حذف الصالة لأنها تحتوي على طاولات مشغولة حالياً' });
    }
    await appPool.query(`DELETE FROM pos_tables WHERE floor_id = ?`, [id]);
    await appPool.query(`DELETE FROM pos_floors WHERE id = ?`, [id]);
    res.json({ status: 'success', message: 'تم حذف الصالة وجميع طاولاتها بنجاح' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.deleteTable = async (req, res) => {
  try {
    const { id } = req.params;
    const [tableRows] = await appPool.query(`SELECT status FROM pos_tables WHERE id = ?`, [id]);
    if (!tableRows.length) {
      return res.status(404).json({ status: 'error', message: 'الطاولة غير موجودة' });
    }
    if (tableRows[0].status === 'occupied') {
      return res.status(400).json({ status: 'error', message: 'لا يمكن حذف طاولة مشغولة حالياً بطلب زبائن' });
    }

    await appPool.query(`DELETE FROM pos_tables WHERE id = ?`, [id]);
    res.json({ status: 'success', message: 'تم حذف الطاولة من الصالة بنجاح' });
  } catch (err) {
    console.error('❌ خطأ في deleteTable:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 7) حفظ المخطط المعماري للصالة (Bulk Layout Save)
// ===============================
exports.saveFloorLayout = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();
    const { floorId } = req.params;
    const { tables } = req.body;

    if (!tables || !Array.isArray(tables)) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'قائمة الطاولات مطلوبة' });
    }

    for (const t of tables) {
      if (t.id) {
        await connection.query(`
          UPDATE pos_tables
          SET position_x = ?, position_y = ?, width = ?, height = ?, shape = ?, seats = ?, table_number = ?
          WHERE id = ? AND floor_id = ?
        `, [
          Math.max(0, parseInt(t.position_x) || 0),
          Math.max(0, parseInt(t.position_y) || 0),
          Math.max(60, parseInt(t.width) || 120),
          Math.max(60, parseInt(t.height) || 120),
          t.shape || 'square',
          Math.max(1, parseInt(t.seats) || 4),
          t.table_number || String(t.id),
          t.id,
          floorId
        ]);
      }
    }

    await connection.commit();
    res.json({ status: 'success', message: 'تم حفظ المخطط المعماري للصالة بنجاح' });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في saveFloorLayout:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
// 8) إدارة الملاحظات السريعة (Quick Notes)
// ===============================
exports.getQuickNotes = async (req, res) => {
  try {
    const [notes] = await appPool.query(
      `SELECT * FROM pos_quick_notes WHERE is_active = 1 ORDER BY category ASC, id ASC`
    );
    res.json({ status: 'success', data: notes });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.createQuickNote = async (req, res) => {
  try {
    const { note_text, category = 'عام' } = req.body;
    if (!note_text || !note_text.trim()) {
      return res.status(400).json({ status: 'error', message: 'نص الملاحظة مطلوب' });
    }
    const [result] = await appPool.query(
      `INSERT INTO pos_quick_notes (note_text, category, is_active) VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE is_active = 1, category = VALUES(category)`,
      [note_text.trim(), category.trim()]
    );
    res.json({ status: 'success', message: 'تمت إضافة الملاحظة السريعة بنجاح', noteId: result.insertId });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.deleteQuickNote = async (req, res) => {
  try {
    const { id } = req.params;
    await appPool.query(`DELETE FROM pos_quick_notes WHERE id = ?`, [id]);
    res.json({ status: 'success', message: 'تم حذف الملاحظة السريعة بنجاح' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 9) محرك تحليلات أداء الصالة ودوران الطاولات (Floor Analytics & KPIs)
// ===============================
exports.getFloorAnalytics = async (req, res) => {
  try {
    const { floorId, days = 1 } = req.query;

    let floorFilter = '';
    const params = [];
    if (floorId) {
      floorFilter = 'WHERE t.floor_id = ?';
      params.push(floorId);
    }

    // 1. إجمالي الطاولات والمقاعد والطاقة الاستيعابية
    const [seatsRows] = await appPool.query(`
      SELECT 
        COUNT(t.id) AS total_tables,
        COALESCE(SUM(t.seats), 0) AS total_capacity,
        COALESCE(SUM(CASE WHEN t.status IN ('occupied', 'billed') THEN t.seats ELSE 0 END), 0) AS occupied_capacity
      FROM pos_tables t
      ${floorFilter}
    `, params);

    const totalCapacity = parseInt(seatsRows[0]?.total_capacity) || 1;
    const occupiedCapacity = parseInt(seatsRows[0]?.occupied_capacity) || 0;
    const liveOccupancyRate = Math.round((occupiedCapacity / totalCapacity) * 100);

    // 2. إحصائيات الطلبات والجلسات ومعدلات الدوران
    const [statsRows] = await appPool.query(`
      SELECT 
        COUNT(o.id) AS total_orders_served,
        COALESCE(SUM(o.total_amount), 0) AS total_sales,
        COALESCE(AVG(o.guest_count), 2) AS avg_guests_per_table,
        COALESCE(AVG(CASE WHEN o.duration_minutes > 0 THEN o.duration_minutes ELSE TIMESTAMPDIFF(MINUTE, o.created_at, COALESCE(o.closed_at, NOW())) END), 35) AS avg_duration_minutes,
        COALESCE(SUM(o.guest_count), 0) AS total_guests_served
      FROM pos_orders o
      WHERE o.status IN ('ordered', 'billed', 'paid')
        AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        ${floorId ? 'AND o.floor_id = ?' : ''}
    `, floorId ? [days, floorId] : [days]);

    const totalOrders = parseInt(statsRows[0]?.total_orders_served) || 0;
    const totalTables = parseInt(seatsRows[0]?.total_tables) || 1;
    const turnoverRate = Math.round((totalOrders / totalTables) * 10) / 10;

    // 3. أداء كل طاولة بالتفصيل (Table Breakdown)
    const [tableBreakdown] = await appPool.query(`
      SELECT 
        t.id AS table_id,
        t.table_number,
        t.seats,
        t.status,
        t.shape,
        f.name AS floor_name,
        COUNT(o.id) AS turnover_count,
        COALESCE(SUM(o.total_amount), 0) AS total_revenue,
        COALESCE(AVG(CASE WHEN o.duration_minutes > 0 THEN o.duration_minutes ELSE TIMESTAMPDIFF(MINUTE, o.created_at, COALESCE(o.closed_at, NOW())) END), 0) AS avg_duration,
        COALESCE(AVG(o.guest_count), 0) AS avg_guests
      FROM pos_tables t
      JOIN pos_floors f ON t.floor_id = f.id
      LEFT JOIN pos_orders o ON t.id = o.table_id 
        AND o.status IN ('ordered', 'billed', 'paid')
        AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ${floorId ? 'WHERE t.floor_id = ?' : ''}
      GROUP BY t.id, t.table_number, t.seats, t.status, t.shape, f.name
      ORDER BY turnover_count DESC, total_revenue DESC
    `, floorId ? [days, floorId] : [days]);

    res.json({
      status: 'success',
      data: {
        kpis: {
          total_tables: totalTables,
          total_capacity: totalCapacity,
          occupied_capacity: occupiedCapacity,
          live_occupancy_rate: liveOccupancyRate,
          table_turnover_rate: turnoverRate,
          avg_seating_duration: Math.round(parseFloat(statsRows[0]?.avg_duration_minutes) || 0),
          avg_guests_per_table: Math.round((parseFloat(statsRows[0]?.avg_guests_per_table) || 0) * 10) / 10,
          total_sales: parseFloat(statsRows[0]?.total_sales) || 0,
          total_guests_served: parseInt(statsRows[0]?.total_guests_served) || 0
        },
        tables: tableBreakdown
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getFloorAnalytics:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 10) إدارة أطباق المنيو (Dishes / pos_items)
// ===============================
exports.createMenuItem = async (req, res) => {
  try {
    const { item_name, category, price, station_id, recipe_id } = req.body;
    if (!item_name || !price || !station_id) {
      return res.status(400).json({ status: 'error', message: 'اسم الطبق، السعر، والسكشن مطلوبة' });
    }
    const [result] = await appPool.query(
      `INSERT INTO pos_items (item_name, category, price, station_id, recipe_id, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [item_name.trim(), category || 'أطباق رئيسية', parseFloat(price), station_id, recipe_id || null]
    );
    res.json({ status: 'success', message: 'تمت إضافة الطبق لقائمة الطعام بنجاح', itemId: result.insertId });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_name, category, price, station_id, recipe_id, is_active } = req.body;
    await appPool.query(
      `UPDATE pos_items 
       SET item_name = COALESCE(?, item_name),
           category = COALESCE(?, category),
           price = COALESCE(?, price),
           station_id = COALESCE(?, station_id),
           recipe_id = ?,
           is_active = COALESCE(?, is_active),
           updated_at = NOW()
       WHERE id = ?`,
      [item_name, category, price, station_id, recipe_id || null, is_active, id]
    );
    res.json({ status: 'success', message: 'تم تحديث بيانات الطبق بنجاح' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    await appPool.query(`UPDATE pos_items SET is_active = 0 WHERE id = ?`, [id]);
    res.json({ status: 'success', message: 'تم إيقاف/حذف الطبق من قائمة الطعام' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 11) جلب خيارات السكاشن والوصفات لربط المنيو
// ===============================
exports.getStationsAndRecipes = async (req, res) => {
  try {
    const [stations] = await appPool.query(
      `SELECT id, station_code, station_name, station_type FROM pos_stations WHERE is_active = 1`
    );
    const [recipes] = await appPool.query(
      `SELECT id, name, item_name, status FROM recipes ORDER BY name ASC`
    );
    res.json({
      status: 'success',
      data: { stations, recipes }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 12) إدارة وتوزيع الويترية والشفتات على السكاشن (Waiters & Shifts Management)
// ===============================
exports.getWaitersList = async (req, res) => {
  try {
    const [waiters] = await authPool.query(`
      SELECT id, username, full_name, role 
      FROM users 
      WHERE is_active = 1 AND (role = 'waiter' OR role = 'hall_manager' OR role = 'cashier')
      ORDER BY role ASC, full_name ASC
    `);
    res.json({ status: 'success', data: waiters });
  } catch (err) {
    console.error('❌ خطأ في getWaitersList:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getWaiterAssignments = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const [assignments] = await appPool.query(`
      SELECT 
        a.*,
        f.name AS floor_name,
        f.sequence AS floor_sequence
      FROM pos_floor_waiter_assignments a
      JOIN pos_floors f ON a.floor_id = f.id
      WHERE a.shift_date = ? AND a.is_active = 1
      ORDER BY f.sequence ASC, a.id ASC
    `, [date]);
    res.json({ status: 'success', data: assignments });
  } catch (err) {
    console.error('❌ خطأ في getWaiterAssignments:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.assignWaiterToFloor = async (req, res) => {
  try {
    const { floor_id, user_id, waiter_name, shift_name = 'صباحي', shift_date, notes = '' } = req.body;
    if (!floor_id || !user_id || !waiter_name) {
      return res.status(400).json({ status: 'error', message: 'الصالة، معرف الويتر، واسم الويتر مطلوبة' });
    }

    const targetDate = shift_date || new Date().toISOString().slice(0, 10);
    const assignedBy = req.user ? req.user.id : null;

    // تعطيل التكليف السابق لنفس الصالة في نفس التاريخ إذا وجد
    await appPool.query(`
      UPDATE pos_floor_waiter_assignments 
      SET is_active = 0 
      WHERE floor_id = ? AND shift_date = ?
    `, [floor_id, targetDate]);

    // تسجيل التكليف الجديد
    const [result] = await appPool.query(`
      INSERT INTO pos_floor_waiter_assignments 
      (floor_id, user_id, waiter_name, shift_name, shift_date, is_active, assigned_by, notes)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `, [floor_id, user_id, waiter_name, shift_name, targetDate, assignedBy, notes]);

    // تحديث الصالة بالويتر النشط والشفت الحالي
    await appPool.query(`
      UPDATE pos_floors 
      SET active_waiter_id = ?, active_waiter_name = ?, active_shift = ?
      WHERE id = ?
    `, [user_id, waiter_name, shift_name, floor_id]);

    res.json({
      status: 'success',
      message: `تم تكليف الويتر (${waiter_name}) على الصالة بنجاح بالشفت (${shift_name})`,
      assignmentId: result.insertId
    });
  } catch (err) {
    console.error('❌ خطأ في assignWaiterToFloor:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 13) إدارة العناصر المعمارية للصالة (Architectural Elements CRUD)
// ===============================
exports.getFloorElements = async (req, res) => {
  try {
    const { floorId } = req.params;
    const [elements] = await appPool.query(
      `SELECT * FROM pos_floor_elements WHERE floor_id = ? ORDER BY id ASC`,
      [floorId]
    );
    res.json({ status: 'success', data: elements });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.saveFloorArchitecturalBlueprint = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();
    const { floorId } = req.params;
    const { tables = [], elements = [] } = req.body;

    // 1. تحديث الطاولات مع أبعادها، دورانها وشكلها
    for (const t of tables) {
      if (t.id) {
        await connection.query(`
          UPDATE pos_tables
          SET position_x = ?, position_y = ?, width = ?, height = ?, rotation = ?, shape = ?, seats = ?, table_number = ?
          WHERE id = ? AND floor_id = ?
        `, [
          Math.max(0, parseInt(t.position_x) || 0),
          Math.max(0, parseInt(t.position_y) || 0),
          Math.max(40, parseInt(t.width) || 100),
          Math.max(40, parseInt(t.height) || 100),
          parseInt(t.rotation) || 0,
          t.shape || 'square',
          Math.max(1, parseInt(t.seats) || 4),
          t.table_number || String(t.id),
          t.id,
          floorId
        ]);
      }
    }

    // 2. مزامنة العناصر المعمارية: مسح العناصر السابقة للصالة وإعادة إدخالها
    if (Array.isArray(elements)) {
      await connection.query(`DELETE FROM pos_floor_elements WHERE floor_id = ?`, [floorId]);
      for (const el of elements) {
        await connection.query(`
          INSERT INTO pos_floor_elements (floor_id, element_type, name, position_x, position_y, width, height, rotation, color)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          floorId,
          el.element_type || 'wall',
          el.name || '',
          Math.max(0, parseInt(el.position_x) || 0),
          Math.max(0, parseInt(el.position_y) || 0),
          Math.max(10, parseInt(el.width) || 100),
          Math.max(10, parseInt(el.height) || 20),
          parseInt(el.rotation) || 0,
          el.color || '#64748b'
        ]);
      }
    }

    await connection.commit();
    res.json({ status: 'success', message: 'تم حفظ المخطط الهندسي المعماري للصالة بجميع أبعاده وعناصره بنجاح!' });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في saveFloorArchitecturalBlueprint:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};


