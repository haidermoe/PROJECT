-- ======================================================
-- تحديثات قاعدة البيانات لنموذج Standard Recipe Template
-- نسخة مبسطة - شغّل هذا الملف في MySQL
-- ======================================================

USE kitchen_inventory;

-- إضافة الأعمدة (إذا لم تكن موجودة - شغّل كل ALTER TABLE بشكل منفصل)
-- إذا ظهر خطأ "Duplicate column name" فهذا يعني أن العمود موجود بالفعل - تجاهل الخطأ

ALTER TABLE recipes ADD COLUMN item_name VARCHAR(150) AFTER id;
ALTER TABLE recipes ADD COLUMN yield VARCHAR(50) AFTER item_name;
ALTER TABLE recipes ADD COLUMN portions INT AFTER yield;
ALTER TABLE recipes ADD COLUMN shelf_life VARCHAR(100) AFTER portions;
-- ⚠️ procedure كلمة محجوزة في MySQL، يجب استخدام backticks
ALTER TABLE recipes ADD COLUMN `procedure` TEXT AFTER shelf_life;
ALTER TABLE recipes ADD COLUMN reference VARCHAR(50) AFTER `procedure`;
ALTER TABLE recipes ADD COLUMN version VARCHAR(20) DEFAULT '001' AFTER reference;
ALTER TABLE recipes ADD COLUMN edition INT DEFAULT 1 AFTER version;

-- إذا كان name موجود، انسخه إلى item_name
UPDATE recipes SET item_name = name WHERE (item_name IS NULL OR item_name = '') AND name IS NOT NULL;

-- إنشاء جدول recipe_ingredients_new
CREATE TABLE IF NOT EXISTS recipe_ingredients_new (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT NOT NULL,
  ingredient_name VARCHAR(200) NOT NULL,
  quantity VARCHAR(100) NOT NULL,
  display_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  INDEX idx_recipe_id (recipe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- التحقق من النتيجة
DESCRIBE recipes;
DESCRIBE recipe_ingredients_new;

