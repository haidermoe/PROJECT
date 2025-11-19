// ======================================================
// سكريبت إنشاء حساب مدير أولي
// تشغيل: node auth/create_first_admin.js
// ======================================================

const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createAdmin() {
  const pool = mysql.createPool({
    host: process.env.AUTH_DB_HOST,
    user: process.env.AUTH_DB_USER,
    password: process.env.AUTH_DB_PASSWORD,
    database: process.env.AUTH_DB_NAME
  });

  const username = 'admin';
  const password = 'admin123'; // ⚠️ غيّرها بعد أول تسجيل دخول!
  const fullName = 'مدير النظام';

  try {
    // التحقق من وجود حساب مدير
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      console.log('⚠️  حساب المدير موجود مسبقاً!');
      console.log(`اسم المستخدم: ${username}`);
      return;
    }

    // تشفير كلمة المرور
    const hash = await bcrypt.hash(password, 10);

    // إنشاء حساب المدير
    await pool.execute(
      `INSERT INTO users (username, password, role, full_name, is_active)
       VALUES (?, ?, 'admin', ?, 1)`,
      [username, hash, fullName]
    );

    console.log('✅ تم إنشاء حساب المدير بنجاح!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`اسم المستخدم: ${username}`);
    console.log(`كلمة المرور: ${password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  مهم: غيّر كلمة المرور بعد أول تسجيل دخول!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ خطأ في إنشاء حساب المدير:', error.message);
  } finally {
    await pool.end();
  }
}

createAdmin();

