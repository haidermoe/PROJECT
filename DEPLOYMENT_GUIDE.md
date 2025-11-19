# دليل رفع المشروع أونلاين 🚀

## الطريقة 1: رفع المشروع على GitHub (مستودع كود)

### الخطوة 1: إنشاء حساب على GitHub
1. اذهب إلى [GitHub.com](https://github.com)
2. سجل حساب جديد (مجاني)
3. أنشئ مستودع جديد (New Repository)

### الخطوة 2: تهيئة Git في المشروع

```bash
# في مجلد المشروع
cd c:\Users\user\Desktop\project

# تهيئة Git (إذا لم يكن موجوداً)
git init

# إضافة جميع الملفات
git add .

# عمل commit أولي
git commit -m "Initial commit: Kitchen Inventory Management System"

# إضافة رابط المستودع (استبدل YOUR_USERNAME و YOUR_REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# رفع المشروع
git branch -M main
git push -u origin main
```

### الخطوة 3: إعدادات GitHub
- ✅ تأكد من أن `.env` موجود في `.gitignore` (لا ترفع معلومات حساسة)
- ✅ أضف `README.md` للمشروع
- ✅ اختر License مناسب

---

## الطريقة 2: نشر المشروع على Heroku (تشغيل مباشر)

### المتطلبات:
- حساب على [Heroku](https://www.heroku.com) (مجاني)
- Heroku CLI مثبت

### الخطوات:

```bash
# تثبيت Heroku CLI
# من: https://devcenter.heroku.com/articles/heroku-cli

# تسجيل الدخول
heroku login

# إنشاء تطبيق جديد
heroku create your-app-name

# إضافة متغيرات البيئة
heroku config:set DB_HOST=your_db_host
heroku config:set DB_USER=your_db_user
heroku config:set DB_PASSWORD=your_db_password
heroku config:set DB_NAME=your_db_name
heroku config:set AUTH_DB_NAME=auth_db
heroku config:set JWT_SECRET=your_jwt_secret
heroku config:set PORT=3000

# رفع المشروع
git push heroku main

# فتح التطبيق
heroku open
```

### ملف `Procfile` (مطلوب لـ Heroku):
```
web: node server.js
```

---

## الطريقة 3: نشر على Vercel (للـ Frontend)

### الخطوات:
1. اذهب إلى [Vercel.com](https://vercel.com)
2. سجل دخول بحساب GitHub
3. اضغط "New Project"
4. اختر المستودع من GitHub
5. Vercel سيكتشف الإعدادات تلقائياً

---

## الطريقة 4: نشر على Railway (سهل وسريع)

### الخطوات:
1. اذهب إلى [Railway.app](https://railway.app)
2. سجل دخول بحساب GitHub
3. اضغط "New Project" → "Deploy from GitHub repo"
4. اختر المستودع
5. أضف متغيرات البيئة من Settings → Variables
6. Railway سيشغل المشروع تلقائياً

---

## الطريقة 5: نشر على DigitalOcean App Platform

### الخطوات:
1. اذهب إلى [DigitalOcean](https://www.digitalocean.com)
2. أنشئ حساب جديد
3. اذهب إلى App Platform
4. اختر "Create App" → "GitHub"
5. اختر المستودع
6. أضف متغيرات البيئة
7. اضغط "Deploy"

---

## الطريقة 6: VPS (خادم خاص)

### المتطلبات:
- VPS من أي مزود (DigitalOcean, AWS, Azure, إلخ)
- Ubuntu/Debian Linux

### الخطوات:

```bash
# على الخادم
# 1. تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. تثبيت MySQL
sudo apt-get update
sudo apt-get install mysql-server

# 3. تثبيت PM2 (لإدارة Node.js)
sudo npm install -g pm2

# 4. رفع المشروع (باستخدام Git أو SCP)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME

# 5. تثبيت المكتبات
npm install

# 6. إعداد قاعدة البيانات
mysql -u root -p < auth/auth_db.sql
mysql -u root -p < init.sql

# 7. إعداد ملف .env
nano .env
# أضف جميع المتغيرات المطلوبة

# 8. تشغيل المشروع
pm2 start server.js --name kitchen-inventory
pm2 save
pm2 startup

# 9. إعداد Nginx كـ Reverse Proxy (اختياري)
sudo apt-get install nginx
# إعداد Nginx للعمل مع المشروع
```

---

## ⚠️ ملاحظات مهمة:

### 1. أمان قاعدة البيانات:
- ❌ **لا ترفع** ملف `.env` على GitHub
- ✅ استخدم متغيرات البيئة في المنصة المستخدمة
- ✅ استخدم قاعدة بيانات منفصلة للإنتاج

### 2. قاعدة البيانات:
- يمكنك استخدام:
  - **MySQL على الخادم**
  - **PlanetScale** (MySQL مجاني)
  - **Supabase** (PostgreSQL مجاني)
  - **MongoDB Atlas** (إذا غيرت إلى MongoDB)

### 3. الملفات المهمة:
- ✅ `package.json` - معلومات المشروع
- ✅ `server.js` - نقطة البداية
- ✅ `.gitignore` - الملفات المستثناة
- ✅ `README.md` - وثائق المشروع

### 4. إعدادات الإنتاج:
- غيّر `PORT` في `.env` إذا لزم الأمر
- استخدم `NODE_ENV=production`
- فعّل HTTPS
- استخدم قاعدة بيانات منفصلة للإنتاج

---

## 📝 ملفات إضافية مطلوبة:

### 1. `Procfile` (لـ Heroku):
```
web: node server.js
```

### 2. `README.md` (مثال):
```markdown
# Kitchen Inventory Management System

نظام إدارة مخزون المطبخ

## المميزات
- إدارة الوصفات
- إدارة المخزون
- نظام البصمة
- نظام الإجازات
- إدارة الموظفين

## التثبيت
npm install

## التشغيل
npm start
```

---

## 🎯 التوصية:

**للمبتدئين:** استخدم **Railway** أو **Heroku** (أسهل)
**للمحترفين:** استخدم **VPS** (أكثر تحكماً)

---

## 📞 مساعدة إضافية:

إذا واجهت مشاكل، تأكد من:
1. ✅ جميع المكتبات مثبتة (`npm install`)
2. ✅ قاعدة البيانات جاهزة
3. ✅ متغيرات البيئة صحيحة
4. ✅ المنفذ (Port) متاح

