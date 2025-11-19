/**
 * ======================================================
 * Approval Controller - معالجة طلبات الموافقات
 * ======================================================
 * 
 * يستخدم اتصال معزول لقاعدة البيانات الرئيسية
 */

// استيراد اتصال قاعدة البيانات الرئيسية (معزول)
const { appPool } = require('../database/appConnection');

// ===============================
//      طلب موافقة على تعديل وصفة
// ===============================
exports.requestApproval = async (req, res) => {
  try {
    const { recipe_id, changes_data } = req.body;
    const requested_by = req.user.id;

    if (!recipe_id || !changes_data) {
      return res.json({ status: "error", message: "المعلومات المطلوبة غير مكتملة" });
    }

    // التحقق من أن المستخدم ليس مدير (المدير لا يحتاج موافقة)
    if (req.user.role === 'admin') {
      return res.json({ status: "error", message: "المدير لا يحتاج موافقة" });
    }

    await appPool.query(
      `INSERT INTO recipe_approval_requests (recipe_id, requested_by, changes_data, status)
       VALUES (?, ?, ?, 'pending')`,
      [recipe_id, requested_by, JSON.stringify(changes_data)]
    );

    res.json({ status: "success", message: "تم إرسال طلب الموافقة بنجاح" });
  } catch (err) {
    console.error('❌ خطأ في approvalController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      جلب طلبات الموافقة (للمدير)
// ===============================
exports.getApprovalRequests = async (req, res) => {
  try {
    // استخدام اتصال معزول لقاعدة بيانات المصادقة
    const { authPool } = require('../database/authConnection');

    const [rows] = await appPool.query(`
      SELECT rar.*, 
             r.name AS recipe_name
      FROM recipe_approval_requests rar
      JOIN recipes r ON rar.recipe_id = r.id
      WHERE rar.status = 'pending'
      ORDER BY rar.created_at DESC
    `);

    // جلب أسماء المستخدمين من auth_db
    for (let row of rows) {
      try {
        const [users1] = await authPool.query("SELECT username FROM users WHERE id = ?", [row.requested_by]);
        row.requested_by_name = users1[0]?.username || 'غير معروف';
        
        if (row.approved_by) {
          const [users2] = await authPool.query("SELECT username FROM users WHERE id = ?", [row.approved_by]);
          row.approved_by_name = users2[0]?.username || 'غير معروف';
        }
      } catch (userErr) {
        console.error('❌ خطأ في جلب اسم المستخدم:', userErr);
        row.requested_by_name = 'غير معروف';
        row.approved_by_name = 'غير معروف';
      }
    }

    res.json({ status: "success", data: rows });
  } catch (err) {
    console.error('❌ خطأ في getApprovalRequests:', err);
    res.json({ status: "error", message: err.message });
  }
};

// ===============================
//      الموافقة على طلب تعديل
// ===============================
exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const approved_by = req.user.id;

    // جلب بيانات الطلب
    const [requests] = await appPool.query(
      "SELECT * FROM recipe_approval_requests WHERE id = ? AND status = 'pending'",
      [id]
    );

    if (requests.length === 0) {
      return res.json({ status: "error", message: "الطلب غير موجود أو تم معالجته" });
    }

    const request = requests[0];
    const changes = JSON.parse(request.changes_data);

    // تطبيق التغييرات على الوصفة
    await appPool.query(
      "UPDATE recipes SET name = ?, description = ?, visible_to_employees = ? WHERE id = ?",
      [changes.name, changes.description, changes.visible_to_employees ? 1 : 0, request.recipe_id]
    );

    // تحديث حالة الطلب
    await appPool.query(
      "UPDATE recipe_approval_requests SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?",
      [approved_by, id]
    );

    res.json({ status: "success", message: "تم الموافقة على التعديل وتطبيقه" });
  } catch (err) {
    console.error('❌ خطأ في approvalController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      رفض طلب تعديل
// ===============================
exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const approved_by = req.user.id;

    await appPool.query(
      "UPDATE recipe_approval_requests SET status = 'rejected', approved_by = ?, approved_at = NOW() WHERE id = ?",
      [approved_by, id]
    );

    res.json({ status: "success", message: "تم رفض الطلب" });
  } catch (err) {
    console.error('❌ خطأ في approvalController:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

