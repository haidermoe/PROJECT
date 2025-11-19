-- ======================================================
-- إصلاح Foreign Key Constraint - إزالة القيود التي تشير إلى users
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

-- إزالة Foreign Key constraint من transactions.user_id
SET @constraint_name = (
  SELECT CONSTRAINT_NAME 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = 'kitchen_inventory' 
    AND TABLE_NAME = 'transactions' 
    AND COLUMN_NAME = 'user_id'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);

SET @sql = IF(@constraint_name IS NOT NULL,
  CONCAT('ALTER TABLE transactions DROP FOREIGN KEY ', @constraint_name),
  'SELECT "No foreign key constraint found on transactions.user_id" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- إزالة Foreign Key constraints من recipe_approval_requests
SET @constraint_name = (
  SELECT CONSTRAINT_NAME 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = 'kitchen_inventory' 
    AND TABLE_NAME = 'recipe_approval_requests' 
    AND COLUMN_NAME = 'requested_by'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);

SET @sql = IF(@constraint_name IS NOT NULL,
  CONCAT('ALTER TABLE recipe_approval_requests DROP FOREIGN KEY ', @constraint_name),
  'SELECT "No foreign key constraint found on recipe_approval_requests.requested_by" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_name = (
  SELECT CONSTRAINT_NAME 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = 'kitchen_inventory' 
    AND TABLE_NAME = 'recipe_approval_requests' 
    AND COLUMN_NAME = 'approved_by'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);

SET @sql = IF(@constraint_name IS NOT NULL,
  CONCAT('ALTER TABLE recipe_approval_requests DROP FOREIGN KEY ', @constraint_name),
  'SELECT "No foreign key constraint found on recipe_approval_requests.approved_by" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- إزالة Foreign Key constraint من recipe_employee_permissions
SET @constraint_name = (
  SELECT CONSTRAINT_NAME 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = 'kitchen_inventory' 
    AND TABLE_NAME = 'recipe_employee_permissions' 
    AND COLUMN_NAME = 'employee_id'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);

SET @sql = IF(@constraint_name IS NOT NULL,
  CONCAT('ALTER TABLE recipe_employee_permissions DROP FOREIGN KEY ', @constraint_name),
  'SELECT "No foreign key constraint found on recipe_employee_permissions.employee_id" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '✅ تم إزالة جميع Foreign Key constraints التي تشير إلى users بنجاح!' AS result;

