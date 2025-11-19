/**
 * ======================================================
 * إعدادات قواعد البيانات - Database Configuration
 * ======================================================
 * 
 * هذا الملف يحتوي على إعدادات قواعد البيانات بشكل معزول
 * لضمان أعلى درجات الأمان والفصل بين البيانات
 */

require('dotenv').config();

/**
 * التحقق من وجود متغيرات البيئة المطلوبة
 */
function validateEnvVariables() {
  const required = {
    // قاعدة بيانات المصادقة (معزولة تماماً)
    AUTH: ['AUTH_DB_HOST', 'AUTH_DB_USER', 'AUTH_DB_PASSWORD', 'AUTH_DB_NAME'],
    // قاعدة البيانات الرئيسية
    APP: ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'],
    // إعدادات JWT
    JWT: ['JWT_SECRET']
  };

  const missing = [];

  // التحقق من متغيرات قاعدة بيانات المصادقة
  required.AUTH.forEach(key => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  // التحقق من متغيرات قاعدة البيانات الرئيسية
  required.APP.forEach(key => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });

  // التحقق من JWT_SECRET
  if (!process.env.JWT_SECRET) {
    missing.push('JWT_SECRET');
  }

  if (missing.length > 0) {
    console.error('❌ متغيرات البيئة المفقودة:', missing.join(', '));
    console.error('⚠️  تأكد من وجود ملف .env مع جميع المتغيرات المطلوبة');
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }
}

/**
 * إعدادات قاعدة بيانات المصادقة (معزولة تماماً)
 * هذه القاعدة تحتوي فقط على بيانات المستخدمين والمصادقة
 */
const authDbConfig = {
  host: process.env.AUTH_DB_HOST,
  user: process.env.AUTH_DB_USER,
  password: process.env.AUTH_DB_PASSWORD,
  database: process.env.AUTH_DB_NAME || 'auth_db',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.AUTH_DB_CONNECTION_LIMIT || '10'),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  timezone: '+00:00'
};

/**
 * إعدادات قاعدة البيانات الرئيسية (للمخزن والوصفات)
 * هذه القاعدة منفصلة تماماً عن قاعدة بيانات المصادقة
 */
const appDbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'kitchen_inventory',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20'),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  timezone: '+00:00'
};

/**
 * إعدادات JWT
 * ملاحظة: يمكن تغيير مدة الصلاحية من متغير البيئة JWT_EXPIRES_IN
 * أمثلة: '1h' (ساعة), '24h' (يوم), '7d' (أسبوع), '30d' (شهر)
 */
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES_IN || '30d', // 30 يوم افتراضياً
  algorithm: 'HS256'
};

// التحقق من المتغيرات عند تحميل الملف
try {
  validateEnvVariables();
  console.log('✅ تم التحقق من متغيرات البيئة بنجاح');
} catch (error) {
  console.error('❌ خطأ في التحقق من متغيرات البيئة:', error.message);
  // لا نوقف التطبيق، لكن نطبع تحذير
}

module.exports = {
  authDbConfig,
  appDbConfig,
  jwtConfig,
  validateEnvVariables
};

