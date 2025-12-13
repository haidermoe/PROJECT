# ⚡ حل سريع لخطأ Foreign Key

## المشكلة
```
Cannot add or update a child row: a foreign key constraint fails 
(`kitchen_inventory`.`transactions`, CONSTRAINT `transactions_ibfk_2` 
FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL)
```

## ✅ الحل السريع

### الطريقة 1: تلقائياً (موصى به)
الكود الآن يقوم بإزالة Foreign Key constraint تلقائياً. فقط:
1. أعد تشغيل السيرفر
2. جرب إنتاج وصفة مرة أخرى

### الطريقة 2: يدوياً (إذا لم يعمل التلقائي)

**من MySQL Command Line:**
```sql
USE kitchen_inventory;
ALTER TABLE transactions DROP FOREIGN KEY transactions_ibfk_2;
```

**أو من MySQL Workbench:**
1. افتح MySQL Workbench
2. اختر قاعدة البيانات `kitchen_inventory`
3. اذهب إلى جدول `transactions`
4. افتح "Foreign Keys" tab
5. احذف Foreign Key الذي يشير إلى `users.id`

**أو استخدم SQL Script:**
```bash
mysql -u root -p kitchen_inventory < database/sql/fix_transactions_foreign_key.sql
```

---

## 📝 السبب
- المستخدمين في `auth_db.users` (قاعدة بيانات منفصلة)
- Foreign Key constraint يشير إلى `kitchen_inventory.users` (غير موجود)
- عند إدراج `user_id` من `auth_db`، يفشل لأنه غير موجود في `kitchen_inventory.users`

---

## ✅ بعد الإصلاح
- ✅ يمكن إدراج transactions بدون أخطاء
- ✅ معلومات المستخدم محفوظة في `note` field
- ✅ النظام يعمل بشكل طبيعي

---

**جرب الآن!** 🚀

