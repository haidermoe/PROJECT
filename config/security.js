/**
 * ======================================================
 * إعدادات الأمان - Security Configuration
 * ======================================================
 * 
 * هذا الملف يحتوي على إعدادات الأمان والتحقق
 */

require('dotenv').config();

/**
 * إعدادات CORS
 */
const corsConfig = {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

/**
 * إعدادات Rate Limiting
 */
const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // 100 طلب لكل IP
  message: 'تم تجاوز الحد المسموح من الطلبات، يرجى المحاولة لاحقاً'
};

/**
 * إعدادات التحقق من البيانات
 */
const validationConfig = {
  // الحد الأدنى والأقصى لطول اسم المستخدم
  username: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_]+$/
  },
  // الحد الأدنى والأقصى لطول كلمة المرور
  password: {
    minLength: 4,
    maxLength: 100
  },
  // الحد الأدنى والأقصى لطول الاسم الكامل
  fullName: {
    minLength: 2,
    maxLength: 100
  }
};

/**
 * إعدادات تسجيل الأحداث (Logging)
 */
const loggingConfig = {
  // تسجيل محاولات تسجيل الدخول الفاشلة
  logFailedLogins: true,
  // تسجيل جميع العمليات الحساسة
  logSensitiveOperations: true,
  // تسجيل محاولات الوصول غير المصرح بها
  logUnauthorizedAccess: true
};

/**
 * إعدادات الجلسات
 */
const sessionConfig = {
  // مدة انتهاء التوكن (بالثواني)
  tokenExpiration: 3600, // 1 ساعة
  // مدة انتهاء التوكن للتحديث
  refreshTokenExpiration: 7 * 24 * 3600 // 7 أيام
};

/**
 * قائمة بالرتب المسموحة
 */
const allowedRoles = [
  'admin',
  'manager',
  'kitchen_manager',
  'employee',
  'waiter',
  'captain',
  'cleaner',
  'hall_manager',
  'hall_captain',
  'receptionist',
  'garage_employee',
  'garage_manager'
];

/**
 * التحقق من صحة الرتبة
 */
function isValidRole(role) {
  return allowedRoles.includes(role);
}

/**
 * التحقق من صحة اسم المستخدم
 */
function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  if (username.length < validationConfig.username.minLength) return false;
  if (username.length > validationConfig.username.maxLength) return false;
  return validationConfig.username.pattern.test(username);
}

/**
 * التحقق من صحة كلمة المرور
 */
function isValidPassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < validationConfig.password.minLength) return false;
  if (password.length > validationConfig.password.maxLength) return false;
  return true;
}

/**
 * تنظيف البيانات من الأحرف الخطيرة (Sanitization)
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input
    .trim()
    .replace(/[<>]/g, '') // إزالة علامات HTML
    .replace(/javascript:/gi, '') // إزالة javascript:
    .replace(/on\w+=/gi, ''); // إزالة event handlers
}

module.exports = {
  corsConfig,
  rateLimitConfig,
  validationConfig,
  loggingConfig,
  sessionConfig,
  allowedRoles,
  isValidRole,
  isValidUsername,
  isValidPassword,
  sanitizeInput
};

