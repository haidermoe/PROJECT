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
    const branchId = req.query.branch_id || req.headers['x-branch-id'];
    let query = `
      SELECT i.id, i.name, i.unit, i.stock_quantity, i.branch_id,
             COALESCE(i.material_type, 'raw') AS material_type,
             i.recipe_id,
             COALESCE(r.item_name, r.name) AS production_recipe_name,
             CASE 
               WHEN i.stock_quantity <= 5 THEN 'low'
               ELSE 'good'
             END AS status
      FROM ingredients i
      LEFT JOIN recipes r ON i.recipe_id = r.id
    `;
    const params = [];
    if (branchId && branchId !== 'all') {
      query += ` WHERE (i.branch_id = ? OR (i.branch_id IS NULL AND ? = 1))`;
      params.push(parseInt(branchId), parseInt(branchId));
    }
    query += ` ORDER BY i.id DESC`;

    const [rows] = await appPool.query(query, params);
    
    // إضافة min_qty افتراضي إذا لم يكن موجوداً
    const items = rows.map(item => ({
      ...item,
      min_qty: item.min_qty || 5,
      quantity: parseFloat(item.stock_quantity) || 0
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
      SELECT id, name, unit, stock_quantity, COALESCE(material_type, 'raw') AS material_type
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
  const { name, unit, quantity, min_qty, material_type, recipe_id } = req.body;
  const userRole = req.user?.role;
  
  // فقط المدير والشيف يمكنهم إضافة مواد
  if (userRole !== 'admin' && userRole !== 'kitchen_manager' && userRole !== 'manager') {
    return res.json({ status: "error", message: "ليس لديك صلاحية لإضافة مواد" });
  }
  
  if (!name || !unit || quantity === undefined) {
    return res.json({ status: "error", message: "الحقول المطلوبة: الاسم، الوحدة، الكمية" });
  }

  const finalType = material_type === 'manufactured' ? 'manufactured' : 'raw';
  const finalRecipeId = finalType === 'manufactured' && recipe_id ? parseInt(recipe_id) : null;
  const branchId = req.body.branch_id || req.headers['x-branch-id'] || 1;

  try {
    await appPool.query(
      "INSERT INTO ingredients (name, unit, stock_quantity, material_type, recipe_id, branch_id) VALUES (?,?,?,?,?,?)",
      [name, unit, parseFloat(quantity) || 0, finalType, finalRecipeId, parseInt(branchId)]
    );
    res.json({ status: "success", message: "تم إضافة المادة بنجاح وتحديد تصنيفها والفرع" });
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
  const { name, unit, quantity, material_type, recipe_id } = req.body;
  const userRole = req.user?.role;

  // فقط المدير والشيف يمكنهم تعديل مواد
  if (userRole !== 'admin' && userRole !== 'kitchen_manager' && userRole !== 'manager') {
    return res.json({ status: "error", message: "ليس لديك صلاحية لتعديل المواد" });
  }

  const finalType = material_type === 'manufactured' ? 'manufactured' : 'raw';
  const finalRecipeId = finalType === 'manufactured' && recipe_id ? parseInt(recipe_id) : null;

  try {
    await appPool.query(
      "UPDATE ingredients SET name=?, unit=?, stock_quantity=?, material_type=?, recipe_id=? WHERE id=?",
      [name, unit, parseFloat(quantity) || 0, finalType, finalRecipeId, id]
    );
    res.json({ status: "success", message: "تم تحديث المادة وتصنيفها بنجاح" });
  } catch (err) {
    console.error('❌ خطأ في inventoryController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      تحضير دفعة إنتاجية لمادة مصنعة (Batch Prep / Production)
// ===============================
exports.produceBatch = async (req, res) => {
  const { ingredientId, quantityToProduce } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const qty = parseFloat(quantityToProduce);

  if (userRole !== 'admin' && userRole !== 'kitchen_manager' && userRole !== 'manager' && userRole !== 'chef') {
    return res.status(403).json({ status: "error", message: "صلاحية التحضير والإنتاج متاحة للشيف ومدير المطبخ فقط" });
  }

  if (!ingredientId || isNaN(qty) || qty <= 0) {
    return res.status(400).json({ status: "error", message: "المادة والكمية المراد إنتاجها مطلوبة" });
  }

  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const [ingRows] = await connection.query(
      "SELECT * FROM ingredients WHERE id = ? FOR UPDATE",
      [ingredientId]
    );
    if (!ingRows.length) throw new Error("المادة غير موجودة بالمخزن");
    const ing = ingRows[0];

    if (ing.material_type !== 'manufactured') {
      throw new Error("هذه المادة مصنفة كمادة خام أولية، الإنتاج والتحضير متاح فقط للمواد المصنعة (Sub-recipes)");
    }
    if (!ing.recipe_id) {
      throw new Error("هذه المادة المصنعة غير مرتبطة ببطاقة وصفة تحضيرية (Recipe Card)");
    }

    const [recipeRows] = await connection.query("SELECT * FROM recipes WHERE id = ?", [ing.recipe_id]);
    if (!recipeRows.length) throw new Error("بطاقة وصفة التحضير غير موجودة");
    const recipe = recipeRows[0];
    const recipeYield = parseFloat(recipe.yield) || 1;
    const ratio = qty / recipeYield;

    const [rawIngredients] = await connection.query(`
      SELECT ri.ingredient_id, ri.quantity AS req_qty, i.name, i.stock_quantity, i.unit
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = ?
    `, [ing.recipe_id]);

    if (!rawIngredients.length) {
      throw new Error("وصفة التحضير لا تحتوي على مكونات مسجلة لخصمها");
    }

    // التحقق من توفر المواد الخام
    for (const raw of rawIngredients) {
      const needed = parseFloat(raw.req_qty) * ratio;
      if (parseFloat(raw.stock_quantity) < needed) {
        throw new Error(`رصيد المادة الخام (${raw.name}) غير كافٍ. المتوفر بالمخزن: ${raw.stock_quantity} ${raw.unit} بينما المطلوب للتحضير: ${needed.toFixed(2)} ${raw.unit}`);
      }
    }

    // خصم المواد الخام
    for (const raw of rawIngredients) {
      const needed = parseFloat(raw.req_qty) * ratio;
      await connection.query(
        "UPDATE ingredients SET stock_quantity = stock_quantity - ? WHERE id = ?",
        [needed, raw.ingredient_id]
      );
      await connection.query(
        "INSERT INTO transactions (ingredient_id, type, quantity, user_id, notes) VALUES (?, 'withdraw', ?, ?, ?)",
        [raw.ingredient_id, needed, userId || null, `استهلاك تصنيع وتحضير دفعة (${qty} ${ing.unit}) من ${ing.name}`]
      );
    }

    // إضافة كمية المادة المنتجة
    await connection.query(
      "UPDATE ingredients SET stock_quantity = stock_quantity + ? WHERE id = ?",
      [qty, ingredientId]
    );
    await connection.query(
      "INSERT INTO transactions (ingredient_id, type, quantity, user_id, notes) VALUES (?, 'deposit', ?, ?, ?)",
      [ingredientId, qty, userId || null, `إنتاج وتحضير دفعة تشغيلية وفق وصفة: ${recipe.item_name || recipe.name}`]
    );

    await connection.commit();
    res.json({
      status: "success",
      message: `تم تحضير دفعة (${qty} ${ing.unit}) من ${ing.name} بنجاح، وتم خصم جميع المكونات الأولية من المخزن.`
    });
  } catch (err) {
    await connection.rollback();
    console.error("❌ خطأ في produceBatch:", err);
    res.status(400).json({ status: "error", message: err.message });
  } finally {
    connection.release();
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

// ===============================
//      جلب رصيد مخزون السكاشن (العهد التشغيلية)
// ===============================
const {
  getStationInventories,
  transferToStation,
  calculateYieldCoverage,
  requestStationTransfer,
  approveStationTransfer,
  rejectStationTransfer,
  listStationTransferRequests
} = require('./stationStockService');

exports.getStationStocks = async (req, res) => {
  try {
    const data = await getStationInventories();
    res.json({ status: "success", data });
  } catch (err) {
    console.error('❌ خطأ في getStationStocks:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      حاسبة التغطية والإنتاجية المتوقعة (Yield Calculator)
// ===============================
exports.getStationCoverage = async (req, res) => {
  try {
    const { stationId, ingredientId, quantity } = req.body;
    if (!stationId || !ingredientId || !quantity) {
      return res.status(400).json({ status: "error", message: "المحطة والمادة والكمية مطلوبة للحساب" });
    }
    const data = await calculateYieldCoverage(stationId, ingredientId, quantity);
    res.json({ status: "success", data });
  } catch (err) {
    console.error('❌ خطأ في getStationCoverage:', err);
    res.status(400).json({ status: "error", message: err.message });
  }
};

// ===============================
//      تقديم طلب تحويل عهدة للسكشن (بعلم وموافقة مدير المطبخ)
// ===============================
exports.requestStationTransferStock = async (req, res) => {
  try {
    const { stationId, ingredientId, quantity, notes } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!stationId || !ingredientId || !quantity) {
      return res.status(400).json({ status: "error", message: "المحطة والمادة والكمية مطلوبة" });
    }

    const result = await requestStationTransfer({
      stationId,
      ingredientId,
      quantity,
      userId,
      userRole,
      notes
    });

    res.json({ status: "success", data: result, message: result.message });
  } catch (err) {
    console.error('❌ خطأ في requestStationTransferStock:', err);
    res.status(400).json({ status: "error", message: err.message });
  }
};

// ===============================
//      موافقة مدير المطبخ على طلب التحويل
// ===============================
exports.approveStationTransferRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const approvedBy = req.user?.id;
    const result = await approveStationTransfer(requestId, approvedBy);
    res.json({ status: "success", message: result.message });
  } catch (err) {
    console.error('❌ خطأ في approveStationTransferRequest:', err);
    res.status(400).json({ status: "error", message: err.message });
  }
};

// ===============================
//      رفض طلب التحويل
// ===============================
exports.rejectStationTransferRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const rejectedBy = req.user?.id;
    const { reason } = req.body;
    const result = await rejectStationTransfer(requestId, rejectedBy, reason);
    res.json({ status: "success", message: result.message });
  } catch (err) {
    console.error('❌ خطأ في rejectStationTransferRequest:', err);
    res.status(400).json({ status: "error", message: err.message });
  }
};

// ===============================
//      عرض طلبات صرف العهد
// ===============================
exports.getStationTransferRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const data = await listStationTransferRequests(status || null);
    res.json({ status: "success", data });
  } catch (err) {
    console.error('❌ خطأ في getStationTransferRequests:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

