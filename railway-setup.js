/**
 * ======================================================
 * Railway Setup Script - سكريبت إعداد Railway
 * ======================================================
 * 
 * هذا السكريبت يساعد في إعداد قاعدة البيانات على Railway
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupRailwayDatabase() {
  console.log('🚀 بدء إعداد قاعدة البيانات على Railway...\n');

  // التحقق من متغيرات البيئة
  const requiredVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'AUTH_DB_NAME'];
  const missingVars = requiredVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.error('❌ متغيرات البيئة المفقودة:', missingVars.join(', '));
    console.log('\n📝 يرجى إضافة المتغيرات التالية في Railway → Settings → Variables:');
    console.log('   DB_HOST=your_mysql_host');
    console.log('   DB_USER=your_mysql_user');
    console.log('   DB_PASSWORD=your_mysql_password');
    console.log('   DB_NAME=kitchen_inventory');
    console.log('   AUTH_DB_NAME=auth_db');
    console.log('   JWT_SECRET=your_secret_key');
    console.log('   PORT=3000');
    process.exit(1);
  }

  let connection;

  try {
    // الاتصال بقاعدة البيانات
    console.log('🔵 جاري الاتصال بقاعدة البيانات...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });

    console.log('✅ تم الاتصال بنجاح\n');

    // إنشاء قاعدة بيانات المصادقة
    console.log('🔵 جاري إنشاء قاعدة بيانات المصادقة...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.AUTH_DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE ${process.env.AUTH_DB_NAME}`);
    
    // قراءة وتنفيذ سكريبت auth_db.sql
    const fs = require('fs');
    const path = require('path');
    
    try {
      const authDbSql = fs.readFileSync(path.join(__dirname, 'auth', 'auth_db.sql'), 'utf8');
      // إزالة CREATE DATABASE من السكريبت لأننا أنشأناه بالفعل
      const cleanedSql = authDbSql.replace(/CREATE DATABASE.*?;/gi, '').replace(/USE.*?;/gi, '');
      await connection.query(cleanedSql);
      console.log('✅ تم إنشاء قاعدة بيانات المصادقة وجداولها\n');
    } catch (err) {
      console.log('⚠️ لم يتم العثور على auth_db.sql، سيتم إنشاء الجدول مباشرة...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          role ENUM('admin','manager','kitchen_manager','employee','waiter','captain','cleaner','hall_manager','hall_captain','receptionist','garage_employee','garage_manager') NOT NULL DEFAULT 'employee',
          full_name VARCHAR(100),
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('✅ تم إنشاء جدول users\n');
    }

    // إنشاء قاعدة بيانات التطبيق
    console.log('🔵 جاري إنشاء قاعدة بيانات التطبيق...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE ${process.env.DB_NAME}`);
    console.log('✅ تم إنشاء قاعدة بيانات التطبيق\n');

    // تشغيل سكريبتات إعداد الجداول
    console.log('🔵 جاري إنشاء الجداول...');
    
    // setup_production_tables
    try {
      const { execSync } = require('child_process');
      console.log('   - جداول الإنتاج...');
      execSync('node setup_production_tables.js', { stdio: 'inherit' });
    } catch (err) {
      console.log('   ⚠️ setup_production_tables.js فشل، سيتم تخطيه');
    }

    // setup_attendance_tables
    try {
      console.log('   - جداول البصمة...');
      execSync('node setup_attendance_tables.js', { stdio: 'inherit' });
    } catch (err) {
      console.log('   ⚠️ setup_attendance_tables.js فشل، سيتم تخطيه');
    }

    // setup_leaves_tables
    try {
      console.log('   - جداول الإجازات...');
      execSync('node setup_leaves_tables.js', { stdio: 'inherit' });
    } catch (err) {
      console.log('   ⚠️ setup_leaves_tables.js فشل، سيتم تخطيه');
    }

    // setup_waste_tables
    try {
      console.log('   - جداول الهدر...');
      execSync('node setup_waste_tables.js', { stdio: 'inherit' });
    } catch (err) {
      console.log('   ⚠️ setup_waste_tables.js فشل، سيتم تخطيه');
    }

    console.log('\n✅ تم إعداد قاعدة البيانات بنجاح!\n');

    // إنشاء حساب مدير
    console.log('🔵 هل تريد إنشاء حساب مدير الآن؟ (Y/n)');
    console.log('   يمكنك إنشاؤه لاحقاً باستخدام: node auth/create_first_admin.js\n');

  } catch (error) {
    console.error('❌ خطأ في إعداد قاعدة البيانات:', error.message);
    console.error('❌ تفاصيل الخطأ:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ تم إغلاق الاتصال');
    }
  }
}

// تشغيل السكريبت
setupRailwayDatabase()
  .then(() => {
    console.log('\n🎉 تم إكمال الإعداد بنجاح!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ فشل الإعداد:', error);
    process.exit(1);
  });

