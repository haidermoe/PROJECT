/**
 * ======================================================
 * Setup Production Tables - إنشاء جداول الإنتاج والسحوبات
 * ======================================================
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupProductionTables() {
  let connection;
  
  try {
    console.log('🔵 بدء إنشاء جداول الإنتاج والسحوبات...');
    
    // الاتصال بقاعدة البيانات
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'kitchen_inventory'
    });

    console.log('✅ تم الاتصال بقاعدة البيانات');

    // إنشاء جدول recipe_productions
    console.log('🔵 جاري إنشاء جدول recipe_productions...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS recipe_productions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        recipe_id INT NOT NULL,
        production_quantity DECIMAL(10,2) NOT NULL COMMENT 'الكمية المنتجة (مثلاً 15 كيلو)',
        portion_weight DECIMAL(10,2) NOT NULL COMMENT 'وزن كل بورشن (مثلاً 1 كيلو)',
        production_date DATETIME NOT NULL COMMENT 'تاريخ الإنتاج الفعلي',
        expiry_date DATETIME NOT NULL COMMENT 'تاريخ الانتهاء (حسب shelf_life)',
        qr_code_data TEXT NOT NULL COMMENT 'بيانات QR Code (JSON)',
        qr_code_image LONGBLOB NULL COMMENT 'صورة QR Code (اختياري)',
        calculated_ingredients TEXT NULL COMMENT 'المقادير المحسوبة (JSON)',
        created_by INT NULL COMMENT 'المستخدم الذي أنشأ الإنتاج',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
        INDEX idx_recipe_id (recipe_id),
        INDEX idx_production_date (production_date),
        INDEX idx_expiry_date (expiry_date),
        INDEX idx_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='جدول إنتاج الوصفات مع QR Code'
    `);
    console.log('✅ تم إنشاء جدول recipe_productions');

    // إنشاء جدول recipe_withdrawals
    console.log('🔵 جاري إنشاء جدول recipe_withdrawals...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS recipe_withdrawals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        production_id INT NOT NULL COMMENT 'رقم الإنتاج',
        user_id INT NOT NULL COMMENT 'المستخدم الذي قام بالسحب',
        withdrawal_quantity DECIMAL(10,2) NOT NULL COMMENT 'كمية السحب',
        withdrawal_date DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'تاريخ ووقت السحب',
        notes TEXT NULL COMMENT 'ملاحظات إضافية',
        
        FOREIGN KEY (production_id) REFERENCES recipe_productions(id) ON DELETE CASCADE,
        INDEX idx_production_id (production_id),
        INDEX idx_user_id (user_id),
        INDEX idx_withdrawal_date (withdrawal_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='جدول سحوبات الوصفات المنتجة'
    `);
    console.log('✅ تم إنشاء جدول recipe_withdrawals');

    // إنشاء جدول production_statistics
    console.log('🔵 جاري إنشاء جدول production_statistics...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS production_statistics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        production_id INT NOT NULL,
        total_withdrawn DECIMAL(10,2) DEFAULT 0.00 COMMENT 'إجمالي المسحوب',
        remaining_quantity DECIMAL(10,2) NOT NULL COMMENT 'الكمية المتبقية',
        withdrawal_count INT DEFAULT 0 COMMENT 'عدد مرات السحب',
        last_withdrawal_date DATETIME NULL COMMENT 'تاريخ آخر سحب',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (production_id) REFERENCES recipe_productions(id) ON DELETE CASCADE,
        UNIQUE KEY unique_production (production_id),
        INDEX idx_remaining_quantity (remaining_quantity)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='إحصائيات الإنتاج والسحوبات'
    `);
    console.log('✅ تم إنشاء جدول production_statistics');

    // إنشاء Trigger: create_production_statistics
    console.log('🔵 جاري إنشاء Trigger: create_production_statistics...');
    try {
      await connection.query('DROP TRIGGER IF EXISTS create_production_statistics');
    } catch (e) {
      // تجاهل الخطأ إذا كان Trigger غير موجود
    }
    
    await connection.query(`
      CREATE TRIGGER create_production_statistics
      AFTER INSERT ON recipe_productions
      FOR EACH ROW
      BEGIN
        INSERT INTO production_statistics (production_id, remaining_quantity)
        VALUES (NEW.id, NEW.production_quantity)
        ON DUPLICATE KEY UPDATE remaining_quantity = NEW.production_quantity;
      END
    `);
    console.log('✅ تم إنشاء Trigger: create_production_statistics');

    // إنشاء Trigger: update_production_statistics
    console.log('🔵 جاري إنشاء Trigger: update_production_statistics...');
    try {
      await connection.query('DROP TRIGGER IF EXISTS update_production_statistics');
    } catch (e) {
      // تجاهل الخطأ إذا كان Trigger غير موجود
    }
    
    await connection.query(`
      CREATE TRIGGER update_production_statistics
      AFTER INSERT ON recipe_withdrawals
      FOR EACH ROW
      BEGIN
        UPDATE production_statistics
        SET 
          total_withdrawn = total_withdrawn + NEW.withdrawal_quantity,
          remaining_quantity = remaining_quantity - NEW.withdrawal_quantity,
          withdrawal_count = withdrawal_count + 1,
          last_withdrawal_date = NEW.withdrawal_date
        WHERE production_id = NEW.production_id;
      END
    `);
    console.log('✅ تم إنشاء Trigger: update_production_statistics');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ تم إنشاء جميع الجداول والـ Triggers بنجاح!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
  } catch (error) {
    console.error('❌ خطأ في إنشاء الجداول:', error.message);
    if (error.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('⚠️ بعض الجداول موجودة بالفعل - هذا طبيعي');
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
setupProductionTables()
  .then(() => {
    console.log('✅ تم إكمال إعداد الجداول بنجاح!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ فشل إعداد الجداول:', error);
    process.exit(1);
  });
