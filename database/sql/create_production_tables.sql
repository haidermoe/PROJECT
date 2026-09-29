-- ======================================================
-- إنشاء جداول إنتاج الوصفات
-- ======================================================
-- هذا الملف ينشئ الجداول المطلوبة لإنتاج الوصفات

USE kitchen_inventory;

-- جدول إنتاج الوصفات (recipe_productions)
CREATE TABLE IF NOT EXISTS recipe_productions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT NOT NULL,
  production_quantity DECIMAL(12,3) NOT NULL,
  portion_weight DECIMAL(12,3) NOT NULL,
  production_date DATETIME NOT NULL,
  expiry_date DATETIME NOT NULL,
  qr_code_data JSON,
  calculated_ingredients JSON,
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  INDEX idx_recipe_id (recipe_id),
  INDEX idx_production_date (production_date),
  INDEX idx_expiry_date (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول إحصائيات الإنتاج (production_statistics)
CREATE TABLE IF NOT EXISTS production_statistics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  production_id INT NOT NULL UNIQUE,
  total_withdrawn DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  remaining_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  withdrawal_count INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (production_id) REFERENCES recipe_productions(id) ON DELETE CASCADE,
  INDEX idx_production_id (production_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول سحوبات الإنتاج (recipe_withdrawals)
CREATE TABLE IF NOT EXISTS recipe_withdrawals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  production_id INT NOT NULL,
  user_id INT,
  withdrawal_quantity DECIMAL(12,3) NOT NULL,
  notes VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (production_id) REFERENCES recipe_productions(id) ON DELETE CASCADE,
  INDEX idx_production_id (production_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- تحديث جدول transactions لإضافة دعم production_id (اختياري)
-- يمكن إضافة عمود production_id إذا أردت ربط المعاملات بالإنتاج
-- ALTER TABLE transactions ADD COLUMN production_id INT NULL AFTER ingredient_id;
-- ALTER TABLE transactions ADD FOREIGN KEY (production_id) REFERENCES recipe_productions(id) ON DELETE SET NULL;

-- إنشاء trigger لتحديث إحصائيات الإنتاج تلقائياً عند إنشاء إنتاج جديد
DELIMITER //

CREATE TRIGGER IF NOT EXISTS update_production_stats_on_insert
AFTER INSERT ON recipe_productions
FOR EACH ROW
BEGIN
  INSERT INTO production_statistics (production_id, remaining_quantity)
  VALUES (NEW.id, NEW.production_quantity)
  ON DUPLICATE KEY UPDATE
    remaining_quantity = NEW.production_quantity,
    updated_at = CURRENT_TIMESTAMP;
END//

DELIMITER ;

