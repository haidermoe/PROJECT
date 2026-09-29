/**
 * ======================================================
 * Middleware للأمان - Security Middleware
 * ======================================================
 * 
 * هذا الملف يحتوي على middleware للأمان والتحقق
 */

const { sanitizeInput, isValidUsername, isValidPassword, isValidRole } = require('../config/security');

/**
 * تنظيف جميع البيانات الواردة من الطلب
 */
function sanitizeRequest(req, res, next) {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeInput(req.body[key]);
      }
    }
  }
  
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeInput(req.query[key]);
      }
    }
  }
  
  if (req.params) {
    for (const key in req.params) {
      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizeInput(req.params[key]);
      }
    }
  }
  
  next();
}

/**
 * التحقق من صحة بيانات تسجيل الدخول
 */
function validateLogin(req, res, next) {
  try {
    const { username, password } = req.body;
    
    console.log('🔍 validateLogin: التحقق من بيانات تسجيل الدخول:', {
      username: username?.substring(0, 20),
      passwordLength: password?.length
    });
    
    if (!username || !password) {
      console.log('❌ validateLogin: الحقول مطلوبة');
      return res.status(400).json({
        status: 'error',
        message: 'اسم المستخدم وكلمة المرور مطلوبان'
      });
    }
    
    if (!isValidUsername(username)) {
      console.log('❌ validateLogin: اسم المستخدم غير صحيح:', username);
      return res.status(400).json({
        status: 'error',
        message: 'اسم المستخدم يجب أن يكون بين 3-50 حرف ويحتوي على أحرف وأرقام و _ فقط'
      });
    }
    
    if (!isValidPassword(password)) {
      console.log('❌ validateLogin: كلمة المرور غير صحيحة (الطول:', password.length, ')');
      return res.status(400).json({
        status: 'error',
        message: 'كلمة المرور يجب أن تكون بين 4-100 حرف'
      });
    }
    
    console.log('✅ validateLogin: البيانات صحيحة، المتابعة...');
    next();
  } catch (error) {
    console.error('❌ validateLogin: خطأ غير متوقع:', error);
    return res.status(500).json({
      status: 'error',
      message: 'خطأ في التحقق من البيانات'
    });
  }
}

/**
 * التحقق من صحة بيانات إنشاء مستخدم جديد
 */
function validateCreateUser(req, res, next) {
  try {
    const { username, password, role, full_name } = req.body;
    
    console.log('🔍 validateCreateUser: التحقق من البيانات:', { 
      username: username?.substring(0, 20), 
      passwordLength: password?.length,
      role,
      hasFullName: !!full_name
    });
    
    if (!username || !password) {
      console.log('❌ validateCreateUser: الحقول مطلوبة');
      return res.status(400).json({
        status: 'error',
        message: 'اسم المستخدم وكلمة المرور مطلوبان'
      });
    }
    
    // التحقق من اسم المستخدم
    if (!isValidUsername(username)) {
      console.log('❌ validateCreateUser: اسم المستخدم غير صحيح:', username);
      return res.status(400).json({
        status: 'error',
        message: `اسم المستخدم يجب أن يكون بين 3-50 حرف ويحتوي على أحرف وأرقام و _ فقط`
      });
    }
    
    // التحقق من كلمة المرور
    if (!isValidPassword(password)) {
      console.log('❌ validateCreateUser: كلمة المرور غير صحيحة (الطول:', password.length, ')');
      return res.status(400).json({
        status: 'error',
        message: `كلمة المرور يجب أن تكون بين 4-100 حرف`
      });
    }
    
    // التحقق من الرتبة (اختياري)
    if (role && !isValidRole(role)) {
      console.log('❌ validateCreateUser: رتبة غير صحيحة:', role);
      return res.status(400).json({
        status: 'error',
        message: 'رتبة غير صحيحة. الرتب المتاحة: admin, manager, kitchen_manager, employee'
      });
    }
    
    console.log('✅ validateCreateUser: البيانات صحيحة، المتابعة...');
    next();
  } catch (error) {
    console.error('❌ validateCreateUser: خطأ غير متوقع:', error);
    return res.status(500).json({
      status: 'error',
      message: 'خطأ في التحقق من البيانات'
    });
  }
}

/**
 * منع تسريب معلومات حساسة في الأخطاء
 */
function errorHandler(err, req, res, next) {
  console.error('❌ خطأ:', err);
  
  // لا نكشف تفاصيل الأخطاء للمستخدم
  const message = process.env.NODE_ENV === 'production' 
    ? 'حدث خطأ في السيرفر' 
    : err.message;
  
  res.status(err.status || 500).json({
    status: 'error',
    message: message
  });
}

/**
 * تسجيل محاولات الوصول
 */
function logAccess(req, res, next) {
  const { logUnauthorizedAccess } = require('../config/security').loggingConfig;
  
  if (logUnauthorizedAccess) {
    console.log(`📝 ${req.method} ${req.path} - IP: ${req.ip} - ${new Date().toISOString()}`);
  }
  
  next();
}

module.exports = {
  sanitizeRequest,
  validateLogin,
  validateCreateUser,
  errorHandler,
  logAccess
};

