/**
 * ======================================================
 * Branches Controller - إدارة الشركات والفروع واللوجستيات المجمعة
 * Multi-Company & Multi-Branch Management (Odoo 19 Standard)
 * ======================================================
 */

const { appPool } = require('../database/appConnection');

// ===============================
// 1) جلب قائمة الفروع مع مؤشراتها التشغيلية
// ===============================
exports.getBranches = async (req, res) => {
  try {
    const [branches] = await appPool.query(`
      SELECT 
        b.*,
        (SELECT COUNT(*) FROM pos_stations s WHERE s.branch_id = b.id) AS stations_count,
        (SELECT COUNT(*) FROM pos_tables t JOIN pos_floors f ON t.floor_id = f.id WHERE f.branch_id = b.id) AS tables_count,
        (SELECT COUNT(*) FROM pos_orders o WHERE o.branch_id = b.id AND DATE(o.created_at) = CURDATE() AND o.status != 'cancelled') AS today_orders_count,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM pos_orders o WHERE o.branch_id = b.id AND DATE(o.created_at) = CURDATE() AND o.status = 'paid') AS today_sales,
        (SELECT COUNT(*) FROM ingredients i WHERE i.branch_id = b.id) AS inventory_items_count
      FROM branches b
      WHERE b.is_active = 1
      ORDER BY b.is_headquarters DESC, b.id ASC
    `);

    res.json({ status: 'success', data: branches });
  } catch (err) {
    console.error('❌ خطأ في getBranches:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 2) جلب بيانات فرع محدد
// ===============================
exports.getBranchById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await appPool.query('SELECT * FROM branches WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'الفرع غير موجود' });
    }
    res.json({ status: 'success', data: rows[0] });
  } catch (err) {
    console.error('❌ خطأ في getBranchById:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 3) إضافة فرع جديد
// ===============================
exports.createBranch = async (req, res) => {
  try {
    const {
      company_name,
      branch_name,
      branch_code,
      currency,
      is_headquarters,
      phone,
      address,
      manager_name
    } = req.body;

    if (!branch_name || !branch_code) {
      return res.status(400).json({ status: 'error', message: 'اسم الفرع وكود الفرع مطلوبان' });
    }

    const [existing] = await appPool.query('SELECT id FROM branches WHERE branch_code = ?', [branch_code]);
    if (existing.length) {
      return res.status(400).json({ status: 'error', message: 'كود الفرع مستخدم مسبقاً، يرجى اختيار كود فريد' });
    }

    const [result] = await appPool.query(
      `INSERT INTO branches 
        (company_name, branch_name, branch_code, currency, is_headquarters, phone, address, manager_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        company_name || 'مجموعة أركاف الدولية للمطاعم',
        branch_name,
        branch_code.toUpperCase(),
        currency || 'IQD',
        is_headquarters ? 1 : 0,
        phone || null,
        address || null,
        manager_name || null
      ]
    );

    const newBranchId = result.insertId;

    // تهيئة صالات افتراضية للفرع الجديد تلقائياً
    await appPool.query(
      `INSERT INTO pos_floors (name, sequence, branch_id) VALUES (?, 1, ?)`,
      [`الصالة الرئيسية - ${branch_name}`, newBranchId]
    );

    res.json({
      status: 'success',
      message: 'تم إنشاء الفرع بنجاح وتهيئة صالته الرئيسية',
      branchId: newBranchId
    });
  } catch (err) {
    console.error('❌ خطأ في createBranch:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 4) تعديل فرع
// ===============================
exports.updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      company_name,
      branch_name,
      branch_code,
      currency,
      is_headquarters,
      phone,
      address,
      manager_name,
      is_active
    } = req.body;

    await appPool.query(
      `UPDATE branches SET
        company_name = COALESCE(?, company_name),
        branch_name = COALESCE(?, branch_name),
        branch_code = COALESCE(?, branch_code),
        currency = COALESCE(?, currency),
        is_headquarters = COALESCE(?, is_headquarters),
        phone = COALESCE(?, phone),
        address = COALESCE(?, address),
        manager_name = COALESCE(?, manager_name),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        company_name,
        branch_name,
        branch_code ? branch_code.toUpperCase() : null,
        currency,
        is_headquarters !== undefined ? (is_headquarters ? 1 : 0) : null,
        phone,
        address,
        manager_name,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id
      ]
    );

    res.json({ status: 'success', message: 'تم تحديث بيانات الفرع بنجاح' });
  } catch (err) {
    console.error('❌ خطأ في updateBranch:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 5) إنشاء تحويل لوجستي بين الفروع (Inter-Branch Transfer)
// ===============================
exports.createInterBranchTransfer = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      from_branch_id,
      to_branch_id,
      ingredient_id,
      quantity,
      notes
    } = req.body;
    const userId = req.user?.id;
    const qty = parseFloat(quantity);

    if (!from_branch_id || !to_branch_id || !ingredient_id || isNaN(qty) || qty <= 0) {
      throw new Error('يرجى تحديد الفرع المرسل والمستلم والمادة والكمية المطلوبة بدقة');
    }

    if (parseInt(from_branch_id) === parseInt(to_branch_id)) {
      throw new Error('لا يمكن التحويل لنفس الفرع');
    }

    // فحص رصيد المادة بالفرع المرسل
    const [ingRows] = await connection.query(
      'SELECT id, name, unit, stock_quantity FROM ingredients WHERE id = ? FOR UPDATE',
      [ingredient_id]
    );

    if (!ingRows.length) {
      throw new Error('المادة غير موجودة');
    }

    const ing = ingRows[0];
    if (parseFloat(ing.stock_quantity) < qty) {
      throw new Error(`الرصيد المتوفر بالفرع المرسل (${ing.stock_quantity} ${ing.unit}) غير كافٍ لصرف (${qty} ${ing.unit})`);
    }

    // خصم الكمية من مخزن الفرع المرسل ووضعها في حالة شحن (In-Transit)
    await connection.query(
      'UPDATE ingredients SET stock_quantity = stock_quantity - ? WHERE id = ?',
      [qty, ingredient_id]
    );

    // تسجيل حركة سحب
    await connection.query(
      `INSERT INTO transactions (ingredient_id, type, quantity, user_id, notes, branch_id)
       VALUES (?, 'withdraw', ?, ?, ?, ?)`,
      [ingredient_id, qty, userId || null, `شحن لوجستي صادر إلى فرع #${to_branch_id} - ${notes || ''}`, from_branch_id]
    );

    // إنشاء رقم التحويل
    const transferNumber = `IBT-${Date.now().toString().slice(-6)}`;

    const [transferResult] = await connection.query(
      `INSERT INTO inter_branch_transfers 
        (transfer_number, from_branch_id, to_branch_id, ingredient_id, quantity, unit, status, notes, shipped_by, shipped_at)
       VALUES (?, ?, ?, ?, ?, ?, 'in_transit', ?, ?, NOW())`,
      [transferNumber, from_branch_id, to_branch_id, ingredient_id, qty, ing.unit, notes || null, userId || null]
    );

    await connection.commit();

    res.json({
      status: 'success',
      message: `تم شحن البضاعة برقم شحنة [ ${transferNumber} ]، البضاعة حالياً في الطريق (In Transit) بانتظار استلام الفرع المستلم.`,
      transferId: transferResult.insertId,
      transferNumber
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في createInterBranchTransfer:', err);
    res.status(400).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
// 6) تأكيد استلام الشحنة في الفرع المستلم
// ===============================
exports.receiveInterBranchTransfer = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const userId = req.user?.id;

    const [transfers] = await connection.query(
      'SELECT * FROM inter_branch_transfers WHERE id = ? FOR UPDATE',
      [id]
    );

    if (!transfers.length) {
      throw new Error('سجل التحويل غير موجود');
    }

    const transfer = transfers[0];
    if (transfer.status !== 'in_transit') {
      throw new Error(`لا يمكن استلام شحنة بحالة: ${transfer.status}`);
    }

    // التحقق من وجود المادة في الفرع المستلم أو إضافتها برصيده
    const [origIng] = await connection.query('SELECT name, unit, material_type, recipe_id FROM ingredients WHERE id = ?', [transfer.ingredient_id]);
    const ingMeta = origIng[0];

    // فحص هل توجد مادة بنفس الاسم والوحدة مخصصة للفرع المستلم
    const [targetIng] = await connection.query(
      'SELECT id FROM ingredients WHERE name = ? AND branch_id = ?',
      [ingMeta.name, transfer.to_branch_id]
    );

    let destIngredientId;
    if (targetIng.length > 0) {
      destIngredientId = targetIng[0].id;
      await connection.query(
        'UPDATE ingredients SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [transfer.quantity, destIngredientId]
      );
    } else {
      // إنشاء رصيد للمادة في الفرع المستلم
      const [newIng] = await connection.query(
        `INSERT INTO ingredients (name, unit, stock_quantity, material_type, recipe_id, branch_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ingMeta.name, ingMeta.unit, transfer.quantity, ingMeta.material_type || 'raw', ingMeta.recipe_id || null, transfer.to_branch_id]
      );
      destIngredientId = newIng.insertId;
    }

    // تسجيل حركة إيداع
    await connection.query(
      `INSERT INTO transactions (ingredient_id, type, quantity, user_id, notes, branch_id)
       VALUES (?, 'deposit', ?, ?, ?, ?)`,
      [destIngredientId, transfer.quantity, userId || null, `استلام شحنة واردة برقم [${transfer.transfer_number}] من فرع #${transfer.from_branch_id}`, transfer.to_branch_id]
    );

    // تحديث حالة الشحنة
    await connection.query(
      `UPDATE inter_branch_transfers SET
        status = 'received',
        received_by = ?,
        received_at = NOW()
       WHERE id = ?`,
      [userId || null, id]
    );

    await connection.commit();

    res.json({
      status: 'success',
      message: `تم تأكيد استلام الشحنة #${transfer.transfer_number} بنجاح وإيداع الكمية (${transfer.quantity} ${transfer.unit}) في مخزن الفرع المستلم.`
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في receiveInterBranchTransfer:', err);
    res.status(400).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
// 7) قائمة التحويلات بين الفروع
// ===============================
exports.listInterBranchTransfers = async (req, res) => {
  try {
    const { status, branch_id } = req.query;

    let query = `
      SELECT 
        ibt.*,
        fb.branch_name AS from_branch_name,
        fb.branch_code AS from_branch_code,
        tb.branch_name AS to_branch_name,
        tb.branch_code AS to_branch_code,
        i.name AS ingredient_name
      FROM inter_branch_transfers ibt
      JOIN branches fb ON ibt.from_branch_id = fb.id
      JOIN branches tb ON ibt.to_branch_id = tb.id
      JOIN ingredients i ON ibt.ingredient_id = i.id
    `;

    const whereClauses = [];
    const params = [];

    if (status) {
      whereClauses.push('ibt.status = ?');
      params.push(status);
    }

    if (branch_id && branch_id !== 'all') {
      whereClauses.push('(ibt.from_branch_id = ? OR ibt.to_branch_id = ?)');
      params.push(branch_id, branch_id);
    }

    if (whereClauses.length > 0) {
      query += ' WHERE ' + whereClauses.join(' AND ');
    }

    query += ' ORDER BY ibt.created_at DESC LIMIT 100';

    const [rows] = await appPool.query(query, params);
    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('❌ خطأ في listInterBranchTransfers:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
// 8) لوحة القيادة المالية المجمعة لكل الفروع (Consolidated Holding Dashboard)
// ===============================
exports.getConsolidatedDashboard = async (req, res) => {
  try {
    // 1. إجمالي مبيعات وأرباح كل فرع
    const [branchStats] = await appPool.query(`
      SELECT 
        b.id AS branch_id,
        b.branch_name,
        b.branch_code,
        b.currency,
        b.is_headquarters,
        COALESCE(sales.total_revenue, 0) AS total_revenue,
        COALESCE(sales.total_orders, 0) AS total_orders,
        COALESCE(cogs.total_cogs, 0) AS total_cogs,
        (COALESCE(sales.total_revenue, 0) - COALESCE(cogs.total_cogs, 0)) AS gross_profit,
        COALESCE(inv.inventory_value, 0) AS inventory_value
      FROM branches b
      LEFT JOIN (
        SELECT branch_id, SUM(total_amount) AS total_revenue, COUNT(*) AS total_orders
        FROM pos_orders
        WHERE status = 'paid'
        GROUP BY branch_id
      ) sales ON b.id = sales.branch_id
      LEFT JOIN (
        SELECT m.branch_id, SUM(l.debit) AS total_cogs
        FROM account_move m
        JOIN account_move_line l ON m.id = l.move_id
        JOIN account_account a ON l.account_id = a.id
        WHERE m.state = 'posted' AND a.account_type = 'expense_direct_cost'
        GROUP BY m.branch_id
      ) cogs ON b.id = cogs.branch_id
      LEFT JOIN (
        SELECT branch_id, SUM(stock_quantity * 5000) AS inventory_value
        FROM ingredients
        GROUP BY branch_id
      ) inv ON b.id = inv.branch_id
      WHERE b.is_active = 1
      ORDER BY total_revenue DESC
    `);

    // إجماليات المجموعة القابضة
    const groupRevenue = branchStats.reduce((sum, b) => sum + parseFloat(b.total_revenue || 0), 0);
    const groupOrders = branchStats.reduce((sum, b) => sum + parseInt(b.total_orders || 0), 0);
    const groupCOGS = branchStats.reduce((sum, b) => sum + parseFloat(b.total_cogs || 0), 0);
    const groupGrossProfit = groupRevenue - groupCOGS;
    const groupInventoryValue = branchStats.reduce((sum, b) => sum + parseFloat(b.inventory_value || 0), 0);

    // حساب نسبة مساهمة كل فرع في المبيعات
    const formattedBranchStats = branchStats.map(b => {
      const rev = parseFloat(b.total_revenue) || 0;
      const share = groupRevenue > 0 ? ((rev / groupRevenue) * 100).toFixed(1) : 0;
      return {
        ...b,
        revenue_share_percentage: parseFloat(share)
      };
    });

    res.json({
      status: 'success',
      data: {
        holding_summary: {
          company_name: 'مجموعة أركاف القابضة (Arcave Restaurant Group)',
          total_branches: branchStats.length,
          group_revenue: groupRevenue,
          group_orders: groupOrders,
          group_cogs: groupCOGS,
          group_gross_profit: groupGrossProfit,
          group_inventory_value: groupInventoryValue,
          currency: 'IQD'
        },
        branches: formattedBranchStats
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getConsolidatedDashboard:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};
