/**
 * ======================================================
 * Waste Controller - معالجة تسجيل وعرض الهدر
 * ======================================================
 */

// استيراد اتصال قاعدة البيانات الرئيسية (معزول)
const { appPool } = require('../database/appConnection');
// استيراد اتصال قاعدة بيانات المصادقة (للمستخدمين)
const { authPool } = require('../database/authConnection');
// استيراد دالة إنشاء الإشعارات
const { createNotification } = require('./notificationsController');

// ===============================
//      تسجيل هدر جديد (مدير المطبخ)
// ===============================
exports.addWaste = async (req, res) => {
  try {
    console.log('🔵 addWaste: بدء تسجيل هدر جديد');
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // فقط مدير المطبخ يمكنه تسجيل الهدر
    if (userRole !== 'kitchen_manager' && userRole !== 'admin') {
      return res.status(403).json({
        status: "error",
        message: "ليس لديك صلاحية لتسجيل الهدر"
      });
    }

    const {
      recipe_id,
      ingredient_id,
      item_name,
      quantity,
      unit,
      waste_type,
      reason,
      waste_date,
      notes
    } = req.body;

    // التحقق من البيانات المطلوبة
    if (!item_name || !quantity || !waste_date) {
      return res.status(400).json({
        status: "error",
        message: "الحقول المطلوبة: item_name, quantity, waste_date"
      });
    }

    // إدراج الهدر في قاعدة البيانات
    const connection = await appPool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        `INSERT INTO waste_records 
         (recipe_id, ingredient_id, item_name, quantity, unit, waste_type, reason, waste_date, recorded_by, notes, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          recipe_id || null,
          ingredient_id || null,
          item_name,
          parseFloat(quantity),
          unit || null,
          waste_type || 'other',
          reason || null,
          new Date(waste_date),
          userId,
          notes || null
        ]
      );

      await connection.commit();

      const wasteId = result.insertId;
      console.log('✅ addWaste: تم تسجيل الهدر بنجاح:', wasteId);

      // إذا كان الطلب من kitchen_manager، أرسل إشعار للمدير العام
      if (userRole === 'kitchen_manager') {
        try {
          // جلب جميع المديرين العامين
          const [adminRows] = await authPool.query(
            `SELECT id FROM users WHERE role = 'admin' AND is_active = 1`
          );
          
          // إرسال إشعار لكل مدير عام
          for (const admin of adminRows) {
            await createNotification(
              admin.id,
              'waste_request',
              wasteId,
              'طلب موافقة على هدر جديد',
              `تم إرسال طلب موافقة على هدر: ${item_name} - الكمية: ${quantity} ${unit || ''}`
            );
          }
        } catch (notifErr) {
          console.error('⚠️ خطأ في إرسال الإشعار:', notifErr);
          // لا نوقف العملية إذا فشل الإشعار
        }
      }

      res.json({
        status: "success",
        message: "تم تسجيل الهدر بنجاح وتم إرساله للمدير العام للموافقة",
        data: { id: wasteId }
      });
    } catch (dbErr) {
      await connection.rollback();
      throw dbErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ خطأ في addWaste:', err);
    console.error('❌ تفاصيل الخطأ:', err.message);
    console.error('❌ SQL State:', err.sqlState);
    console.error('❌ Error Code:', err.code);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في تسجيل الهدر'
    });
  }
};

// ===============================
//      جلب جميع سجلات الهدر (للمدير العام)
// ===============================
exports.getWasteRecords = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    // المدير العام يرى كل السجلات
    // مدير المطبخ يرى فقط السجلات التي سجلها
    let query = `SELECT wr.*, 
                 r.item_name AS recipe_name, r.reference AS recipe_reference,
                 i.name AS ingredient_name, i.unit AS ingredient_unit
                 FROM waste_records wr
                 LEFT JOIN recipes r ON wr.recipe_id = r.id
                 LEFT JOIN ingredients i ON wr.ingredient_id = i.id
                 WHERE 1=1`;
    const params = [];

    if (userRole === 'kitchen_manager') {
      query += ' AND wr.recorded_by = ?';
      params.push(userId);
    }

    const { status, start_date, end_date, waste_type } = req.query;

    if (status) {
      query += ' AND wr.status = ?';
      params.push(status);
    }

    if (start_date) {
      query += ' AND DATE(wr.waste_date) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(wr.waste_date) <= ?';
      params.push(end_date);
    }

    if (waste_type) {
      query += ' AND wr.waste_type = ?';
      params.push(waste_type);
    }

    query += ' ORDER BY wr.waste_date DESC, wr.created_at DESC LIMIT 100';

    const [rows] = await appPool.query(query, params);

    // جلب أسماء المستخدمين من auth_db
    const userIds = [...new Set([
      ...rows.map(row => row.recorded_by),
      ...rows.map(row => row.approved_by).filter(id => id)
    ])];
    const userMap = {};
    
    if (userIds.length > 0) {
      try {
        const placeholders = userIds.map(() => '?').join(',');
        const [userRows] = await authPool.query(
          `SELECT id, username, full_name FROM users WHERE id IN (${placeholders})`,
          userIds
        );
        userRows.forEach(user => {
          userMap[user.id] = user.full_name || user.username;
        });
      } catch (userErr) {
        console.error('⚠️ خطأ في جلب أسماء المستخدمين:', userErr);
      }
    }

    // إضافة أسماء المستخدمين
    const wasteRecords = rows.map(row => ({
      ...row,
      recorded_by_name: userMap[row.recorded_by] || 'غير معروف',
      approved_by_name: row.approved_by ? (userMap[row.approved_by] || 'غير معروف') : null
    }));

    res.json({
      status: "success",
      data: wasteRecords
    });
  } catch (err) {
    console.error('❌ خطأ في getWasteRecords:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      الموافقة/رفض الهدر (المدير العام فقط)
// ===============================
exports.approveWaste = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approve' or 'reject'
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // فقط المدير العام يمكنه الموافقة/الرفض
    if (userRole !== 'admin') {
      return res.status(403).json({
        status: "error",
        message: "ليس لديك صلاحية للموافقة على الهدر"
      });
    }

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({
        status: "error",
        message: "action يجب أن يكون 'approve' أو 'reject'"
      });
    }

    const status = action === 'approve' ? 'approved' : 'rejected';

    const [result] = await appPool.execute(
      `UPDATE waste_records 
       SET status = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [status, userId, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: "error",
        message: "سجل الهدر غير موجود"
      });
    }

    console.log(`✅ approveWaste: تم ${action === 'approve' ? 'الموافقة' : 'الرفض'} على الهدر رقم ${id}`);

    res.json({
      status: "success",
      message: action === 'approve' ? "تم الموافقة على الهدر" : "تم رفض الهدر"
    });
  } catch (err) {
    console.error('❌ خطأ في approveWaste:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      إلغاء طلب هدر
// ===============================
exports.cancelWaste = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const { id } = req.params;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "المستخدم غير معروف"
      });
    }

    // جلب سجل الهدر
    const [wasteRows] = await appPool.query(
      `SELECT * FROM waste_records WHERE id = ?`,
      [id]
    );

    if (wasteRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "سجل الهدر غير موجود"
      });
    }

    const waste = wasteRows[0];

    // التحقق من أن السجل ملك المستخدم (kitchen_manager) أو admin
    if (waste.recorded_by !== userId && userRole !== 'admin') {
      return res.status(403).json({
        status: "error",
        message: "ليس لديك صلاحية لإلغاء هذا السجل"
      });
    }

    // التحقق من أن السجل في حالة pending
    if (waste.status !== 'pending') {
      const statusNames = {
        'approved': 'تمت الموافقة عليه',
        'rejected': 'تم رفضه',
        'cancelled': 'تم إلغاؤه مسبقاً'
      };
      return res.status(400).json({
        status: "error",
        message: `لا يمكن إلغاء السجل. السجل ${statusNames[waste.status] || 'تم معالجته مسبقاً'}`
      });
    }

    // تحديث حالة السجل إلى cancelled
    console.log('🔵 cancelWaste: جاري تحديث حالة السجل إلى cancelled...', id);
    const [updateResult] = await appPool.execute(
      `UPDATE waste_records 
       SET status = 'cancelled', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id]
    );

    console.log('🔵 cancelWaste: نتيجة التحديث:', updateResult);

    if (updateResult.affectedRows === 0) {
      console.error('❌ cancelWaste: لم يتم تحديث أي صف');
      return res.status(500).json({
        status: "error",
        message: "فشل تحديث حالة السجل"
      });
    }

    // إرسال إشعار للمدير العام
    try {
      const [userRows] = await authPool.query(
        `SELECT username, full_name FROM users WHERE id = ?`,
        [userId]
      );
      
      const user = userRows[0];
      const userName = user?.full_name || user?.username || 'مستخدم';
      
      // جلب جميع المديرين العامين
      const [adminRows] = await authPool.query(
        `SELECT id FROM users WHERE role = 'admin' AND is_active = 1`
      );
      
      // إرسال إشعار لكل مدير عام
      for (const admin of adminRows) {
        await createNotification(
          admin.id,
          'waste_request',
          id,
          'تم إلغاء طلب هدر',
          `تم إلغاء طلب هدر: ${waste.item_name} - الكمية: ${waste.quantity} ${waste.unit || ''} من ${userName}`
        );
      }
    } catch (notifErr) {
      console.error('⚠️ خطأ في إرسال الإشعار:', notifErr);
      // لا نوقف العملية إذا فشل الإشعار
    }

    console.log('✅ cancelWaste: تم إلغاء سجل الهدر بنجاح:', id);

    res.json({
      status: "success",
      message: "تم إلغاء طلب الهدر بنجاح"
    });
  } catch (err) {
    console.error('❌ خطأ في cancelWaste:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في إلغاء طلب الهدر'
    });
  }
};

// ===============================
//      إحصائيات الهدر
// ===============================
exports.getWasteStats = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.role === 'kitchen_manager' ? req.user?.id : null;

    let query = `SELECT 
                 COUNT(*) AS total_records,
                 SUM(quantity) AS total_quantity,
                 COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count,
                 COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_count,
                 COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected_count
                 FROM waste_records
                 WHERE 1=1`;
    const params = [];

    if (userId) {
      query += ' AND recorded_by = ?';
      params.push(userId);
    }

    const { start_date, end_date } = req.query;

    if (start_date) {
      query += ' AND DATE(waste_date) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(waste_date) <= ?';
      params.push(end_date);
    }

    const [rows] = await appPool.query(query, params);
    const stats = rows[0];

    res.json({
      status: "success",
      data: {
        total_records: parseInt(stats.total_records) || 0,
        total_quantity: parseFloat(stats.total_quantity) || 0,
        pending_count: parseInt(stats.pending_count) || 0,
        approved_count: parseInt(stats.approved_count) || 0,
        rejected_count: parseInt(stats.rejected_count) || 0
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getWasteStats:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

