const { appPool } = require('../database/appConnection');
const { createOrderAndRoutePrint, getPrintConfig, sendTestPrint, STATION_TYPES } = require('./printRoutingService');

async function ensurePosTables() {
  await appPool.query(`
    CREATE TABLE IF NOT EXISTS pos_stations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      station_code VARCHAR(50) NOT NULL UNIQUE,
      station_name VARCHAR(100) NOT NULL,
      station_type ENUM('cashier', 'expo', 'kitchen') NOT NULL DEFAULT 'kitchen',
      printer_ip VARCHAR(45) NOT NULL,
      printer_port INT NOT NULL DEFAULT 9100,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_station_type (station_type),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await appPool.query(`
    CREATE TABLE IF NOT EXISTS pos_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      station_id INT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_pos_items_station FOREIGN KEY (station_id) REFERENCES pos_stations(id) ON DELETE RESTRICT,
      INDEX idx_station_id (station_id),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await appPool.query(`
    CREATE TABLE IF NOT EXISTS pos_orders (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      table_no VARCHAR(30) NOT NULL,
      guest_count INT NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      created_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_table_no (table_no),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await appPool.query(`
    CREATE TABLE IF NOT EXISTS pos_order_items (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_id BIGINT NOT NULL,
      item_id INT NULL,
      item_name VARCHAR(255) NOT NULL,
      quantity DECIMAL(10,2) NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      notes VARCHAR(255) NULL,
      station_id INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_pos_order_items_order FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_pos_order_items_station FOREIGN KEY (station_id) REFERENCES pos_stations(id) ON DELETE SET NULL,
      INDEX idx_order_id (order_id),
      INDEX idx_item_id (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await appPool.query(`
    CREATE TABLE IF NOT EXISTS pos_print_jobs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_id BIGINT NOT NULL,
      station_id INT NOT NULL,
      ticket_type ENUM('cashier', 'expo', 'station') NOT NULL,
      status ENUM('success', 'failed') NOT NULL,
      error_message TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_pos_print_jobs_order FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
      CONSTRAINT fk_pos_print_jobs_station FOREIGN KEY (station_id) REFERENCES pos_stations(id) ON DELETE CASCADE,
      INDEX idx_order_id (order_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await appPool.query(`
    CREATE TABLE IF NOT EXISTS pos_print_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value LONGTEXT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  
  // Ensure the column is LONGTEXT in case it was created as VARCHAR
  try {
    await appPool.query(`ALTER TABLE pos_print_settings MODIFY setting_value LONGTEXT;`);
  } catch (e) {
    // Ignore error if already modified or fails
  }

  await appPool.query(`
    INSERT INTO pos_print_settings (setting_key, setting_value)
    VALUES
      ('paper_width_mm', '80'),
      ('font_family', 'A'),
      ('font_scale', '1'),
      ('header_font_scale', '2'),
      ('chars_per_line', '48'),
      ('print_copies', '1'),
      ('cut_paper', 'true'),
      ('open_cash_drawer', 'false'),
      ('printer_timeout_ms', '7000'),
      ('receipt_header_text', 'Restaurant Name'),
      ('receipt_footer_text', 'Thank you for your visit!'),
      ('bottom_margin_lines', '3'),
      ('show_logo', 'false'),
      ('logo_path', ''),
      ('bold_items', 'false'),
      ('border_character', '-'),
      ('line_spacing', '4')
    ON DUPLICATE KEY UPDATE setting_key = setting_key;
  `);
}

function validateStationType(type) {
  const allowed = Object.values(STATION_TYPES);
  return allowed.includes(type);
}

exports.listStations = async (req, res) => {
  try {
    await ensurePosTables();
    const [rows] = await appPool.query(
      `SELECT id, station_code, station_name, station_type, connection_type, printer_ip, printer_port, is_active, fallback_station_id, updated_at
       FROM pos_stations
       ORDER BY station_type, station_name`
    );
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('❌ listStations:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل تحميل الطابعات' });
  }
};

exports.getPrintConfiguration = async (req, res) => {
  try {
    await ensurePosTables();
    const config = await getPrintConfig();
    res.json({ status: 'success', data: config });
  } catch (error) {
    console.error('❌ getPrintConfiguration:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل تحميل إعدادات الطباعة' });
  }
};

exports.updatePrintConfiguration = async (req, res) => {
  try {
    await ensurePosTables();
    const allowedKeys = [
      'paper_width_mm',
      'font_family',
      'font_scale',
      'header_font_scale',
      'chars_per_line',
      'print_copies',
      'cut_paper',
      'open_cash_drawer',
      'printer_timeout_ms',
      'receipt_header_text',
      'receipt_footer_text',
      'bottom_margin_lines',
      'border_character',
      'logo_path',
      'show_logo',
      'bold_items',
      'line_spacing'
    ];

    const entries = Object.entries(req.body || {}).filter(([key]) => allowedKeys.includes(key));
    if (!entries.length) {
      return res.status(400).json({ status: 'error', message: 'لا يوجد إعدادات صالحة للتحديث' });
    }

    for (const [key, rawValue] of entries) {
      const value = String(rawValue);
      await appPool.execute(
        `INSERT INTO pos_print_settings (setting_key, setting_value)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
        [key, value]
      );
    }

    const config = await getPrintConfig();
    res.json({ status: 'success', message: 'تم تحديث إعدادات الطباعة', data: config });
  } catch (error) {
    console.error('❌ updatePrintConfiguration:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل تحديث إعدادات الطباعة' });
  }
};

exports.createStation = async (req, res) => {
  try {
    await ensurePosTables();
    const { stationCode, stationName, stationType, connectionType, printerIp, printerPort, isActive, fallbackStationId } = req.body || {};
    if (!stationCode || !stationName || !stationType || !printerIp) {
      return res.status(400).json({ status: 'error', message: 'جميع الحقول الأساسية مطلوبة' });
    }
    if (!validateStationType(stationType)) {
      return res.status(400).json({ status: 'error', message: 'stationType غير صالح' });
    }

    await appPool.execute(
      `INSERT INTO pos_stations (station_code, station_name, station_type, connection_type, printer_ip, printer_port, is_active, fallback_station_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [stationCode.trim().toUpperCase(), stationName.trim(), stationType, connectionType || 'network', printerIp.trim(), Number(printerPort || 9100), Boolean(isActive ?? true), fallbackStationId ? Number(fallbackStationId) : null]
    );

    res.json({ status: 'success', message: 'تمت إضافة الطابعة/المحطة بنجاح' });
  } catch (error) {
    console.error('❌ createStation:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل إضافة المحطة' });
  }
};

exports.updateStation = async (req, res) => {
  try {
    await ensurePosTables();
    const stationId = Number(req.params.id);
    const { stationName, stationType, connectionType, printerIp, printerPort, isActive, fallbackStationId } = req.body || {};
    if (!stationId) {
      return res.status(400).json({ status: 'error', message: 'station id غير صالح' });
    }
    if (stationType && !validateStationType(stationType)) {
      return res.status(400).json({ status: 'error', message: 'stationType غير صالح' });
    }

    await appPool.execute(
      `UPDATE pos_stations
       SET station_name = COALESCE(?, station_name),
           station_type = COALESCE(?, station_type),
           connection_type = COALESCE(?, connection_type),
           printer_ip = COALESCE(?, printer_ip),
           printer_port = COALESCE(?, printer_port),
           is_active = COALESCE(?, is_active),
           fallback_station_id = COALESCE(?, fallback_station_id)
       WHERE id = ?`,
      [
        stationName ?? null,
        stationType ?? null,
        connectionType ?? null,
        printerIp ?? null,
        printerPort !== undefined ? Number(printerPort) : null,
        isActive !== undefined ? Boolean(isActive) : null,
        fallbackStationId !== undefined ? (fallbackStationId ? Number(fallbackStationId) : null) : null,
        stationId
      ]
    );

    res.json({ status: 'success', message: 'تم تحديث المحطة بنجاح' });
  } catch (error) {
    console.error('❌ updateStation:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل تحديث المحطة' });
  }
};

exports.testSingleStation = async (req, res) => {
  try {
    await ensurePosTables();
    const stationId = Number(req.params.id);
    if (!stationId) {
      return res.status(400).json({ status: 'error', message: 'station id غير صالح' });
    }

    const [rows] = await appPool.query(
      `SELECT id, station_code, station_name, station_type, connection_type, printer_ip, printer_port, is_active
       FROM pos_stations WHERE id = ? LIMIT 1`,
      [stationId]
    );
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'المحطة غير موجودة' });
    }
    const station = rows[0];
    if (!station.is_active) {
      return res.status(400).json({ status: 'error', message: 'المحطة غير فعالة' });
    }

    await sendTestPrint(station, { requestedBy: req.user?.username || req.user?.id || 'system' });
    res.json({ status: 'success', message: `تم إرسال اختبار طباعة إلى ${station.station_name}` });
  } catch (error) {
    console.error('❌ testSingleStation:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل اختبار الطابعة' });
  }
};

exports.testAllActiveStations = async (req, res) => {
  try {
    await ensurePosTables();
    const [stations] = await appPool.query(
      `SELECT id, station_code, station_name, station_type, connection_type, printer_ip, printer_port, is_active
       FROM pos_stations WHERE is_active = 1`
    );
    if (!stations.length) {
      return res.status(400).json({ status: 'error', message: 'لا توجد طابعات فعالة للاختبار' });
    }

    const results = await Promise.allSettled(
      stations.map((station) => sendTestPrint(station, { requestedBy: req.user?.username || req.user?.id || 'system' }))
    );

    const mapped = stations.map((station, index) => {
      const result = results[index];
      return {
        stationId: station.id,
        stationName: station.station_name,
        status: result.status === 'fulfilled' ? 'success' : 'failed',
        error: result.status === 'fulfilled' ? null : String(result.reason?.message || result.reason || 'فشل')
      };
    });

    res.json({ status: 'success', message: 'تم تنفيذ اختبار جميع الطابعات', data: mapped });
  } catch (error) {
    console.error('❌ testAllActiveStations:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل اختبار الطابعات' });
  }
};

exports.listItems = async (req, res) => {
  try {
    await ensurePosTables();
    const [rows] = await appPool.query(
      `SELECT pi.id, pi.item_name, pi.price, pi.station_id, pi.recipe_id, pi.is_active,
              ps.station_name, ps.station_code,
              r.item_name AS recipe_name, r.status AS recipe_status
       FROM pos_items pi
       LEFT JOIN pos_stations ps ON ps.id = pi.station_id
       LEFT JOIN recipes r ON r.id = pi.recipe_id
       ORDER BY (pi.station_id IS NULL OR pi.recipe_id IS NULL) DESC, pi.item_name ASC`
    );
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('❌ listItems:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل تحميل الأصناف' });
  }
};

exports.createItem = async (req, res) => {
  try {
    await ensurePosTables();
    const { itemName, price, stationId, recipeId, isActive } = req.body || {};
    if (!itemName) {
      return res.status(400).json({ status: 'error', message: 'اسم الصنف مطلوب' });
    }
    await appPool.execute(
      `INSERT INTO pos_items (item_name, price, station_id, recipe_id, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        itemName.trim(),
        Number(price || 0),
        stationId ? Number(stationId) : null,
        recipeId ? Number(recipeId) : null,
        Boolean(isActive ?? true)
      ]
    );
    res.json({ status: 'success', message: 'تمت إضافة الصنف بنجاح' });
  } catch (error) {
    console.error('❌ createItem:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل إضافة الصنف' });
  }
};

exports.updateItem = async (req, res) => {
  try {
    await ensurePosTables();
    const itemId = Number(req.params.id);
    const { itemName, price, stationId, recipeId, isActive } = req.body || {};
    if (!itemId) {
      return res.status(400).json({ status: 'error', message: 'item id غير صالح' });
    }

    await appPool.execute(
      `UPDATE pos_items
       SET item_name = COALESCE(?, item_name),
           price = COALESCE(?, price),
           station_id = COALESCE(?, station_id),
           recipe_id = COALESCE(?, recipe_id),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        itemName ?? null,
        price !== undefined ? Number(price) : null,
        stationId !== undefined ? (stationId ? Number(stationId) : null) : null,
        recipeId !== undefined ? (recipeId ? Number(recipeId) : null) : null,
        isActive !== undefined ? Boolean(isActive) : null,
        itemId
      ]
    );
    res.json({ status: 'success', message: 'تم تحديث الصنف بنجاح' });
  } catch (error) {
    console.error('❌ updateItem:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل تحديث الصنف' });
  }
};

exports.createOrderAndPrint = async (req, res) => {
  try {
    await ensurePosTables();
    const result = await createOrderAndRoutePrint(req.body, req.user?.id);
    res.json({
      status: 'success',
      message: 'تم إنشاء الطلب وإرسال الطباعة',
      data: result
    });
  } catch (error) {
    console.error('❌ createOrderAndPrint:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'فشل إنشاء الطلب أو الطباعة'
    });
  }
};

exports.listPrintQueue = async (req, res) => {
  try {
    const [rows] = await appPool.query(
      `SELECT q.id, q.order_id, q.status, q.retry_count, q.last_error_message, q.created_at, q.ticket_type,
              s.station_name, s.station_code
       FROM pos_print_queue q
       JOIN pos_stations s ON s.id = q.station_id
       WHERE q.status != 'success'
       ORDER BY q.created_at DESC`
    );
    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('❌ listPrintQueue:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل تحميل طابور الطباعة' });
  }
};

exports.clearPrintQueue = async (req, res) => {
  try {
    const { action, id } = req.body;
    if (action === 'retry_all') {
      await appPool.execute(`UPDATE pos_print_queue SET status = 'pending', retry_count = 0 WHERE status = 'failed_permanently'`);
    } else if (action === 'delete_all') {
      await appPool.execute(`DELETE FROM pos_print_queue WHERE status != 'success'`);
    } else if (action === 'retry' && id) {
      await appPool.execute(`UPDATE pos_print_queue SET status = 'pending', retry_count = 0 WHERE id = ?`, [id]);
    } else if (action === 'delete' && id) {
      await appPool.execute(`DELETE FROM pos_print_queue WHERE id = ?`, [id]);
    }
    res.json({ status: 'success', message: 'تم تحديث طابور الطباعة' });
  } catch (error) {
    console.error('❌ clearPrintQueue:', error);
    res.status(500).json({ status: 'error', message: error.message || 'فشل تعديل طابور الطباعة' });
  }
};
