-- ======================================================
-- إصلاح جدول recipes - إضافة الأعمدة المطلوبة تلقائياً
-- ======================================================
-- هذا السكريبت يتحقق من وجود الأعمدة ويضيفها إذا لم تكن موجودة

USE kitchen_inventory;

-- التحقق من وجود الأعمدة وإضافتها إذا لم تكن موجودة
SET @dbname = DATABASE();
SET @tablename = 'recipes';

-- item_name
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = @dbname 
                   AND TABLE_NAME = @tablename 
                   AND COLUMN_NAME = 'item_name');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE recipes ADD COLUMN item_name VARCHAR(150) AFTER id', 
              'SELECT "Column item_name already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- yield
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = @dbname 
                   AND TABLE_NAME = @tablename 
                   AND COLUMN_NAME = 'yield');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE recipes ADD COLUMN yield VARCHAR(50) AFTER item_name', 
              'SELECT "Column yield already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- portions
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = @dbname 
                   AND TABLE_NAME = @tablename 
                   AND COLUMN_NAME = 'portions');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE recipes ADD COLUMN portions INT AFTER yield', 
              'SELECT "Column portions already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- shelf_life
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = @dbname 
                   AND TABLE_NAME = @tablename 
                   AND COLUMN_NAME = 'shelf_life');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE recipes ADD COLUMN shelf_life VARCHAR(100) AFTER portions', 
              'SELECT "Column shelf_life already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- procedure (مع backticks لأنها كلمة محجوزة)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = @dbname 
                   AND TABLE_NAME = @tablename 
                   AND COLUMN_NAME = 'procedure');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE recipes ADD COLUMN `procedure` TEXT AFTER shelf_life', 
              'SELECT "Column procedure already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- reference
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = @dbname 
                   AND TABLE_NAME = @tablename 
                   AND COLUMN_NAME = 'reference');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE recipes ADD COLUMN reference VARCHAR(50) AFTER `procedure`', 
              'SELECT "Column reference already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- version
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = @dbname 
                   AND TABLE_NAME = @tablename 
                   AND COLUMN_NAME = 'version');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE recipes ADD COLUMN version VARCHAR(20) DEFAULT ''001'' AFTER reference', 
              'SELECT "Column version already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- edition
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = @dbname 
                   AND TABLE_NAME = @tablename 
                   AND COLUMN_NAME = 'edition');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE recipes ADD COLUMN edition INT DEFAULT 1 AFTER version', 
              'SELECT "Column edition already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- status (إذا لم يكن موجوداً)
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                   WHERE TABLE_SCHEMA = @dbname 
                   AND TABLE_NAME = @tablename 
                   AND COLUMN_NAME = 'status');
SET @sql = IF(@col_exists = 0, 
              'ALTER TABLE recipes ADD COLUMN status ENUM(''draft'', ''active'', ''pending_approval'') DEFAULT ''active'' AFTER edition', 
              'SELECT "Column status already exists" AS message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- إذا كان name موجود، انسخه إلى item_name
UPDATE recipes SET item_name = name WHERE (item_name IS NULL OR item_name = '') AND name IS NOT NULL;

-- إنشاء جدول recipe_ingredients_new إذا لم يكن موجوداً
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

-- عرض هيكل الجدول للتحقق
DESCRIBE recipes;
DESCRIBE recipe_ingredients_new;

SELECT '✅ تم إصلاح جدول recipes بنجاح!' AS result;

