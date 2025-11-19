/**
 * ======================================================
 * Setup Waste Tables - إنشاء جداول الهدر
 * ======================================================
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupWasteTables() {
  let connection;
  
  try {
    console.log('🔵 بدء إنشاء جداول الهدر...');
    
    // الاتصال بقاعدة البيانات
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kitchen_inventory'
    });

    console.log('✅ تم الاتصال بقاعدة البيانات');

    // إنشاء جدول waste_records
    console.log('🔵 جاري إنشاء جدول waste_records...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS waste_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipe_id INT NULL COMMENT 'رقم الوصفة (إن وجدت)',
        ingredient_id INT NULL COMMENT 'رقم المادة (إن وجدت)',
        item_name VARCHAR(255) NOT NULL COMMENT 'اسم المادة/الوصفة',
        quantity DECIMAL(10,2) NOT NULL COMMENT 'كمية الهدر',
        unit VARCHAR(50) NULL COMMENT 'الوحدة',
        waste_type ENUM('spoilage', 'expired', 'damaged', 'overproduction', 'other') NOT NULL DEFAULT 'other' COMMENT 'نوع الهدر',
        reason TEXT NULL COMMENT 'سبب الهدر',
        waste_date DATETIME NOT NULL COMMENT 'تاريخ الهدر',
        recorded_by INT NOT NULL COMMENT 'المستخدم الذي سجل الهدر',
        approved_by INT NULL COMMENT 'المدير العام الذي وافق على الهدر',
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending' COMMENT 'حالة الموافقة',
        notes TEXT NULL COMMENT 'ملاحظات إضافية',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE SET NULL,
        INDEX idx_recipe_id (recipe_id),
        INDEX idx_ingredient_id (ingredient_id),
        INDEX idx_recorded_by (recorded_by),
        INDEX idx_waste_date (waste_date),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='جدول تسجيل الهدر'
    `);
    console.log('✅ تم إنشاء جدول waste_records');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ تم إنشاء جدول الهدر بنجاح!');
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
setupWasteTables()
  .then(() => {
    console.log('✅ تم إكمال إعداد الجداول بنجاح!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ فشل إعداد الجداول:', error);
    process.exit(1);
  });

