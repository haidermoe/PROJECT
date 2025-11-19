/**
 * ======================================================
 * Setup Leaves Tables - إنشاء جداول الإجازات
 * ======================================================
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupLeavesTables() {
  let connection;
  
  try {
    console.log('🔵 بدء إنشاء جداول الإجازات...');
    
    // الاتصال بقاعدة البيانات
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kitchen_inventory'
    });

    console.log('✅ تم الاتصال بقاعدة البيانات');

    // إنشاء جدول leave_requests
    console.log('🔵 جاري إنشاء جدول leave_requests...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT 'رقم الموظف',
        leave_type ENUM('annual', 'sick', 'mourning', 'weekly') NOT NULL COMMENT 'نوع الإجازة: سنوية، مرضية، حداد، أسبوعية',
        start_date DATE NOT NULL COMMENT 'تاريخ بداية الإجازة',
        end_date DATE NOT NULL COMMENT 'تاريخ نهاية الإجازة',
        total_days DECIMAL(5,2) NOT NULL COMMENT 'عدد أيام الإجازة',
        reason TEXT NULL COMMENT 'سبب الإجازة',
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'حالة الطلب',
        approved_by INT NULL COMMENT 'المدير الذي وافق على الطلب',
        approved_at DATETIME NULL COMMENT 'تاريخ الموافقة',
        rejection_reason TEXT NULL COMMENT 'سبب الرفض (إن وجد)',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_leave_type (leave_type),
        INDEX idx_start_date (start_date),
        INDEX idx_end_date (end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='جدول طلبات الإجازات'
    `);
    console.log('✅ تم إنشاء جدول leave_requests');

    // إنشاء جدول leave_balances
    console.log('🔵 جاري إنشاء جدول leave_balances...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS leave_balances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT 'رقم الموظف',
        year INT NOT NULL COMMENT 'السنة',
        annual_leave_balance DECIMAL(5,2) DEFAULT 22.00 COMMENT 'رصيد الإجازات السنوية (أقصى 22 يوم)',
        sick_leave_balance DECIMAL(5,2) DEFAULT 30.00 COMMENT 'رصيد الإجازات المرضية (أقصى 30 يوم)',
        annual_leave_used DECIMAL(5,2) DEFAULT 0.00 COMMENT 'الإجازات السنوية المستخدمة',
        sick_leave_used DECIMAL(5,2) DEFAULT 0.00 COMMENT 'الإجازات المرضية المستخدمة',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        UNIQUE KEY unique_user_year (user_id, year),
        INDEX idx_user_id (user_id),
        INDEX idx_year (year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='جدول أرصدة الإجازات'
    `);
    console.log('✅ تم إنشاء جدول leave_balances');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ تم إنشاء جداول الإجازات بنجاح!');
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
setupLeavesTables()
  .then(() => {
    console.log('✅ تم إكمال إعداد الجداول بنجاح!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ فشل إعداد الجداول:', error);
    process.exit(1);
  });

