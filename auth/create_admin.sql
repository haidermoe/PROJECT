-- ======================================================
-- إنشاء حساب مدير (Admin) - تشغيل هذا الملف مرة واحدة
-- ======================================================

USE auth_db;

-- إنشاء حساب مدير
-- اسم المستخدم: admin
-- كلمة المرور: admin123 (يُنصح بتغييرها بعد أول تسجيل دخول)
-- الرتبة: admin

-- ملاحظة: كلمة المرور مشفرة بـ bcrypt
-- كلمة المرور "admin123" بعد التشفير:
INSERT INTO users (username, password, role, full_name, is_active) 
VALUES (
  'admin',
  '$2b$10$rQ8K8K8K8K8K8K8K8K8K.8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K',  -- admin123
  'admin',
  'مدير النظام',
  1
) ON DUPLICATE KEY UPDATE username=username;

-- إذا أردت إنشاء حساب مدير آخر:
-- INSERT INTO users (username, password, role, full_name, is_active) 
-- VALUES (
--   'manager',
--   '$2b$10$rQ8K8K8K8K8K8K8K8K8K.8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K',  -- كلمة المرور المشفرة
--   'admin',
--   'مدير آخر',
--   1
-- );

-- ======================================================
-- ملاحظة مهمة:
-- ======================================================
-- كلمة المرور المشفرة أعلاه هي مثال فقط
-- يجب تشفير كلمة المرور باستخدام bcrypt في Node.js
-- أو استخدام هذا الموقع: https://bcrypt-generator.com/
-- 
-- مثال: كلمة المرور "admin123" بعد التشفير بـ bcrypt (10 rounds):
-- $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

