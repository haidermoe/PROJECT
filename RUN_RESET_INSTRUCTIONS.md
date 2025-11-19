# كيفية تشغيل سكريبت إعادة تعيين قواعد البيانات

## الطريقة 1: استخدام ملف BAT (الأسهل)

1. **انقر نقراً مزدوجاً** على الملف `RUN_RESET.bat`
2. سيطلب منك كلمة مرور MySQL
3. أدخل كلمة المرور واضغط Enter

---

## الطريقة 2: من MySQL Command Line Client

1. افتح **MySQL Command Line Client** (ابحث عنه في قائمة Start)
2. أدخل كلمة مرور root
3. اكتب:
   ```sql
   source C:\Users\user\Desktop\project\reset_databases.sql
   ```
   أو
   ```sql
   source reset_databases.sql
   ```
   (إذا كنت في مجلد المشروع)

---

## الطريقة 3: من MySQL Workbench

1. افتح **MySQL Workbench**
2. اتصل بالسيرفر
3. افتح الملف `reset_databases.sql`
4. انسخ المحتوى
5. الصقه في Query Editor
6. اضغط **Execute** (أو F9)

---

## الطريقة 4: من Terminal (إذا كان MySQL في PATH)

```bash
cd C:\Users\user\Desktop\project
mysql -u root -p < reset_databases.sql
```

---

## الطريقة 5: من PowerShell (مع مسار كامل)

```powershell
# إذا كان MySQL في C:\Program Files\MySQL\MySQL Server 8.0\bin\
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "source reset_databases.sql"

# أو إذا كان في XAMPP
& "C:\xampp\mysql\bin\mysql.exe" -u root -p < reset_databases.sql
```

---

## بعد تشغيل السكريبت

1. **أنشئ حساب admin جديد**:
   - افتح MySQL Command Line
   - اكتب:
   ```sql
   USE auth_db;
   INSERT INTO users (username, password, role, full_name, is_active) 
   VALUES ('admin', '$2b$10$YourHashedPasswordHere', 'admin', 'مدير النظام', 1);
   ```
   
   **ملاحظة**: ستحتاج إلى hash كلمة المرور أولاً. يمكنك استخدام Node.js:
   ```javascript
   const bcrypt = require('bcrypt');
   bcrypt.hash('your_password', 10).then(hash => console.log(hash));
   ```

2. **أو استخدم واجهة التطبيق** لإنشاء حساب admin من صفحة الموظفين (بعد تسجيل الدخول بحساب admin موجود)

---

## ⚠️ تحذير

هذا السكريبت **سيحذف جميع البيانات**:
- جميع المستخدمين
- جميع الوصفات
- جميع المكونات
- جميع المعاملات

**تأكد من عمل backup قبل التشغيل!**

