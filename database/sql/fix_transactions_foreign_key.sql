-- ======================================================
-- إصلاح Foreign Key constraint في جدول transactions
-- ======================================================
-- المشكلة: transactions.user_id لديه Foreign Key يشير إلى kitchen_inventory.users
-- لكن المستخدمين موجودون في auth_db (قاعدة بيانات منفصلة)
-- الحل: إزالة Foreign Key constraint من user_id

USE kitchen_inventory;

-- إزالة Foreign Key constraint من transactions.user_id
-- أولاً نحتاج لمعرفة اسم constraint
SET @constraint_name = (
  SELECT CONSTRAINT_NAME 
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
  WHERE TABLE_SCHEMA = 'kitchen_inventory' 
    AND TABLE_NAME = 'transactions' 
    AND COLUMN_NAME = 'user_id'
    AND REFERENCED_TABLE_NAME = 'users'
  LIMIT 1
);

-- إذا وجدنا constraint، نزيله
SET @sql = IF(
  @constraint_name IS NOT NULL,
  CONCAT('ALTER TABLE transactions DROP FOREIGN KEY ', @constraint_name),
  'SELECT "Foreign Key constraint غير موجود" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- التحقق من أن user_id يمكن أن يكون NULL (وهو كذلك بالفعل)
-- الآن يمكننا إدراج user_id من auth_db بدون مشاكل

