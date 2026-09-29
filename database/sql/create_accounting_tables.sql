-- ======================================================
-- Odoo-Standard Accounting Schema (Chart of Accounts & Ledgers)
-- ======================================================
USE kitchen_inventory;

-- 1) جدول شجرة الحسابات (Chart of Accounts)
CREATE TABLE IF NOT EXISTS account_account (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  account_type ENUM(
    'asset_cash',             -- بنوك ونقدية وصندوق
    'asset_receivable',       -- ذمم مدينة وعملاء
    'asset_current',          -- أصول متداولة ومخزون
    'asset_fixed',            -- أصول ثابتة ومعدات
    'liability_payable',      -- ذمم دائنة وموردين
    'liability_current',      -- التزامات متداولة ومستحقات
    'liability_non_current',  -- التزامات طويلة الأجل
    'equity',                 -- رأس المال وحقوق الملكية
    'income',                 -- إيرادات ومبيعات
    'expense_direct_cost',    -- تكلفة المبيعات والمواد (COGS / هدر)
    'expense'                 -- مصاريف تشغيلية ورواتب
  ) NOT NULL,
  reconcile BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_account_code (code),
  INDEX idx_account_type (account_type),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) دفاتر اليومية (Journals)
CREATE TABLE IF NOT EXISTS account_journal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(10) NOT NULL UNIQUE,
  type ENUM('sale', 'purchase', 'cash', 'bank', 'general') NOT NULL,
  default_account_id INT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_journal_default_account FOREIGN KEY (default_account_id) REFERENCES account_account(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) القيود اليومية (Journal Entries / Moves)
CREATE TABLE IF NOT EXISTS account_move (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,             -- مثل: POS/2026/0001, MISC/2026/0001
  date DATE NOT NULL,
  ref VARCHAR(255) NULL,                  -- مرجع القيد (رقم الطلب أو الفاتورة)
  journal_id INT NOT NULL,
  state ENUM('draft', 'posted', 'cancel') NOT NULL DEFAULT 'posted',
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_move_journal FOREIGN KEY (journal_id) REFERENCES account_journal(id) ON DELETE RESTRICT,
  INDEX idx_move_date (date),
  INDEX idx_move_state (state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) بنود وتفاصيل القيد (Journal Items / Move Lines)
CREATE TABLE IF NOT EXISTS account_move_line (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  move_id BIGINT NOT NULL,
  account_id INT NOT NULL,
  name VARCHAR(255) NULL,                 -- بيان السطر / الشرح
  debit DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  credit DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_move_line_move FOREIGN KEY (move_id) REFERENCES account_move(id) ON DELETE CASCADE,
  CONSTRAINT fk_move_line_account FOREIGN KEY (account_id) REFERENCES account_account(id) ON DELETE RESTRICT,
  INDEX idx_line_account (account_id),
  INDEX idx_line_move (move_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) بيانات شجرة الحسابات الافتراضية للمطعم (مطابقة لمعايير أودو)
INSERT IGNORE INTO account_account (code, name, account_type, reconcile) VALUES
('101000', 'الصندوق الرئيسي (النقدية)', 'asset_cash', TRUE),
('102000', 'البنك ونقاط البيع الإلكتروني (POS Cards)', 'asset_cash', TRUE),
('103000', 'حسابات العملاء والذمم المدينة', 'asset_receivable', TRUE),
('104000', 'مخزون المواد الغذائية والمشروبات', 'asset_current', FALSE),
('105000', 'الأصول الثابتة ومعدات المطبخ', 'asset_fixed', FALSE),
('201000', 'حسابات الموردين والذمم الدائنة', 'liability_payable', TRUE),
('202000', 'مستحقات الرواتب والأجور', 'liability_current', FALSE),
('203000', 'أمانات وضرائب مستحقة', 'liability_current', FALSE),
('301000', 'رأس المال', 'equity', FALSE),
('302000', 'الأرباح المحتجزة / السابقة', 'equity', FALSE),
('401000', 'إيرادات مبيعات الأطعمة والمشروبات', 'income', FALSE),
('402000', 'إيرادات خدمات التوصيل والحفلات', 'income', FALSE),
('501000', 'تكلفة البضاعة والمواد المستهلكة (COGS)', 'expense_direct_cost', FALSE),
('502000', 'تكلفة الهدر والمواد التالفة', 'expense_direct_cost', FALSE),
('601000', 'مصاريف رواتب وأجور الموظفين', 'expense', FALSE),
('602000', 'مصاريف إيجار المطعم والمرافق', 'expense', FALSE),
('603000', 'مصاريف صيانة ونظافة وتشغيل', 'expense', FALSE),
('604000', 'مصاريف تسويق وإعلانات', 'expense', FALSE);

-- دفاتر اليومية الافتراضية
INSERT IGNORE INTO account_journal (name, code, type, default_account_id) VALUES
('يومية المبيعات', 'POS', 'sale', (SELECT id FROM account_account WHERE code = '401000' LIMIT 1)),
('يومية المشتريات والمخزن', 'PUR', 'purchase', (SELECT id FROM account_account WHERE code = '501000' LIMIT 1)),
('يومية الصندوق النقدية', 'CSH', 'cash', (SELECT id FROM account_account WHERE code = '101000' LIMIT 1)),
('يومية البنك والبطاقات', 'BNK', 'bank', (SELECT id FROM account_account WHERE code = '102000' LIMIT 1)),
('يومية العمليات المتنوعة والرواتب', 'MISC', 'general', NULL);
