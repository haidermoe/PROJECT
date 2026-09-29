/**
 * ======================================================
 * Init Odoo-Standard Purchases & Vendor Management Module
 * ======================================================
 */
const { appPool } = require('./appConnection');

async function initPurchaseTables() {
  console.log('🔄 [Purchases Migration] بدء فحص وتهيئة جداول المشتريات والموردين (Odoo Standard)...');

  const tables = [
    // 1. دليل الشركاء والموردين (res_partner)
    `CREATE TABLE IF NOT EXISTS res_partner (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      ref VARCHAR(64) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(100) NULL,
      street VARCHAR(255) NULL,
      tax_id VARCHAR(64) NULL,
      is_supplier BOOLEAN NOT NULL DEFAULT TRUE,
      is_customer BOOLEAN NOT NULL DEFAULT FALSE,
      balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      notes TEXT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_partner_name (name),
      INDEX idx_partner_supplier (is_supplier)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 2. أوامر الشراء (purchase_order)
    `CREATE TABLE IF NOT EXISTS purchase_order (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL UNIQUE,
      partner_id INT NOT NULL,
      date_order DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      date_planned DATE NULL,
      state ENUM('draft', 'sent', 'to_approve', 'purchase', 'done', 'cancel') NOT NULL DEFAULT 'draft',
      invoice_status ENUM('no', 'to_invoice', 'invoiced') NOT NULL DEFAULT 'no',
      amount_untaxed DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      amount_tax DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      amount_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      notes TEXT NULL,
      user_id INT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_po_state (state),
      INDEX idx_po_date (date_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 3. بنود أمر الشراء (purchase_order_line)
    `CREATE TABLE IF NOT EXISTS purchase_order_line (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      order_id BIGINT NOT NULL,
      ingredient_id INT NOT NULL,
      name VARCHAR(255) NULL,
      product_qty DECIMAL(12,3) NOT NULL DEFAULT 1.000,
      qty_received DECIMAL(12,3) NOT NULL DEFAULT 0.000,
      qty_invoiced DECIMAL(12,3) NOT NULL DEFAULT 0.000,
      price_unit DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      price_subtotal DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pol_order (order_id),
      INDEX idx_pol_ingredient (ingredient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 4. أذونات الاستلام المخزني (stock_picking)
    `CREATE TABLE IF NOT EXISTS stock_picking (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL UNIQUE,
      origin VARCHAR(64) NULL,
      purchase_id BIGINT NULL,
      partner_id INT NOT NULL,
      scheduled_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_done DATETIME NULL,
      state ENUM('draft', 'waiting', 'confirmed', 'assigned', 'done', 'cancel') NOT NULL DEFAULT 'done',
      notes VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sp_purchase (purchase_id),
      INDEX idx_sp_state (state)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 5. حركات المخزون (stock_move)
    `CREATE TABLE IF NOT EXISTS stock_move (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      picking_id BIGINT NOT NULL,
      ingredient_id INT NOT NULL,
      product_qty DECIMAL(12,3) NOT NULL,
      price_unit DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      state ENUM('draft', 'confirmed', 'done', 'cancel') NOT NULL DEFAULT 'done',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_sm_picking (picking_id),
      INDEX idx_sm_ingredient (ingredient_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 6. فواتير الشراء (vendor_bill)
    `CREATE TABLE IF NOT EXISTS vendor_bill (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      bill_number VARCHAR(64) NOT NULL UNIQUE,
      purchase_id BIGINT NULL,
      partner_id INT NOT NULL,
      bill_date DATE NOT NULL,
      due_date DATE NULL,
      amount_untaxed DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      amount_tax DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      amount_total DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      amount_paid DECIMAL(14,2) NOT NULL DEFAULT 0.00,
      payment_state ENUM('not_paid', 'partial', 'paid') NOT NULL DEFAULT 'not_paid',
      state ENUM('draft', 'posted', 'cancel') NOT NULL DEFAULT 'posted',
      move_id BIGINT NULL,
      notes TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_vb_payment_state (payment_state)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // 7. سندات مدفوعات الموردين (account_payment)
    `CREATE TABLE IF NOT EXISTS account_payment (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      payment_number VARCHAR(64) NOT NULL UNIQUE,
      bill_id BIGINT NOT NULL,
      partner_id INT NOT NULL,
      amount DECIMAL(14,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method ENUM('cash', 'bank') NOT NULL DEFAULT 'cash',
      move_id BIGINT NULL,
      notes VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ap_bill (bill_id),
      INDEX idx_ap_partner (partner_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  ];

  for (const q of tables) {
    try {
      await appPool.query(q);
    } catch (e) {
      console.warn('⚠️ [Purchases Migration Warning]:', e.message);
    }
  }

  // إضافة أعمدة الكلفة للمخزن إذا لم تكن موجودة
  const alterColumns = [
    `ALTER TABLE ingredients ADD COLUMN cost_price DECIMAL(14,2) NOT NULL DEFAULT 0.00`,
    `ALTER TABLE ingredients ADD COLUMN min_qty DECIMAL(12,3) NOT NULL DEFAULT 5.000`
  ];

  for (const alter of alterColumns) {
    try {
      await appPool.query(alter);
    } catch (e) {}
  }

  // موردين افتراضيين للاختبار
  const demoVendors = [
    ['شركة المنصور لتجارة اللحوم والدواجن', 'VEND-001', '07701234567', 'almansour.meat@example.com', 'بغداد - الكرخ', '10023455', 1, 0, 'مورد لحوم بقر ودجاج طازج يومياً'],
    ['شركة دجلة لمنتجات الألبان والأجبان', 'VEND-002', '07801234568', 'dijla.dairy@example.com', 'بغداد - الرصافة', '10023456', 1, 0, 'مورد جبنة موزاريلا وحليب وزبدة'],
    ['مؤسسة الرافدين للخضار والفواكه', 'VEND-003', '07901234569', 'rafidain.veg@example.com', 'علوة جميلة - بغداد', '10023457', 1, 0, 'توريد خضار ورقيات وطماطم وفواكه طازجة'],
    ['شركة بابل للتعبئة ومواد التغليف', 'VEND-004', '07501234570', 'babel.pack@example.com', 'المنطقة الصناعية', '10023458', 1, 0, 'أكياس وعلب سفري ومناديل وطباعة لوجو']
  ];

  for (const v of demoVendors) {
    try {
      const [existing] = await appPool.query(`SELECT id FROM res_partner WHERE ref = ?`, [v[1]]);
      if (!existing.length) {
        await appPool.query(
          `INSERT INTO res_partner (name, ref, phone, email, street, tax_id, is_supplier, is_customer, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          v
        );
      }
    } catch (e) {}
  }

  console.log('✅ [Purchases Migration] تم التحقق من وتهيئة جداول المشتريات والموردين بنجاح.');
}

module.exports = {
  initPurchaseTables
};
