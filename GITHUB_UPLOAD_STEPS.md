# خطوات رفع المشروع على GitHub 🚀

## ✅ الخطوة 1: إضافة الملفات الجديدة

```bash
cd c:\Users\user\Desktop\project
git add .
```

## ✅ الخطوة 2: عمل Commit

```bash
git commit -m "Add deployment files and documentation"
```

## ✅ الخطوة 3: رفع المشروع

### إذا كان لديك مستودع موجود على GitHub:

```bash
# رفع التغييرات
git push origin main
```

### إذا لم يكن لديك مستودع بعد:

#### أ) إنشاء مستودع جديد على GitHub:
1. اذهب إلى [GitHub.com](https://github.com)
2. اضغط على **"+"** في الأعلى → **"New repository"**
3. أدخل اسم المستودع (مثلاً: `kitchen-inventory-system`)
4. اختر **Public** أو **Private**
5. **لا** تضع علامة على "Initialize with README" (لأن المشروع موجود)
6. اضغط **"Create repository"**

#### ب) ربط المشروع بالمستودع الجديد:

```bash
# استبدل YOUR_USERNAME و YOUR_REPO_NAME بالقيم الصحيحة
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# أو إذا كان المستودع موجود بالفعل، استخدم:
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# رفع المشروع
git branch -M main
git push -u origin main
```

## 🔐 إذا طُلب منك اسم المستخدم وكلمة المرور:

### الطريقة 1: استخدام Personal Access Token
1. اذهب إلى GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. اضغط "Generate new token"
3. اختر الصلاحيات: `repo` (كامل)
4. انسخ الـ Token
5. استخدمه ككلمة مرور عند الرفع

### الطريقة 2: استخدام GitHub CLI
```bash
# تثبيت GitHub CLI
winget install GitHub.cli

# تسجيل الدخول
gh auth login

# رفع المشروع
git push origin main
```

## 📋 ملخص الأوامر (نسخ ولصق):

```bash
cd c:\Users\user\Desktop\project
git add .
git commit -m "Complete kitchen inventory management system"
git push origin main
```

## ⚠️ ملاحظات مهمة:

1. ✅ تأكد من أن `.env` موجود في `.gitignore` (لا ترفع معلومات حساسة)
2. ✅ تأكد من أن `node_modules` مستثنى (موجود في `.gitignore`)
3. ✅ راجع الملفات قبل الرفع: `git status`

## 🎯 بعد الرفع:

- ✅ المشروع سيكون متاحاً على: `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME`
- ✅ يمكنك مشاركة الرابط مع الآخرين
- ✅ يمكنك استنساخه على أي جهاز: `git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git`

---

## 🚀 للنشر المباشر (تشغيل المشروع أونلاين):

راجع ملف `DEPLOYMENT_GUIDE.md` للحصول على خيارات النشر:
- **Heroku** (سهل)
- **Railway** (سهل جداً)
- **Vercel** (للـ Frontend)
- **DigitalOcean** (محترف)
- **VPS** (كامل التحكم)

