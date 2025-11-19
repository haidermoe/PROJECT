-- ======================================================
-- تحديث أدوار المستخدمين لإضافة الأدوار الجديدة
-- ======================================================

USE auth_db;

-- تحديث ENUM لإضافة الأدوار الجديدة
ALTER TABLE users MODIFY COLUMN role ENUM(
  'admin',
  'manager',
  'kitchen_manager',
  'employee',
  'waiter',
  'captain',
  'cleaner',
  'hall_manager',
  'hall_captain',
  'receptionist',
  'garage_employee',
  'garage_manager'
) NOT NULL DEFAULT 'employee';

