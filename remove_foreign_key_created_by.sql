-- ======================================================
-- إزالة Foreign Key Constraint من recipes.created_by
-- ======================================================
-- المشكلة: created_by يشير إلى users في kitchen_inventory
-- لكن المستخدمين موجودون في auth_db (قاعدة بيانات معزولة)
-- الحل: إزالة Foreign Key constraint

USE kitchen_inventory;

-- إزالة Foreign Key constraint من recipes.created_by
-- أولاً، نحتاج إلى معرفة اسم الـ constraint
SET @constraint_name = (
  SELECT CONSTRAINT_NAME 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = 'kitchen_inventory' 
    AND TABLE_NAME = 'recipes' 
    AND COLUMN_NAME = 'created_by'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);

-- إذا كان هناك constraint، قم بإزالته
SET @sql = IF(@constraint_name IS NOT NULL,
  CONCAT('ALTER TABLE recipes DROP FOREIGN KEY ', @constraint_name),
  'SELECT "No foreign key constraint found on recipes.created_by" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '✅ تم إزالة Foreign Key constraint من recipes.created_by بنجاح!' AS result;

