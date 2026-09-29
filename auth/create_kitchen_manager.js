// ======================================================
// سكريبت إنشاء حساب مدير مطبخ
// تشغيل: node auth/create_kitchen_manager.js
// ======================================================

const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createKitchenManager() {
  const pool = mysql.createPool({
    host: process.env.AUTH_DB_HOST || process.env.DB_HOST,
    user: process.env.AUTH_DB_USER || process.env.DB_USER,
    password: process.env.AUTH_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.AUTH_DB_NAME || 'auth_db'
  });

  // يمكنك تغيير هذه القيم
  const username = 'chef'; // اسم المستخدم
  const password = 'chef123'; // كلمة المرور
  const fullName = 'مدير المطبخ'; // الاسم الكامل

  try {
    // التحقق من وجود حساب بنفس الاسم
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      console.log('⚠️  حساب مدير المطبخ موجود مسبقاً!');
      console.log(`اسم المستخدم: ${username}`);
      console.log('إذا أردت إنشاء حساب آخر، غيّر اسم المستخدم في الملف');
      return;
    }

    // تشفير كلمة المرور
    const hash = await bcrypt.hash(password, 10);

    // إنشاء حساب مدير مطبخ
    await pool.execute(
      `INSERT INTO users (username, password, role, full_name, is_active)
       VALUES (?, ?, 'kitchen_manager', ?, 1)`,
      [username, hash, fullName]
    );

    console.log('✅ تم إنشاء حساب مدير المطبخ بنجاح!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`اسم المستخدم: ${username}`);
    console.log(`كلمة المرور: ${password}`);
    console.log(`الرتبة: مدير مطبخ (kitchen_manager)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  مهم: غيّر كلمة المرور بعد أول تسجيل دخول!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ خطأ في إنشاء حساب مدير المطبخ:', error.message);
    console.error('تفاصيل:', error);
  } finally {
    await pool.end();
  }
}

createKitchenManager();

