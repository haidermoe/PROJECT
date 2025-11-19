# 🚀 دليل سريع لإعداد Railway

## الخطوة 1: إضافة قاعدة بيانات MySQL

1. في Railway Dashboard
2. اضغط **"+ New"** → **"Database"** → **"Add MySQL"**
3. انتظر حتى يتم إنشاء قاعدة البيانات
4. اذهب إلى Database → **Variables**
5. انسخ القيم التالية:
   - `MYSQLHOST` → هذا هو `DB_HOST`
   - `MYSQLUSER` → هذا هو `DB_USER`
   - `MYSQLPASSWORD` → هذا هو `DB_PASSWORD`
   - `MYSQLPORT` → عادة 3306

## الخطوة 2: إضافة متغيرات البيئة للمشروع

1. في Railway Dashboard
2. اختر مشروعك (web)
3. اذهب إلى **Settings** → **Variables**
4. اضغط **"+ New Variable"**
5. أضف المتغيرات التالية:

```
DB_HOST=القيمة_من_MYSQLHOST
DB_USER=القيمة_من_MYSQLUSER
DB_PASSWORD=القيمة_من_MYSQLPASSWORD
DB_NAME=kitchen_inventory
AUTH_DB_NAME=auth_db
JWT_SECRET=أنشئ_مفتاح_عشوائي_32_حرف
PORT=3000
NODE_ENV=production
```

### إنشاء JWT_SECRET:

**في PowerShell:**
```powershell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

**أو استخدم:** https://randomkeygen.com

## الخطوة 3: إعداد قاعدة البيانات

### الطريقة 1: استخدام Railway CLI (موصى بها)

```bash
# تثبيت Railway CLI
npm i -g @railway/cli

# تسجيل الدخول
railway login

# ربط المشروع
railway link

# تشغيل سكريبت الإعداد
railway run node railway-setup.js
```

### الطريقة 2: يدوياً من Railway Dashboard

1. اذهب إلى **Deployments** → **View Logs**
2. اضغط على **"Shell"** أو **"Terminal"**
3. شغّل الأوامر التالية:

```bash
# الاتصال بقاعدة البيانات
mysql -h $MYSQLHOST -u $MYSQLUSER -p$MYSQLPASSWORD

# ثم داخل MySQL:
CREATE DATABASE IF NOT EXISTS auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS kitchen_inventory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auth_db;
SOURCE auth/auth_db.sql;
USE kitchen_inventory;
SOURCE init.sql;
```

### الطريقة 3: استخدام سكريبت Node.js

بعد إضافة متغيرات البيئة، شغّل:

```bash
railway run node railway-setup.js
```

## الخطوة 4: إنشاء حساب مدير

```bash
railway run node auth/create_first_admin.js
```

أو من Railway Shell:
```bash
node auth/create_first_admin.js
```

## الخطوة 5: التحقق من النشر

1. انتظر حتى يكتمل النشر (ستظهر "Active")
2. اضغط على الرابط في Railway Dashboard
3. يجب أن تظهر صفحة تسجيل الدخول

## ✅ قائمة التحقق

- [ ] قاعدة بيانات MySQL تم إنشاؤها
- [ ] متغيرات البيئة تم إضافتها
- [ ] JWT_SECRET تم إنشاؤه
- [ ] قاعدة البيانات تم إعدادها
- [ ] حساب المدير تم إنشاؤه
- [ ] المشروع يعمل بنجاح

## 🔧 حل المشاكل

### "Cannot connect to database"
- تأكد من أن متغيرات البيئة صحيحة
- تأكد من أن قاعدة البيانات تعمل
- تحقق من أن `DB_HOST` يحتوي على رقم المنفذ (مثلاً: `host:port`)

### "JWT_SECRET is required"
- أضف `JWT_SECRET` في Variables
- استخدم مفتاح عشوائي قوي (32 حرف على الأقل)

### "Port already in use"
- Railway يحدد PORT تلقائياً
- تأكد من أن `PORT` موجود في Variables

---

**ملاحظة:** بعد إضافة متغيرات البيئة، سيتم إعادة تشغيل المشروع تلقائياً.

