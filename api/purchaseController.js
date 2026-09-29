/**
 * ======================================================
 * Purchase Controller - إدارة المشتريات والموردين (P2P)
 * مبني طبقاً لمعايير وهيكلية Odoo ERP (Odoo Purchases & Vendors)
 * ======================================================
 */

const { appPool } = require('../database/appConnection');

// ===============================
//      1) لوحة معلومات ومؤشرات المشتريات (KPIs)
// ===============================
exports.getPurchaseKPIs = async (req, res) => {
  try {
    // 1. إجمالي المشتريات المعتمدة هذا الشهر
    const [monthlySpent] = await appPool.query(`
      SELECT COALESCE(SUM(amount_total), 0) AS total
      FROM purchase_order
      WHERE state IN ('purchase', 'done')
        AND MONTH(date_order) = MONTH(CURRENT_DATE())
        AND YEAR(date_order) = YEAR(CURRENT_DATE())
    `);

    // 2. أوامر الشراء بانتظار الاستلام أو الفوترة
    const [pendingOrders] = await appPool.query(`
      SELECT COUNT(*) AS count
      FROM purchase_order
      WHERE state = 'purchase' AND (invoice_status = 'to_invoice' OR invoice_status = 'no')
    `);

    // 3. فواتير موردين غير مسددة أو مسددة جزئياً
    const [unpaidBills] = await appPool.query(`
      SELECT 
        COUNT(*) AS count,
        COALESCE(SUM(amount_total - amount_paid), 0) AS due_amount
      FROM vendor_bill
      WHERE payment_state IN ('not_paid', 'partial') AND state = 'posted'
    `);

    // 4. عدد الموردين النشطين
    const [vendorsCount] = await appPool.query(`
      SELECT COUNT(*) AS count FROM res_partner WHERE is_supplier = 1 AND is_active = 1
    `);

    res.json({
      status: 'success',
      data: {
        monthly_spent: parseFloat(monthlySpent[0].total) || 0,
        pending_orders: parseInt(pendingOrders[0].count) || 0,
        unpaid_bills_count: parseInt(unpaidBills[0].count) || 0,
        unpaid_bills_amount: parseFloat(unpaidBills[0].due_amount) || 0,
        vendors_count: parseInt(vendorsCount[0].count) || 0
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getPurchaseKPIs:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
//      2) دليل الموردين (Vendors / res_partner)
// ===============================
exports.getVendors = async (req, res) => {
  try {
    const [vendors] = await appPool.query(`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM purchase_order WHERE partner_id = p.id) AS total_orders,
        (SELECT COALESCE(SUM(amount_total), 0) FROM purchase_order WHERE partner_id = p.id AND state IN ('purchase', 'done')) AS total_purchased
      FROM res_partner p
      WHERE p.is_supplier = 1 AND p.is_active = 1
      ORDER BY p.id DESC
    `);
    res.json({ status: 'success', data: vendors });
  } catch (err) {
    console.error('❌ خطأ في getVendors:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const [vendor] = await appPool.query(`SELECT * FROM res_partner WHERE id = ?`, [id]);
    if (!vendor.length) {
      return res.status(404).json({ status: 'error', message: 'المورد غير موجود' });
    }

    // جلب أوامر الشراء للمورد
    const [orders] = await appPool.query(`
      SELECT * FROM purchase_order WHERE partner_id = ? ORDER BY date_order DESC LIMIT 20
    `, [id]);

    // جلب فواتير المورد
    const [bills] = await appPool.query(`
      SELECT * FROM vendor_bill WHERE partner_id = ? ORDER BY bill_date DESC LIMIT 20
    `, [id]);

    res.json({
      status: 'success',
      data: {
        vendor: vendor[0],
        orders,
        bills
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getVendorById:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.createVendor = async (req, res) => {
  try {
    const { name, phone, email, street, tax_id, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'اسم المورد مطلوب' });
    }

    // توليد كود المورد VEND-XXXX
    const [countRows] = await appPool.query(`SELECT COUNT(*) AS count FROM res_partner WHERE is_supplier = 1`);
    const ref = `VEND-${String(countRows[0].count + 1).padStart(3, '0')}`;

    const [result] = await appPool.query(`
      INSERT INTO res_partner (name, ref, phone, email, street, tax_id, notes, is_supplier)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [name.trim(), ref, phone || null, email || null, street || null, tax_id || null, notes || null]);

    res.json({
      status: 'success',
      message: 'تم إضافة المورد بنجاح',
      vendorId: result.insertId,
      ref
    });
  } catch (err) {
    console.error('❌ خطأ في createVendor:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.updateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, street, tax_id, notes } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ status: 'error', message: 'اسم المورد مطلوب' });
    }

    await appPool.query(`
      UPDATE res_partner
      SET name = ?, phone = ?, email = ?, street = ?, tax_id = ?, notes = ?
      WHERE id = ?
    `, [name.trim(), phone || null, email || null, street || null, tax_id || null, notes || null, id]);

    res.json({ status: 'success', message: 'تم تحديث بيانات المورد بنجاح' });
  } catch (err) {
    console.error('❌ خطأ في updateVendor:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
//      3) أوامر الشراء (Purchase Orders)
// ===============================
exports.getOrders = async (req, res) => {
  try {
    const [orders] = await appPool.query(`
      SELECT 
        po.*,
        rp.name AS partner_name,
        rp.phone AS partner_phone,
        rp.ref AS partner_ref,
        (SELECT COUNT(*) FROM purchase_order_line WHERE order_id = po.id) AS lines_count
      FROM purchase_order po
      JOIN res_partner rp ON po.partner_id = rp.id
      ORDER BY po.date_order DESC, po.id DESC
      LIMIT 150
    `);
    res.json({ status: 'success', data: orders });
  } catch (err) {
    console.error('❌ خطأ في getOrders:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const [orderRows] = await appPool.query(`
      SELECT 
        po.*,
        rp.name AS partner_name,
        rp.phone AS partner_phone,
        rp.ref AS partner_ref,
        rp.street AS partner_address,
        rp.balance AS partner_balance
      FROM purchase_order po
      JOIN res_partner rp ON po.partner_id = rp.id
      WHERE po.id = ?
    `, [id]);

    if (!orderRows.length) {
      return res.status(404).json({ status: 'error', message: 'أمر الشراء غير موجود' });
    }

    const order = orderRows[0];

    // جلب البنود مع أسماء المواد ووحداتها من المخزن
    const [lines] = await appPool.query(`
      SELECT 
        pol.*,
        i.name AS ingredient_name,
        i.unit AS ingredient_unit,
        i.stock_quantity AS current_stock,
        i.cost_price AS current_cost
      FROM purchase_order_line pol
      JOIN ingredients i ON pol.ingredient_id = i.id
      WHERE pol.order_id = ?
      ORDER BY pol.id ASC
    `, [id]);

    // جلب أذونات الاستلام المرتبطة
    const [pickings] = await appPool.query(`
      SELECT * FROM stock_picking WHERE purchase_id = ? ORDER BY id ASC
    `, [id]);

    // جلب الفواتير المرتبطة
    const [bills] = await appPool.query(`
      SELECT * FROM vendor_bill WHERE purchase_id = ? ORDER BY id ASC
    `, [id]);

    res.json({
      status: 'success',
      data: {
        order,
        lines,
        pickings,
        bills
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getOrderDetails:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.createOrder = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const { partner_id, date_planned, notes, lines } = req.body;
    if (!partner_id) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'يرجى اختيار المورد' });
    }
    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'يرجى إضافة صنف واحد على الأقل في أمر الشراء' });
    }

    // توليد رقم تسلسلي PO/YEAR/XXXX
    const currentYear = new Date().getFullYear();
    const [countRows] = await connection.query(`
      SELECT COUNT(*) AS count FROM purchase_order WHERE YEAR(date_order) = ?
    `, [currentYear]);
    const seq = String(countRows[0].count + 1).padStart(4, '0');
    const orderName = `PO/${currentYear}/${seq}`;

    // حساب إجمالي المبالغ
    let totalAmount = 0;
    const validatedLines = [];

    for (const item of lines) {
      const qty = parseFloat(item.product_qty);
      const price = parseFloat(item.price_unit);
      if (isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
        await connection.rollback();
        return res.status(400).json({ status: 'error', message: 'الكمية والأسعار يجب أن تكون أرقاماً صحيحة وموجبة' });
      }
      const subtotal = Math.round((qty * price) * 100) / 100;
      totalAmount += subtotal;

      validatedLines.push({
        ingredient_id: item.ingredient_id,
        name: item.name || '',
        product_qty: qty,
        price_unit: price,
        price_subtotal: subtotal
      });
    }

    totalAmount = Math.round(totalAmount * 100) / 100;

    // إدراج أمر الشراء بحالة draft (طلب تسعير / RFQ)
    const [poResult] = await connection.query(`
      INSERT INTO purchase_order (
        name, partner_id, date_planned, state, invoice_status,
        amount_untaxed, amount_total, notes, user_id
      ) VALUES (?, ?, ?, 'draft', 'no', ?, ?, ?, ?)
    `, [
      orderName,
      partner_id,
      date_planned || null,
      totalAmount,
      totalAmount,
      notes || null,
      req.user?.id || null
    ]);

    const orderId = poResult.insertId;

    // إدراج سطور أمر الشراء
    for (const line of validatedLines) {
      await connection.query(`
        INSERT INTO purchase_order_line (
          order_id, ingredient_id, name, product_qty, price_unit, price_subtotal
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [orderId, line.ingredient_id, line.name, line.product_qty, line.price_unit, line.price_subtotal]);
    }

    await connection.commit();
    res.json({
      status: 'success',
      message: `تم إنشاء مسودة أمر الشراء (${orderName}) بنجاح`,
      orderId,
      orderName
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في createOrder:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
//      4) تأكيد أمر الشراء (Confirm Order -> purchase)
// ===============================
exports.confirmOrder = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params;

    const [orderRows] = await connection.query(`SELECT * FROM purchase_order WHERE id = ? FOR UPDATE`, [id]);
    if (!orderRows.length) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'أمر الشراء غير موجود' });
    }

    const order = orderRows[0];
    if (order.state !== 'draft' && order.state !== 'sent') {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: `لا يمكن تأكيد أمر الشراء لأنه بحالة: ${order.state}` });
    }

    // تحديث حالة أمر الشراء إلى purchase وتعيين invoice_status إلى to_invoice
    await connection.query(`
      UPDATE purchase_order
      SET state = 'purchase', invoice_status = 'to_invoice'
      WHERE id = ?
    `, [id]);

    // توليد إذن استلام مخزني (stock_picking) كما في Odoo
    const currentYear = new Date().getFullYear();
    const [pickingCount] = await connection.query(`
      SELECT COUNT(*) AS count FROM stock_picking WHERE YEAR(created_at) = ?
    `, [currentYear]);
    const pSeq = String(pickingCount[0].count + 1).padStart(4, '0');
    const pickingName = `WH/IN/${currentYear}/${pSeq}`;

    const [pickingResult] = await connection.query(`
      INSERT INTO stock_picking (name, origin, purchase_id, partner_id, state)
      VALUES (?, ?, ?, ?, 'confirmed')
    `, [pickingName, order.name, id, order.partner_id]);

    const pickingId = pickingResult.insertId;

    // إنشاء حركات المخزون (stock_move) المرتبطة بإذن الاستلام
    const [lines] = await connection.query(`
      SELECT ingredient_id, product_qty, price_unit FROM purchase_order_line WHERE order_id = ?
    `, [id]);

    for (const l of lines) {
      await connection.query(`
        INSERT INTO stock_move (picking_id, ingredient_id, product_qty, price_unit, state)
        VALUES (?, ?, ?, ?, 'confirmed')
      `, [pickingId, l.ingredient_id, l.product_qty, l.price_unit]);
    }

    await connection.commit();
    res.json({
      status: 'success',
      message: `تم تأكيد أمر الشراء وإنشاء إذن الاستلام المخزني (${pickingName})`,
      pickingName
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في confirmOrder:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
//      5) استلام البضاعة في المخزن (Receive Goods / Validate Picking)
// ===============================
exports.receiveOrder = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params; // purchase_order id

    // التحقق من وجود أمر الشراء
    const [orderRows] = await connection.query(`SELECT * FROM purchase_order WHERE id = ? FOR UPDATE`, [id]);
    if (!orderRows.length) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'أمر الشراء غير موجود' });
    }
    const order = orderRows[0];
    if (order.state !== 'purchase') {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'يجب أن يكون أمر الشراء مؤكداً ليتم استلامه' });
    }

    // جلب إذن الاستلام المعلق
    const [pickings] = await connection.query(`
      SELECT * FROM stock_picking WHERE purchase_id = ? AND state != 'done' AND state != 'cancel' LIMIT 1
    `, [id]);

    if (!pickings.length) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'لا يوجد إذن استلام معلق لهذا الطلب، قد يكون تم استلامه مسبقاً' });
    }
    const picking = pickings[0];

    // جلب بنود أمر الشراء
    const [lines] = await connection.query(`
      SELECT * FROM purchase_order_line WHERE order_id = ?
    `, [id]);

    for (const line of lines) {
      const qtyToReceive = parseFloat(line.product_qty);
      const incomingPrice = parseFloat(line.price_unit);

      // جلب رصيد المادة وسعر تكلفتها الحالي
      const [ingRows] = await connection.query(`
        SELECT stock_quantity, cost_price FROM ingredients WHERE id = ? FOR UPDATE
      `, [line.ingredient_id]);

      if (ingRows.length > 0) {
        const currentQty = parseFloat(ingRows[0].stock_quantity) || 0;
        const currentCost = parseFloat(ingRows[0].cost_price) || 0;

        // حساب متوسط التكلفة المرجح الجديد (Moving Average Cost) طبقاً لمعيار Odoo AVCO
        let newCost = incomingPrice;
        if (currentQty + qtyToReceive > 0) {
          const totalVal = (currentQty * currentCost) + (qtyToReceive * incomingPrice);
          newCost = Math.round((totalVal / (currentQty + qtyToReceive)) * 100) / 100;
        }

        // تحديث رصيد المخزن ومتوسط الكلفة
        await connection.query(`
          UPDATE ingredients 
          SET stock_quantity = stock_quantity + ?, cost_price = ?
          WHERE id = ?
        `, [qtyToReceive, newCost, line.ingredient_id]);

        // تسجيل حركة إيداع في جدول المعاملات
        await connection.query(`
          INSERT INTO transactions (ingredient_id, quantity, type)
          VALUES (?, ?, 'deposit')
        `, [line.ingredient_id, qtyToReceive]);
      }

      // تحديث الكمية المستلمة في سطر أمر الشراء
      await connection.query(`
        UPDATE purchase_order_line
        SET qty_received = product_qty
        WHERE id = ?
      `, [line.id]);
    }

    // تحديث حالة إذن الاستلام إلى done
    await connection.query(`
      UPDATE stock_picking
      SET state = 'done', date_done = NOW()
      WHERE id = ?
    `, [picking.id]);

    await connection.query(`
      UPDATE stock_move
      SET state = 'done'
      WHERE picking_id = ?
    `, [picking.id]);

    await connection.commit();
    res.json({
      status: 'success',
      message: `تم استلام البضاعة في المخزن بنجاح وتحديث أرصدة المواد ومتوسط التكلفة.`
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في receiveOrder:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
//      6) إنشاء فاتورة المورد مع الترحيل المحاسبي الآلي (Create Vendor Bill)
// ===============================
exports.createVendorBill = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params; // purchase_order id

    const [orderRows] = await connection.query(`SELECT * FROM purchase_order WHERE id = ? FOR UPDATE`, [id]);
    if (!orderRows.length) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'أمر الشراء غير موجود' });
    }
    const order = orderRows[0];
    if (order.state !== 'purchase' && order.state !== 'done') {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'يجب أن يكون أمر الشراء مؤكداً لإنشاء الفاتورة' });
    }

    // التحقق هل الفاتورة منشأة مسبقاً
    const [existingBills] = await connection.query(`
      SELECT id, bill_number FROM vendor_bill WHERE purchase_id = ?
    `, [id]);
    if (existingBills.length > 0) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: `تم إنشاء فاتورة مسبقاً لهذا الطلب برقم: ${existingBills[0].bill_number}` });
    }

    // توليد رقم الفاتورة BILL/YEAR/XXXX
    const currentYear = new Date().getFullYear();
    const [countRows] = await connection.query(`
      SELECT COUNT(*) AS count FROM vendor_bill WHERE YEAR(created_at) = ?
    `, [currentYear]);
    const bSeq = String(countRows[0].count + 1).padStart(4, '0');
    const billNumber = `BILL/${currentYear}/${bSeq}`;

    const totalAmount = parseFloat(order.amount_total);

    // ============================================
    // الترحيل المحاسبي المزدوج الآلي (Odoo Journal Entry)
    // ============================================
    // دفتر يومية المشتريات PUR
    let [purJournal] = await connection.query(`SELECT id FROM account_journal WHERE code = 'PUR' LIMIT 1`);
    let journalId = purJournal[0]?.id;
    if (!journalId) {
      const [generalJournal] = await connection.query(`SELECT id FROM account_journal LIMIT 1`);
      journalId = generalJournal[0]?.id;
    }

    // حساب المخزون: 104000 (مدين Debit)
    const [invAcc] = await connection.query(`SELECT id FROM account_account WHERE code = '104000' LIMIT 1`);
    // حساب الموردين: 201000 (دائن Credit)
    const [suppAcc] = await connection.query(`SELECT id FROM account_account WHERE code = '201000' LIMIT 1`);

    let moveId = null;

    if (journalId && invAcc.length && suppAcc.length) {
      const [mCount] = await connection.query(`
        SELECT COUNT(*) AS count FROM account_move WHERE journal_id = ? AND YEAR(date) = ?
      `, [journalId, currentYear]);
      const mSeq = String(mCount[0].count + 1).padStart(4, '0');
      const moveName = `PUR/${currentYear}/${mSeq}`;

      // إدراج القيد المحاسبي
      const [moveRes] = await connection.query(`
        INSERT INTO account_move (name, date, ref, journal_id, state, total_amount, created_by)
        VALUES (?, CURDATE(), ?, ?, 'posted', ?, ?)
      `, [moveName, `${billNumber} - ${order.name}`, journalId, totalAmount, req.user?.id || null]);
      moveId = moveRes.insertId;

      // سطر المدين: مخزون المواد الغذائية والمشروبات
      await connection.query(`
        INSERT INTO account_move_line (move_id, account_id, name, debit, credit)
        VALUES (?, ?, ?, ?, 0.00)
      `, [moveId, invAcc[0].id, `استحقاق فاتورة مشتريات ${billNumber}`, totalAmount]);

      // سطر الدائن: ذمم الموردين
      await connection.query(`
        INSERT INTO account_move_line (move_id, account_id, name, debit, credit)
        VALUES (?, ?, ?, 0.00, ?)
      `, [moveId, suppAcc[0].id, `استحقاق فاتورة مشتريات ${billNumber}`, totalAmount]);
    }

    // إدراج فاتورة المورد
    const [billRes] = await connection.query(`
      INSERT INTO vendor_bill (
        bill_number, purchase_id, partner_id, bill_date, due_date,
        amount_untaxed, amount_total, amount_paid, payment_state, state, move_id
      ) VALUES (?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 14 DAY), ?, ?, 0.00, 'not_paid', 'posted', ?)
    `, [billNumber, id, order.partner_id, totalAmount, totalAmount, moveId]);

    // زيادة رصيد مديونية المورد
    await connection.query(`
      UPDATE res_partner SET balance = balance + ? WHERE id = ?
    `, [totalAmount, order.partner_id]);

    // تحديث حالة الفوترة في أمر الشراء إلى invoiced
    await connection.query(`
      UPDATE purchase_order SET invoice_status = 'invoiced', state = 'done' WHERE id = ?
    `, [id]);

    // تحديث سطر الفوترة في بنود أمر الشراء
    await connection.query(`
      UPDATE purchase_order_line SET qty_invoiced = product_qty WHERE order_id = ?
    `, [id]);

    await connection.commit();
    res.json({
      status: 'success',
      message: `تم إنشاء فاتورة المورد (${billNumber}) وترحيل القيد المحاسبي المزدوج تلقائياً.`,
      billNumber,
      billId: billRes.insertId,
      moveId
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في createVendorBill:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
//      7) فواتير الشراء وسداد الدفعات (Bills & Payments)
// ===============================
exports.getBills = async (req, res) => {
  try {
    const [bills] = await appPool.query(`
      SELECT 
        vb.*,
        rp.name AS partner_name,
        rp.ref AS partner_ref,
        rp.phone AS partner_phone,
        po.name AS purchase_order_name,
        am.name AS move_name
      FROM vendor_bill vb
      JOIN res_partner rp ON vb.partner_id = rp.id
      LEFT JOIN purchase_order po ON vb.purchase_id = po.id
      LEFT JOIN account_move am ON vb.move_id = am.id
      ORDER BY vb.bill_date DESC, vb.id DESC
      LIMIT 100
    `);
    res.json({ status: 'success', data: bills });
  } catch (err) {
    console.error('❌ خطأ في getBills:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.payBill = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();
    const { id } = req.params; // bill_id
    const { amount, payment_method = 'cash', notes } = req.body;

    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'مبلغ السداد يجب أن يكون رقماً موجباً' });
    }

    const [billRows] = await connection.query(`SELECT * FROM vendor_bill WHERE id = ? FOR UPDATE`, [id]);
    if (!billRows.length) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'الفاتورة غير موجودة' });
    }
    const bill = billRows[0];

    const remaining = parseFloat(bill.amount_total) - parseFloat(bill.amount_paid);
    if (payAmount > remaining + 0.01) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: `مبلغ السداد (${payAmount}) يتجاوز المبلغ المتبقي (${remaining})` });
    }

    // توليد رقم سند الدفع PAY/YEAR/XXXX
    const currentYear = new Date().getFullYear();
    const [payCount] = await connection.query(`
      SELECT COUNT(*) AS count FROM account_payment WHERE YEAR(created_at) = ?
    `, [currentYear]);
    const pSeq = String(payCount[0].count + 1).padStart(4, '0');
    const paymentNumber = `PAY/${currentYear}/${pSeq}`;

    // توليد قيد سداد الدفعة المحاسبي المزدوج
    // مدين: الموردين (201000)
    // دائن: الصندوق (101000) أو البنك (102000)
    const journalCode = payment_method === 'bank' ? 'BNK' : 'CSH';
    const cashAccCode = payment_method === 'bank' ? '102000' : '101000';

    const [payJournal] = await connection.query(`SELECT id FROM account_journal WHERE code = ? LIMIT 1`, [journalCode]);
    const [suppAcc] = await connection.query(`SELECT id FROM account_account WHERE code = '201000' LIMIT 1`);
    const [cashAcc] = await connection.query(`SELECT id FROM account_account WHERE code = ? LIMIT 1`, [cashAccCode]);

    let payMoveId = null;
    if (payJournal.length && suppAcc.length && cashAcc.length) {
      const [mCount] = await connection.query(`
        SELECT COUNT(*) AS count FROM account_move WHERE journal_id = ? AND YEAR(date) = ?
      `, [payJournal[0].id, currentYear]);
      const mSeq = String(mCount[0].count + 1).padStart(4, '0');
      const moveName = `${journalCode}/${currentYear}/${mSeq}`;

      const [moveRes] = await connection.query(`
        INSERT INTO account_move (name, date, ref, journal_id, state, total_amount, created_by)
        VALUES (?, CURDATE(), ?, ?, 'posted', ?, ?)
      `, [moveName, `سداد فاتورة ${bill.bill_number}`, payJournal[0].id, payAmount, req.user?.id || null]);
      payMoveId = moveRes.insertId;

      // مدين: حساب المورد (تخفيض الالتزام)
      await connection.query(`
        INSERT INTO account_move_line (move_id, account_id, name, debit, credit)
        VALUES (?, ?, ?, ?, 0.00)
      `, [payMoveId, suppAcc[0].id, `سداد دفعة لفاتورة ${bill.bill_number}`, payAmount]);

      // دائن: حساب الصندوق أو البنك (خروج نقدية)
      await connection.query(`
        INSERT INTO account_move_line (move_id, account_id, name, debit, credit)
        VALUES (?, ?, ?, 0.00, ?)
      `, [payMoveId, cashAcc[0].id, `سداد دفعة لفاتورة ${bill.bill_number}`, payAmount]);
    }

    // إدراج سند الدفع
    await connection.query(`
      INSERT INTO account_payment (payment_number, bill_id, partner_id, amount, payment_date, payment_method, move_id, notes)
      VALUES (?, ?, ?, ?, CURDATE(), ?, ?, ?)
    `, [paymentNumber, id, bill.partner_id, payAmount, payment_method, payMoveId, notes || null]);

    // تحديث الفاتورة
    const newPaid = parseFloat(bill.amount_paid) + payAmount;
    const newPaymentState = newPaid >= (parseFloat(bill.amount_total) - 0.01) ? 'paid' : 'partial';

    await connection.query(`
      UPDATE vendor_bill
      SET amount_paid = ?, payment_state = ?
      WHERE id = ?
    `, [newPaid, newPaymentState, id]);

    // تخفيض رصيد مديونية المورد
    await connection.query(`
      UPDATE res_partner SET balance = balance - ? WHERE id = ?
    `, [payAmount, bill.partner_id]);

    await connection.commit();
    res.json({
      status: 'success',
      message: `تم تسجيل سداد مبلغ ${payAmount} بنجاح وترحيل القيد المحاسبي.`,
      paymentNumber,
      paymentState: newPaymentState
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في payBill:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};
