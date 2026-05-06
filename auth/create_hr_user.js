/**
 * إنشاء حساب موارد بشرية (hr) — تشغيل: node auth/create_hr_user.js
 * يضبط عمود role ليقبل الرتبة hr إذا كانت قاعدة البيانات ما زالت ENUM قديماً.
 */
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

const USERNAME = process.env.HR_SEED_USERNAME || 'hr_manager';
const PASSWORD = process.env.HR_SEED_PASSWORD || 'hr_change_me';
const FULL_NAME = process.env.HR_SEED_FULL_NAME || 'موظف الموارد البشرية';

async function ensureRoleColumnAcceptsHr(pool) {
  const dbName = process.env.AUTH_DB_NAME || 'auth_db';
  const [rows] = await pool.execute(
    `SELECT DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`,
    [dbName]
  );
  if (rows.length && String(rows[0].DATA_TYPE).toLowerCase() === 'enum') {
    await pool.execute(
      `ALTER TABLE users MODIFY COLUMN role VARCHAR(64) NOT NULL DEFAULT 'employee'`
    );
    console.log('✅ تم توسيع عمود role ليقبل رتبة hr وجميع الرتب');
  }
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.AUTH_DB_HOST || process.env.DB_HOST,
    user: process.env.AUTH_DB_USER || process.env.DB_USER,
    password: process.env.AUTH_DB_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.AUTH_DB_NAME || 'auth_db'
  });

  try {
    await ensureRoleColumnAcceptsHr(pool);

    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE username = ?',
      [USERNAME]
    );

    if (existing.length > 0) {
      console.log('⚠️  المستخدم موجود مسبقاً:', USERNAME);
      console.log('   لتغيير الاسم استخدم HR_SEED_USERNAME أو احذف المستخدم من قاعدة البيانات.');
      return;
    }

    const hash = await bcrypt.hash(PASSWORD, 10);
    await pool.execute(
      `INSERT INTO users (username, password, role, full_name, is_active)
       VALUES (?, ?, 'hr', ?, 1)`,
      [USERNAME, hash, FULL_NAME]
    );

    console.log('✅ تم إنشاء حساب الموارد البشرية');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   اسم المستخدم:', USERNAME);
    console.log('   كلمة المرور:', PASSWORD);
    console.log('   الرتبة: hr');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  غيّر كلمة المرور فوراً في الإنتاج (أو عيّن HR_SEED_PASSWORD في .env)');
  } catch (err) {
    console.error('❌ خطأ:', err.message);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.error('   أنشئ قاعدة auth_db وشغّل auth/auth_db.sql أولاً');
    }
  } finally {
    await pool.end();
  }
}

main();
