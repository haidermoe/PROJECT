-- ======================================================
-- تحديثات قاعدة البيانات لنظام الإنتاج والسحوبات
-- ======================================================

USE kitchen_inventory;

-- ======================================================
-- جدول إنتاج الوصفات (Recipe Productions)
-- ======================================================
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
COMMENT='جدول إنتاج الوصفات مع QR Code';

-- ======================================================
-- جدول السحوبات (Recipe Withdrawals)
-- ======================================================
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
COMMENT='جدول سحوبات الوصفات المنتجة';

-- ======================================================
-- جدول إحصائيات السحوبات (اختياري - للتقارير السريعة)
-- ======================================================
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
COMMENT='إحصائيات الإنتاج والسحوبات';

-- ======================================================
-- Trigger: إنشاء سجل إحصائيات تلقائياً عند إنشاء إنتاج جديد
-- ======================================================
DELIMITER $$

DROP TRIGGER IF EXISTS create_production_statistics$$

CREATE TRIGGER create_production_statistics
AFTER INSERT ON recipe_productions
FOR EACH ROW
BEGIN
  INSERT INTO production_statistics (production_id, remaining_quantity)
  VALUES (NEW.id, NEW.production_quantity)
  ON DUPLICATE KEY UPDATE remaining_quantity = NEW.production_quantity;
END$$

DELIMITER ;

-- ======================================================
-- Trigger: تحديث الإحصائيات عند إضافة سحب جديد
-- ======================================================
DELIMITER $$

DROP TRIGGER IF EXISTS update_production_statistics$$

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
END$$

DELIMITER ;

-- ======================================================
-- ملاحظات مهمة:
-- ======================================================
-- 1. recipe_productions: يحتوي على معلومات الإنتاج و QR Code
-- 2. recipe_withdrawals: يحتوي على سجل جميع السحوبات
-- 3. production_statistics: إحصائيات سريعة (يتم تحديثها تلقائياً)
-- 4. user_id في recipe_withdrawals يشير إلى auth_db.users (سيتم التعامل معه في API)
-- 5. created_by في recipe_productions يشير إلى auth_db.users (سيتم التعامل معه في API)

