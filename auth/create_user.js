// ======================================================
// سكريبت إنشاء حساب مستخدم (مرن - يمكنك اختيار الرتبة)
// تشغيل: node auth/create_user.js
// ======================================================

const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createUser() {
  const pool = mysql.createPool({
    host: process.env.AUTH_DB_HOST || process.env.DB_HOST,
    user: process.env.AUTH_DB_USER || process.env.DB_USER,
    password: process.env.AUTH_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.AUTH_DB_NAME || 'auth_db'
  });

  // ═══════════════════════════════════════════════════
  // ⚙️  غيّر هذه القيم حسب ما تريد:
  // ═══════════════════════════════════════════════════
  const username = 'chef';           // اسم المستخدم
  const password = 'chef123';        // كلمة المرور
  const fullName = 'مدير المطبخ';    // الاسم الكامل
  const role = 'kitchen_manager';    // الرتبة: admin, hr, manager, kitchen_manager, employee, ...
  // ═══════════════════════════════════════════════════

  try {
    const { allowedRoles: validRoles } = require('../config/security');
    if (!validRoles.includes(role)) {
      console.error('❌ رتبة غير صحيحة!');
      console.log('الرتب المتاحة:', validRoles.join(', '));
      return;
    }

    // التحقق من وجود حساب بنفس الاسم
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      console.log('⚠️  الحساب موجود مسبقاً!');
      console.log(`اسم المستخدم: ${username}`);
      return;
    }

    // تشفير كلمة المرور
    const hash = await bcrypt.hash(password, 10);

    // إنشاء الحساب
    await pool.execute(
      `INSERT INTO users (username, password, role, full_name, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [username, hash, role, fullName]
    );

    const roleNames = {
      'admin': '👑 مدير عام',
      'hr': '👥 موارد بشرية',
      'manager': '👔 مدير',
      'kitchen_manager': '👨‍🍳 مدير مطبخ',
      'employee': '👤 موظف'
    };

    console.log('✅ تم إنشاء الحساب بنجاح!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`اسم المستخدم: ${username}`);
    console.log(`كلمة المرور: ${password}`);
    console.log(`الرتبة: ${roleNames[role] || role}`);
    console.log(`الاسم الكامل: ${fullName}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  مهم: غيّر كلمة المرور بعد أول تسجيل دخول!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ خطأ في إنشاء الحساب:', error.message);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.error('❌ جدول المستخدمين غير موجود!');
      console.error('تأكد من إنشاء قاعدة البيانات auth_db وتشغيل auth_db.sql');
    }
  } finally {
    await pool.end();
  }
}

createUser();

