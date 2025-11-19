# إعادة تعيين قواعد البيانات

## ⚠️ تحذير مهم
هذا السكريبت **سيحذف جميع البيانات** من قواعد البيانات ويبدأ من جديد!

## الاستخدام

### الطريقة 1: من MySQL Command Line
```bash
mysql -u root -p < reset_databases.sql
```

### الطريقة 2: من MySQL Workbench أو phpMyAdmin
1. افتح الملف `reset_databases.sql`
2. انسخ المحتوى
3. الصقه في MySQL Workbench أو phpMyAdmin
4. شغّل السكريبت

### الطريقة 3: من Terminal (PowerShell)
```powershell
# تأكد من أن MySQL في PATH
mysql -u root -p -e "source reset_databases.sql"
```

## ما الذي يفعله هذا السكريبت؟

1. **يحذف** قواعد البيانات التالية:
   - `kitchen_inventory`
   - `auth_db`

2. **يعيد إنشاء** قواعد البيانات مع:
   - جميع الجداول المطلوبة
   - الأعمدة المحدثة (item_name, yield, portions, etc.)
   - بدون Foreign Key constraints على `created_by` (لأن المستخدمين في قاعدة بيانات مختلفة)

## بعد تشغيل السكريبت

1. **أنشئ حساب admin جديد**:
   ```sql
   USE auth_db;
   INSERT INTO users (username, password, role, full_name, is_active) 
   VALUES ('admin', '$2b$10$...', 'admin', 'مدير النظام', 1);
   ```
   
   أو استخدم سكريبت إنشاء admin (إذا كان موجوداً)

2. **سجّل الدخول** بحساب admin

3. **ابدأ بإضافة البيانات** من جديد

## ملاحظات

- جميع البيانات السابقة ستُحذف
- تأكد من عمل backup قبل التشغيل إذا كنت تريد حفظ البيانات
- بعد التشغيل، ستحتاج إلى إنشاء حسابات جديدة

