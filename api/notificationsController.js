/**
 * ======================================================
 * Notifications Controller - معالجة الإشعارات
 * ======================================================
 */

const { appPool } = require('../database/appConnection');
const { authPool } = require('../database/authConnection');

// ===============================
//      إنشاء إشعار جديد
// ===============================
async function createNotification(userId, type, referenceId, title, message) {
  try {
    await appPool.execute(
      `INSERT INTO notifications (user_id, type, reference_id, title, message) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, type, referenceId, title, message]
    );
    console.log(`✅ تم إنشاء إشعار: ${type} - ${title} للمستخدم ${userId}`);
  } catch (err) {
    console.error('❌ خطأ في إنشاء الإشعار:', err);
  }
}

// ===============================
//      جلب جميع الإشعارات للمستخدم
// ===============================
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { unread_only, limit } = req.query;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "المستخدم غير معروف"
      });
    }

    let query = `SELECT * FROM notifications WHERE user_id = ?`;
    const params = [userId];

    if (unread_only === 'true') {
      query += ' AND is_read = 0';
    }

    query += ' ORDER BY created_at DESC';
    
    const limitValue = limit ? parseInt(limit) : 100;
    if (limitValue > 0 && limitValue <= 100) {
      query += ` LIMIT ${limitValue}`;
    } else {
      query += ' LIMIT 100';
    }

    console.log('🔵 getNotifications: تنفيذ الاستعلام:', query);
    console.log('🔵 getNotifications: المعاملات:', params);
    console.log('🔵 getNotifications: userId:', userId);

    const [rows] = await appPool.query(query, params);
    console.log('✅ getNotifications: تم جلب', rows.length, 'إشعار');

    res.json({
      status: "success",
      data: rows
    });
  } catch (err) {
    console.error('❌ خطأ في getNotifications:', err);
    console.error('❌ تفاصيل الخطأ:', err.message);
    console.error('❌ Stack:', err.stack);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في جلب الإشعارات'
    });
  }
};

// ===============================
//      تحديد الإشعار كمقروء
// ===============================
exports.markAsRead = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "المستخدم غير معروف"
      });
    }

    const [result] = await appPool.execute(
      `UPDATE notifications 
       SET is_read = 1, read_at = NOW() 
       WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: "error",
        message: "الإشعار غير موجود"
      });
    }

    res.json({
      status: "success",
      message: "تم تحديد الإشعار كمقروء"
    });
  } catch (err) {
    console.error('❌ خطأ في markAsRead:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      حذف إشعار
// ===============================
exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "المستخدم غير معروف"
      });
    }

    const [result] = await appPool.execute(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: "error",
        message: "الإشعار غير موجود"
      });
    }

    res.json({
      status: "success",
      message: "تم حذف الإشعار"
    });
  } catch (err) {
    console.error('❌ خطأ في deleteNotification:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      جلب عدد الإشعارات غير المقروءة
// ===============================
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "المستخدم غير معروف"
      });
    }

    const [rows] = await appPool.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );

    res.json({
      status: "success",
      data: {
        count: rows[0].count || 0
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getUnreadCount:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// تصدير دالة إنشاء الإشعار للاستخدام في controllers أخرى
exports.createNotification = createNotification;

