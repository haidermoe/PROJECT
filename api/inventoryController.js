/**
 * ======================================================
 * Inventory Controller - معالجة بيانات المخزن
 * ======================================================
 * 
 * يستخدم اتصال معزول لقاعدة البيانات الرئيسية
 */

// استيراد اتصال قاعدة البيانات الرئيسية (معزول)
const { appPool } = require('../database/appConnection');

// ===============================
//      جلب المواد
// ===============================
exports.getItems = async (req, res) => {
  try {
    const [rows] = await appPool.query(`
      SELECT id, name, unit, stock_quantity,
             CASE 
               WHEN stock_quantity <= 5 THEN 'low'
               ELSE 'good'
             END AS status
      FROM ingredients 
      ORDER BY id DESC
    `);
    
    // إضافة min_qty افتراضي إذا لم يكن موجوداً
    const items = rows.map(item => ({
      ...item,
      min_qty: item.min_qty || 5,
      quantity: item.stock_quantity
    }));
    
    res.json({ status: "success", data: items });
  } catch (err) {
    console.error('❌ خطأ في inventoryController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      المواد القليلة
// ===============================
exports.getLowStock = async (req, res) => {
  try {
    const [rows] = await appPool.query(`
      SELECT id, name, unit, stock_quantity
      FROM ingredients 
      WHERE stock_quantity <= 5
      ORDER BY stock_quantity ASC
    `);
    res.json({ status: "success", data: rows });
  } catch (err) {
    console.error('❌ خطأ في inventoryController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      KPI للواجهة
// ===============================
exports.getKPI = async (req, res) => {
  try {
    const [totalRows] = await appPool.query("SELECT COUNT(*) AS total_items FROM ingredients");
    const [lowRows] = await appPool.query("SELECT COUNT(*) AS low_stock FROM ingredients WHERE stock_quantity <= 5");
    const [todayOpsRows] = await appPool.query("SELECT COUNT(*) AS today_ops FROM transactions WHERE DATE(created_at)=CURDATE()");
    const [withdrawRows] = await appPool.query("SELECT SUM(quantity) AS total_withdraw FROM transactions WHERE type='withdraw'");

    res.json({
      status: "success",
      data: {
        total_items: totalRows[0]?.total_items || 0,
        low_stock: lowRows[0]?.low_stock || 0,
        today_ops: todayOpsRows[0]?.today_ops || 0,
        total_withdraw: withdrawRows[0]?.total_withdraw || 0
      }
    });

  } catch (err) {
    console.error('❌ خطأ في inventoryController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      الرسم – 7 أيام
// ===============================
exports.getChart = async (req, res) => {
  try {
    const days = [];
    const withdraw = [];
    const deposit = [];

    for (let i = 6; i >= 0; i--) {
      const [w] = await appPool.query(
        `SELECT SUM(quantity) AS total FROM transactions 
         WHERE type='withdraw' AND DATE(created_at)=CURDATE()-INTERVAL ? DAY`,
        [i]
      );
      const [d] = await appPool.query(
        `SELECT SUM(quantity) AS total FROM transactions 
         WHERE type='deposit' AND DATE(created_at)=CURDATE()-INTERVAL ? DAY`,
        [i]
      );

      days.push(`${7 - i} يوم`);
      withdraw.push(w[0].total || 0);
      deposit.push(d[0].total || 0);
    }

    res.json({
      status: "success",
      data: { days, withdraw, deposit }
    });
  } catch (err) {
    console.error('❌ خطأ في inventoryController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      إضافة مادة (فقط المدير والشيف)
// ===============================
exports.addItem = async (req, res) => {
  const { name, unit, quantity, min_qty } = req.body;
  const userRole = req.user?.role;
  
  // فقط المدير والشيف يمكنهم إضافة مواد
  if (userRole !== 'admin' && userRole !== 'kitchen_manager') {
    return res.json({ status: "error", message: "ليس لديك صلاحية لإضافة مواد" });
  }
  
  if (!name || !unit || quantity === undefined) {
    return res.json({ status: "error", message: "الحقول المطلوبة: الاسم، الوحدة، الكمية" });
  }

  try {
    await appPool.query(
      "INSERT INTO ingredients (name, unit, stock_quantity) VALUES (?,?,?)",
      [name, unit, quantity || 0]
    );
    res.json({ status: "success", message: "تم إضافة المادة بنجاح" });
  } catch (err) {
    console.error('❌ خطأ في inventoryController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      تعديل مادة (فقط المدير والشيف)
// ===============================
exports.editItem = async (req, res) => {
  const id = req.params.id;
  const { name, unit, quantity } = req.body;
  const userRole = req.user?.role;

  // فقط المدير والشيف يمكنهم تعديل مواد
  if (userRole !== 'admin' && userRole !== 'kitchen_manager') {
    return res.json({ status: "error", message: "ليس لديك صلاحية لتعديل المواد" });
  }

  try {
    await appPool.query(
      "UPDATE ingredients SET name=?, unit=?, stock_quantity=? WHERE id=?",
      [name, unit, quantity, id]
    );
    res.json({ status: "success", message: "تم تحديث المادة بنجاح" });
  } catch (err) {
    console.error('❌ خطأ في inventoryController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      حذف مادة (فقط المدير والشيف)
// ===============================
exports.deleteItem = async (req, res) => {
  const id = req.params.id;
  const userRole = req.user?.role;

  // فقط المدير والشيف يمكنهم حذف مواد
  if (userRole !== 'admin' && userRole !== 'kitchen_manager') {
    return res.json({ status: "error", message: "ليس لديك صلاحية لحذف المواد" });
  }

  try {
    await appPool.query("DELETE FROM ingredients WHERE id=?", [id]);
    res.json({ status: "success", message: "تم حذف المادة بنجاح" });
  } catch (err) {
    console.error('❌ خطأ في inventoryController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      سحب كمية
// ===============================
exports.withdraw = async (req, res) => {
  const id = req.params.id;
  const { qty } = req.body;

  try {
    await appPool.query(
      "UPDATE ingredients SET stock_quantity = stock_quantity - ? WHERE id = ?",
      [qty, id]
    );

    await appPool.query(
      "INSERT INTO transactions (ingredient_id, quantity, type) VALUES (?,?, 'withdraw')",
      [id, qty]
    );

    res.json({ status: "success" });
  } catch (err) {
    console.error('❌ خطأ في inventoryController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      إيداع كمية
// ===============================
exports.deposit = async (req, res) => {
  const id = req.params.id;
  const { qty } = req.body;

  try {
    await appPool.query(
      "UPDATE ingredients SET stock_quantity = stock_quantity + ? WHERE id = ?",
      [qty, id]
    );

    await appPool.query(
      "INSERT INTO transactions (ingredient_id, quantity, type) VALUES (?,?, 'deposit')",
      [id, qty]
    );

    res.json({ status: "success" });
  } catch (err) {
    console.error('❌ خطأ في inventoryController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};
