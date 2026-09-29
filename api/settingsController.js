/**
 * ======================================================
 * Settings Controller - معالجة إعدادات النظام
 * ======================================================
 */

// استيراد اتصال قاعدة البيانات الرئيسية
const { appPool } = require('../database/appConnection');

// ===============================
//      إنشاء جدول settings تلقائياً
// ===============================
async function ensureSettingsTableExists(connection) {
  try {
    const [tables] = await connection.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'settings'`
    );

    if (tables[0].count === 0) {
      console.log('⚠️ جدول settings غير موجود، جاري إنشائه...');
      await connection.query(`
        CREATE TABLE settings (
          id INT AUTO_INCREMENT PRIMARY KEY,
          setting_key VARCHAR(100) NOT NULL UNIQUE,
          setting_value TEXT,
          description VARCHAR(255),
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          updated_by INT,
          INDEX idx_setting_key (setting_key)
        ) ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
        COLLATE=utf8mb4_unicode_ci
      `);

      await connection.query(`
        INSERT INTO settings (setting_key, setting_value, description) VALUES
          ('checkin_location_latitude', NULL, 'خط عرض موقع تسجيل الدخول'),
          ('checkin_location_longitude', NULL, 'خط طول موقع تسجيل الدخول'),
          ('checkin_location_radius', '100', 'قطر المساحة المسموح بها لتسجيل الدخول (بالمتر)'),
          ('work_hours_start', '08:00', 'بداية ساعات العمل (HH:MM)'),
          ('work_hours_end', '17:00', 'نهاية ساعات العمل (HH:MM)')
      `);
      console.log('✅ تم إنشاء جدول settings والإعدادات الافتراضية بنجاح');
    }
  } catch (err) {
    console.error('❌ خطأ في إنشاء جدول settings:', err);
    throw err;
  }
}

// ===============================
//      جلب جميع الإعدادات
// ===============================
exports.getSettings = async (req, res) => {
  try {
    console.log('🔵 getSettings: جلب جميع الإعدادات');
    
    const connection = await appPool.getConnection();
    try {
      await ensureSettingsTableExists(connection);
    } finally {
      connection.release();
    }

    const [rows] = await appPool.query(
      `SELECT setting_key, setting_value, description, updated_at, updated_by 
       FROM settings`
    );

    const settingsObj = {};
    rows.forEach(row => {
      settingsObj[row.setting_key] = row.setting_value;
    });

    console.log('✅ getSettings: تم جلب الإعدادات بنجاح');
    res.json({
      status: "success",
      data: settingsObj
    });
  } catch (err) {
    console.error('❌ خطأ في getSettings:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في جلب الإعدادات'
    });
  }
};

// ===============================
//      تحديث الإعدادات
// ===============================
exports.updateSettings = async (req, res) => {
  try {
    console.log('🔵 updateSettings: تحديث الإعدادات');
    const userId = req.user?.id;
    const updates = [];
    const allowedKeys = [
      'checkin_location_latitude',
      'checkin_location_longitude',
      'checkin_location_radius',
      'work_hours_start',
      'work_hours_end'
    ];

    for (const key of allowedKeys) {
      const value = req.body[key];

      if (value !== undefined && value !== null && value !== '') {
        if (key.includes('latitude')) {
          const numValue = parseFloat(value);
          if (isNaN(numValue) || numValue < -90 || numValue > 90) {
            return res.status(400).json({
              status: "error",
              message: `${key} يجب أن يكون رقم بين -90 و 90`
            });
          }
        } else if (key.includes('longitude')) {
          const numValue = parseFloat(value);
          if (isNaN(numValue) || numValue < -180 || numValue > 180) {
            return res.status(400).json({
              status: "error",
              message: `${key} يجب أن يكون رقم بين -180 و 180`
            });
          }
        } else if (key === 'checkin_location_radius') {
          const numValue = parseFloat(value);
          if (isNaN(numValue) || numValue <= 0 || numValue > 10000) {
            return res.status(400).json({
              status: "error",
              message: `قطر المساحة يجب أن يكون رقم بين 1 و 10000 متر`
            });
          }
        } else if (key === 'work_hours_start' || key === 'work_hours_end') {
          const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
          if (!timeRegex.test(value)) {
            return res.status(400).json({
              status: "error",
              message: `صيغة الوقت غير صحيحة. يجب أن تكون بصيغة HH:MM (مثلاً: 08:00)`
            });
          }
        }
      }
      updates.push([key, value === null || value === '' ? null : String(value), userId]);
    }

    const connection = await appPool.getConnection();
    try {
      await ensureSettingsTableExists(connection);
      await connection.beginTransaction();

      const now = new Date();
      for (const [key, value, updatedBy] of updates) {
        await connection.execute(
          `INSERT INTO settings (setting_key, setting_value, updated_by, updated_at)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           setting_value = ?,
           updated_by = ?,
           updated_at = ?`,
          [key, value, updatedBy, now, value, updatedBy, now]
        );
      }

      await connection.commit();
      console.log('✅ updateSettings: تم تحديث الإعدادات بنجاح');

      res.json({
        status: "success",
        message: "تم تحديث الإعدادات بنجاح"
      });
    } catch (dbErr) {
      await connection.rollback();
      throw dbErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ خطأ في updateSettings:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في تحديث الإعدادات'
    });
  }
};

