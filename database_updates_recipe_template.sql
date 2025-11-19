-- ======================================================
-- تحديثات قاعدة البيانات لنموذج Standard Recipe Template
-- ======================================================

USE kitchen_inventory;

-- تحديث جدول recipes لإضافة الحقول المطلوبة
-- ملاحظة: IF NOT EXISTS غير مدعوم في MySQL، لذا نستخدم طريقة بديلة

-- التحقق من وجود الأعمدة وإضافتها إذا لم تكن موجودة
SET @dbname = DATABASE();
SET @tablename = 'recipes';

-- item_name
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'item_name') > 0,
  'SELECT 1',
  'ALTER TABLE recipes ADD COLUMN item_name VARCHAR(150) AFTER id'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- yield
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'yield') > 0,
  'SELECT 1',
  'ALTER TABLE recipes ADD COLUMN yield VARCHAR(50) AFTER item_name'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- portions
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'portions') > 0,
  'SELECT 1',
  'ALTER TABLE recipes ADD COLUMN portions INT AFTER yield'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- shelf_life
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'shelf_life') > 0,
  'SELECT 1',
  'ALTER TABLE recipes ADD COLUMN shelf_life VARCHAR(100) AFTER portions'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- procedure
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'procedure') > 0,
  'SELECT 1',
  'ALTER TABLE recipes ADD COLUMN procedure TEXT AFTER shelf_life'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- reference
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'reference') > 0,
  'SELECT 1',
  'ALTER TABLE recipes ADD COLUMN reference VARCHAR(50) AFTER procedure'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- version
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'version') > 0,
  'SELECT 1',
  'ALTER TABLE recipes ADD COLUMN version VARCHAR(20) DEFAULT ''001'' AFTER reference'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- edition
SET @preparedStatement = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'edition') > 0,
  'SELECT 1',
  'ALTER TABLE recipes ADD COLUMN edition INT DEFAULT 1 AFTER version'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- إذا كان name موجود، انسخه إلى item_name
UPDATE recipes SET item_name = name WHERE item_name IS NULL AND name IS NOT NULL;

-- إنشاء جدول recipe_ingredients_new إذا لم يكن موجوداً (بدلاً من recipe_ingredients القديم)
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

-- ملاحظة: جدول recipe_ingredients القديم يبقى للتوافق مع النظام القديم
-- يمكن استخدام recipe_ingredients_new للنموذج الجديد

