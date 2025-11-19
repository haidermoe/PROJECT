/**
 * ======================================================
 * Setup Attendance Tables - إنشاء جداول البصمة
 * ======================================================
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupAttendanceTables() {
  let connection;
  
  try {
    console.log('🔵 بدء إنشاء جداول البصمة...');
    
    // الاتصال بقاعدة البيانات
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kitchen_inventory'
    });

    console.log('✅ تم الاتصال بقاعدة البيانات');

    // إنشاء جدول attendance_records
    console.log('🔵 جاري إنشاء جدول attendance_records...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT 'رقم الموظف',
        check_in_time DATETIME NOT NULL COMMENT 'وقت الدخول',
        check_out_time DATETIME NULL COMMENT 'وقت الخروج',
        work_hours DECIMAL(5,2) NULL COMMENT 'عدد ساعات العمل (بالساعات)',
        check_in_location VARCHAR(255) NULL COMMENT 'موقع الدخول (GPS)',
        check_out_location VARCHAR(255) NULL COMMENT 'موقع الخروج (GPS)',
        status ENUM('checked_in', 'checked_out') DEFAULT 'checked_in' COMMENT 'حالة البصمة',
        notes TEXT NULL COMMENT 'ملاحظات',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_check_in_time (check_in_time),
        INDEX idx_check_out_time (check_out_time),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='جدول سجلات البصمة'
    `);
    console.log('✅ تم إنشاء جدول attendance_records');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ تم إنشاء جدول البصمة بنجاح!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('❌ خطأ في إنشاء الجداول:', error.message);
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('⚠️ الجدول موجود بالفعل - هذا طبيعي');
    } else {
      console.error('❌ تفاصيل الخطأ:', error);
      console.error('❌ SQL State:', error.sqlState);
      console.error('❌ Error Code:', error.code);
      process.exit(1);
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ تم إغلاق الاتصال');
    }
  }
}

// تشغيل السكريبت
setupAttendanceTables()
  .then(() => {
    console.log('✅ تم إكمال إعداد الجداول بنجاح!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ فشل إعداد الجداول:', error);
    process.exit(1);
  });

