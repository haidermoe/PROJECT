-- ======================================================
-- تحديثات قاعدة البيانات لنظام تسجيل الهدر
-- ======================================================

USE kitchen_inventory;

-- ======================================================
-- جدول الهدر (Waste/Spoilage)
-- ======================================================
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
COMMENT='جدول تسجيل الهدر';

