-- ======================================================
-- إصلاح جدول users - إضافة عمود full_name
-- شغّل هذا الملف في MySQL
-- ======================================================

USE auth_db;

-- التحقق من وجود العمود وإضافته إذا لم يكن موجوداً
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS full_name VARCHAR(100) NULL AFTER password;

-- التحقق من النتيجة
DESCRIBE users;

