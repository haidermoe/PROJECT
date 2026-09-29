/**
 * ======================================================
 * Init Accounting & POS Restaurant System Migration
 * ======================================================
 * يقوم هذا السكربت بإنشاء جداول المحاسبة والصالات والطاولات
 * وتهيئتها بالبيانات الافتراضية المستوحاة من Odoo 19
 */

const { appPool } = require('./appConnection');

async function initAccountingAndPosTables() {
  console.log('🔄 [System Migration] بدء فحص وتهيئة جداول المحاسبة وشاشات الويتر...');

  const queries = [
    // 1. جدول شجرة الحسابات
    `CREATE TABLE IF NOT EXISTS account_account (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(64) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      account_type ENUM(
        'asset_cash', 'asset_receivable', 'asset_current', 'asset_fixed',
        'liability_payable', 'liability_current', 'liability_non_current',
        'equity', 'income', 'expense_direct_cost', 'expense'
      ) NOT NULL,
      reconcile BOOLEAN NOT NULL DEFAULT FALSE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_account_code (code),
      INDEX idx_account_type (account_type),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 2. دفاتر اليومية
    `CREATE TABLE IF NOT EXISTS account_journal (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(10) NOT NULL UNIQUE,
      type ENUM('sale', 'purchase', 'cash', 'bank', 'general') NOT NULL,
      default_account_id INT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 3. القيود اليومية
    `CREATE TABLE IF NOT EXISTS account_move (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      date DATE NOT NULL,
      ref VARCHAR(255) NULL,
      journal_id INT NOT NULL,
      state ENUM('draft', 'posted', 'cancel') NOT NULL DEFAULT 'posted',
      total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      created_by INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_move_date (date),
      INDEX idx_move_state (state)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 4. بنود القيد
    `CREATE TABLE IF NOT EXISTS account_move_line (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      move_id BIGINT NOT NULL,
      account_id INT NOT NULL,
      name VARCHAR(255) NULL,
      debit DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      credit DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_line_account (account_id),
      INDEX idx_line_move (move_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 5. جداول الصالات والطاولات
    `CREATE TABLE IF NOT EXISTS pos_floors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      sequence INT NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS pos_tables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      floor_id INT NOT NULL,
      table_number VARCHAR(50) NOT NULL,
      seats INT NOT NULL DEFAULT 4,
      status ENUM('available', 'occupied', 'billed') NOT NULL DEFAULT 'available',
      current_order_id BIGINT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_table_floor (floor_id),
      INDEX idx_table_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 6. مخزون السكاشن والمحطات (العهدة التشغيلية)
    `CREATE TABLE IF NOT EXISTS station_inventory (
      id INT AUTO_INCREMENT PRIMARY KEY,
      station_id INT NOT NULL,
      ingredient_id INT NOT NULL,
      quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
      min_qty DECIMAL(12,3) NOT NULL DEFAULT 2.000,
      last_assigned_user_id INT NULL,
      last_transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_station_ingredient (station_id, ingredient_id),
      INDEX idx_st_inv_station (station_id),
      INDEX idx_st_inv_ingredient (ingredient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 7. حركات مخزون السكاشن (استهلاك الطلبات، هدر السكشن، تحويلات)
    `CREATE TABLE IF NOT EXISTS station_stock_moves (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      station_id INT NOT NULL,
      ingredient_id INT NOT NULL,
      user_id INT NULL,
      type ENUM('transfer_in', 'order_consumption', 'waste_loss', 'adjustment') NOT NULL,
      quantity DECIMAL(12,3) NOT NULL,
      ref_order_id BIGINT NULL,
      ref_waste_id INT NULL,
      notes VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_st_move_station (station_id),
      INDEX idx_st_move_type (type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 8. طلبات صرف العهد التشغيلية وموافقات مدير المطبخ وحاسبة التغطية
    `CREATE TABLE IF NOT EXISTS station_transfer_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      station_id INT NOT NULL,
      ingredient_id INT NOT NULL,
      quantity DECIMAL(12,3) NOT NULL,
      coverage_summary TEXT NULL,
      requested_by INT NULL,
      approved_by INT NULL,
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      notes VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_str_status (status),
      INDEX idx_str_station (station_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const q of queries) {
    try {
      await appPool.query(q);
    } catch (e) {
      console.warn('⚠️ [Migration Notice]:', e.message);
    }
  }

  // إضافة أعمدة للجداول بأمان
  const alterColumns = [
    `ALTER TABLE pos_orders ADD COLUMN status ENUM('draft', 'ordered', 'billed', 'paid', 'cancelled') NOT NULL DEFAULT 'ordered'`,
    `ALTER TABLE pos_orders ADD COLUMN floor_id INT NULL`,
    `ALTER TABLE pos_orders ADD COLUMN table_id INT NULL`,
    `ALTER TABLE pos_orders ADD COLUMN waiter_id INT NULL`,
    `ALTER TABLE pos_orders ADD COLUMN waiter_name VARCHAR(100) NULL`,
    `ALTER TABLE pos_orders ADD COLUMN payment_method VARCHAR(50) NULL`,
    `ALTER TABLE pos_orders ADD COLUMN notes TEXT NULL`,
    `ALTER TABLE pos_items ADD COLUMN recipe_id INT NULL`,
    `ALTER TABLE waste_records ADD COLUMN station_id INT NULL`,
    `ALTER TABLE waste_records ADD COLUMN deducted_from ENUM('station', 'main_store') DEFAULT 'station'`,
    `ALTER TABLE ingredients ADD COLUMN material_type ENUM('raw', 'manufactured') NOT NULL DEFAULT 'raw'`,
    `ALTER TABLE ingredients ADD COLUMN recipe_id INT NULL`
  ];

  for (const alter of alterColumns) {
    try {
      await appPool.query(alter);
    } catch (e) {
      // Column might already exist, ignore safely
    }
  }

  // ملء شجرة الحسابات الافتراضية
  const defaultAccounts = [
    ['101000', 'الصندوق الرئيسي (النقدية)', 'asset_cash', 1],
    ['102000', 'البنك ونقاط البيع الإلكتروني (POS Cards)', 'asset_cash', 1],
    ['103000', 'حسابات العملاء والذمم المدينة', 'asset_receivable', 1],
    ['104000', 'مخزون المواد الغذائية والمشروبات', 'asset_current', 0],
    ['105000', 'الأصول الثابتة ومعدات المطبخ', 'asset_fixed', 0],
    ['201000', 'حسابات الموردين والذمم الدائنة', 'liability_payable', 1],
    ['202000', 'مستحقات الرواتب والأجور', 'liability_current', 0],
    ['203000', 'أمانات وضرائب مستحقة', 'liability_current', 0],
    ['301000', 'رأس المال', 'equity', 0],
    ['302000', 'الأرباح المحتجزة / السابقة', 'equity', 0],
    ['401000', 'إيرادات مبيعات الأطعمة والمشروبات', 'income', 0],
    ['402000', 'إيرادات خدمات التوصيل والحفلات', 'income', 0],
    ['501000', 'تكلفة البضاعة والمواد المستهلكة (COGS)', 'expense_direct_cost', 0],
    ['502000', 'تكلفة الهدر والمواد التالفة', 'expense_direct_cost', 0],
    ['601000', 'مصاريف رواتب وأجور الموظفين', 'expense', 0],
    ['602000', 'مصاريف إيجار المطعم والمرافق', 'expense', 0],
    ['603000', 'مصاريف صيانة ونظافة وتشغيل', 'expense', 0],
    ['604000', 'مصاريف تسويق وإعلانات', 'expense', 0]
  ];

  for (const acc of defaultAccounts) {
    try {
      await appPool.query(
        `INSERT IGNORE INTO account_account (code, name, account_type, reconcile) VALUES (?, ?, ?, ?)`,
        acc
      );
    } catch (e) {
      // Ignored
    }
  }

  // ملء دفاتر اليومية
  const defaultJournals = [
    ['يومية المبيعات', 'POS', 'sale'],
    ['يومية المشتريات والمخزن', 'PUR', 'purchase'],
    ['يومية الصندوق النقدية', 'CSH', 'cash'],
    ['يومية البنك والبطاقات', 'BNK', 'bank'],
    ['يومية العمليات المتنوعة والرواتب', 'MISC', 'general']
  ];

  for (const j of defaultJournals) {
    try {
      await appPool.query(
        `INSERT IGNORE INTO account_journal (name, code, type) VALUES (?, ?, ?)`,
        j
      );
    } catch (e) {
      // Ignored
    }
  }

  // صالات وطاولات افتراضية
  const defaultFloors = [
    [1, 'الصالة الرئيسية (Main Dining)', 1],
    [2, 'قسم العوائل (Family Section)', 2],
    [3, 'التراس والحديقة الخارجية (Terrace)', 3],
    [4, 'صالات VIP الخاصة', 4]
  ];

  for (const f of defaultFloors) {
    try {
      await appPool.query(`INSERT IGNORE INTO pos_floors (id, name, sequence) VALUES (?, ?, ?)`, f);
    } catch (e) {}
  }

  const defaultTables = [
    [1, 'طاولة 1', 4],
    [1, 'طاولة 2', 4],
    [1, 'طاولة 3', 6],
    [1, 'طاولة 4', 2],
    [1, 'طاولة 5', 8],
    [2, 'عائلة 1', 6],
    [2, 'عائلة 2', 6],
    [2, 'عائلة 3', 8],
    [3, 'تراس 1', 4],
    [3, 'تراس 2', 4],
    [4, 'VIP 1', 10]
  ];

  for (const t of defaultTables) {
    try {
      const [existing] = await appPool.query(`SELECT id FROM pos_tables WHERE floor_id = ? AND table_number = ?`, [t[0], t[1]]);
      if (!existing.length) {
        await appPool.query(`INSERT INTO pos_tables (floor_id, table_number, seats) VALUES (?, ?, ?)`, t);
      }
    } catch (e) {}
  }

  console.log('✅ [System Migration] تم التحقق من وتهيئة جداول المحاسبة وشاشات الويتر بنجاح.');
}

module.exports = {
  initAccountingAndPosTables
};
