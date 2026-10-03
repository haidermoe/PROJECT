/**
 * ======================================================
 * POS Restaurant Controller - نظام الصالات وطلبات الويترية
 * معتمد على معايير Odoo 19 POS Restaurant
 * ======================================================
 */

const { appPool } = require('../database/appConnection');
const { createOrderAndRoutePrint } = require('./printRoutingService');
const { depleteOrderFromStation } = require('./stationStockService');
const cacheService = require('./cacheService');

// ===============================
// 1) جلب الصالات والطاولات وحالتها
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

    // تجميع الطاولات داخل كل صالة
    const floorMap = floors.map(floor => ({
      ...floor,
      tables: tables.filter(t => t.floor_id === floor.id)
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
        s.station_name,
        s.station_type
      FROM pos_items i
      LEFT JOIN pos_stations s ON i.station_id = s.id
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
          branch_id = ?
      WHERE id = ?
    `, [floorId || null, tableId || null, waiterId, waiterName, notes || null, branchId, orderId]);

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

    // 1. تحديث حالة الطلب إلى 'paid'
    await connection.query(`
      UPDATE pos_orders 
      SET status = 'paid', payment_method = ?
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
    const { floor_id, table_number, seats = 4 } = req.body;
    if (!floor_id || !table_number) {
      return res.status(400).json({ status: 'error', message: 'الصالة ورقم الطاولة مطلوبان' });
    }

    const [resInsert] = await appPool.query(
      `INSERT INTO pos_tables (floor_id, table_number, seats) VALUES (?, ?, ?)`,
      [floor_id, table_number, seats]
    );
    res.json({ status: 'success', message: 'تم إنشاء الطاولة بنجاح', tableId: resInsert.insertId });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
