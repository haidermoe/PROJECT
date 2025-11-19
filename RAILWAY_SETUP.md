# إعداد المشروع على Railway 🚂

## ✅ الخطوة 1: إضافة متغيرات البيئة

بعد اكتمال النشر، اذهب إلى:
**Settings → Variables** في Railway

أضف المتغيرات التالية:

```
DB_HOST=your_mysql_host
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=kitchen_inventory
AUTH_DB_NAME=auth_db
JWT_SECRET=your_random_secret_key_here_min_32_chars
PORT=3000
NODE_ENV=production
```

### 🔑 إنشاء JWT_SECRET:
```bash
# في PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

أو استخدم موقع: https://randomkeygen.com

---

## ✅ الخطوة 2: إعداد قاعدة البيانات

### خيار 1: استخدام Railway MySQL Plugin
1. في Railway Dashboard
2. اضغط **"+ New"** → **"Database"** → **"Add MySQL"**
3. Railway سينشئ قاعدة بيانات تلقائياً
4. انسخ معلومات الاتصال من **Variables**
5. استخدمها في متغيرات البيئة للمشروع

### خيار 2: استخدام قاعدة بيانات خارجية
- **PlanetScale** (مجاني): https://planetscale.com
- **Supabase** (مجاني): https://supabase.com
- **Aiven** (مجاني): https://aiven.io

---

## ✅ الخطوة 3: تشغيل سكريبتات قاعدة البيانات

بعد إعداد قاعدة البيانات، ستحتاج إلى:

### أ) الاتصال بقاعدة البيانات:
```bash
# من Railway CLI أو من جهازك المحلي
railway connect mysql
```

### ب) تشغيل سكريبتات SQL:
```sql
-- 1. إنشاء قاعدة بيانات المصادقة
SOURCE auth/auth_db.sql;

-- 2. إنشاء قاعدة بيانات التطبيق
SOURCE init.sql;

-- 3. إنشاء الجداول الإضافية
SOURCE database_updates_production.sql;
SOURCE database_updates_attendance.sql;
SOURCE database_updates_leaves.sql;
SOURCE database_updates_waste.sql;
```

### ج) أو استخدام Railway CLI:
```bash
# تثبيت Railway CLI
npm i -g @railway/cli

# تسجيل الدخول
railway login

# الاتصال بالمشروع
railway link

# تشغيل سكريبتات SQL
railway run mysql < auth/auth_db.sql
railway run mysql < init.sql
```

---

## ✅ الخطوة 4: إنشاء حساب مدير

بعد إعداد قاعدة البيانات:

```bash
# من Railway CLI
railway run node auth/create_first_admin.js
```

أو من جهازك المحلي (بعد إعداد متغيرات البيئة):
```bash
node auth/create_first_admin.js
```

---

## ✅ الخطوة 5: التحقق من النشر

1. انتظر حتى يكتمل النشر (ستظهر "Active" بدلاً من "INITIALIZING")
2. اضغط على الرابط: `web-production-bbcf.up.railway.app`
3. يجب أن تظهر صفحة تسجيل الدخول

---

## 🔧 حل المشاكل الشائعة

### المشكلة: "Cannot connect to database"
**الحل:**
- تأكد من أن متغيرات البيئة صحيحة
- تأكد من أن قاعدة البيانات تعمل
- تحقق من أن `DB_HOST` و `DB_USER` و `DB_PASSWORD` صحيحة

### المشكلة: "Port already in use"
**الحل:**
- Railway يستخدم متغير `PORT` تلقائياً
- تأكد من أن `PORT` موجود في Variables
- لا تحدد port ثابت في `server.js`

### المشكلة: "Module not found"
**الحل:**
- تأكد من أن `package.json` موجود
- Railway سيثبت المكتبات تلقائياً من `package.json`

### المشكلة: "JWT_SECRET is required"
**الحل:**
- أضف `JWT_SECRET` في Variables
- استخدم مفتاح عشوائي قوي (32 حرف على الأقل)

---

## 📊 مراقبة المشروع

### View Logs:
- اضغط على **"View logs"** في Railway Dashboard
- أو استخدم: `railway logs`

### Metrics:
- اذهب إلى **"Metrics"** tab
- راقب استخدام CPU و Memory

---

## 🔄 تحديث المشروع

عندما تريد تحديث المشروع:

```bash
# من جهازك المحلي
git add .
git commit -m "Update project"
git push origin main
```

Railway سيكتشف التحديث تلقائياً ويبدأ نشر جديد!

---

## 🌐 الحصول على Domain مخصص

1. اذهب إلى **Settings** → **Networking**
2. اضغط **"Generate Domain"**
3. أو أضف domain مخصص من **"Custom Domain"**

---

## 💡 نصائح

- ✅ استخدم **Environment Variables** دائماً للمعلومات الحساسة
- ✅ راقب **Logs** عند حدوث مشاكل
- ✅ استخدم **Metrics** لمراقبة الأداء
- ✅ فعّل **Auto-Deploy** من GitHub

---

**رابط المشروع:** https://railway.app/project/YOUR_PROJECT_ID

