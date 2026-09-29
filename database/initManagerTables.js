const { appPool } = require('./appConnection');

async function initManagerTables() {
  console.log('🔄 جاري التحقق من جداول المدير...');
  try {
    await appPool.query(`
      CREATE TABLE IF NOT EXISTS audit_trails (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action_type VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id INT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await appPool.query(`
      CREATE TABLE IF NOT EXISTS z_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        report_date DATE NOT NULL,
        generated_by INT,
        theoretical_stock DECIMAL(12,3) NOT NULL,
        actual_stock DECIMAL(12,3) NOT NULL,
        variance DECIMAL(12,3) NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ جداول المدير جاهزة');
  } catch (err) {
    console.error('❌ خطأ في إنشاء جداول المدير:', err);
  }
}

module.exports = { initManagerTables };
