// auth/authMiddleware.js

const jwt = require('jsonwebtoken');
require('dotenv').config();

// التحقق من وجود التوكن وصحته
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || req.headers.Authorization;

  if (!header || !header.startsWith('Bearer ')) {
    console.log('❌ authMiddleware: لا يوجد توكن في الطلب');
    return res
      .status(401)
      .json({ status: 'error', message: 'مطلوب توكن للوصول' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded; // { id, username, role }
    console.log('✅ authMiddleware: تم التحقق من التوكن للمستخدم:', decoded.username, 'الرتبة:', decoded.role);
    next();
  } catch (err) {
    console.error('❌ authMiddleware: خطأ في التحقق من التوكن:', err.message);
    return res
      .status(401)
      .json({ status: 'error', message: 'توكن غير صالح أو منتهي' });
  }
}

// التحقق من الدور — يقبل عدة أدوار: requireRole('admin', 'hr')
// المدير العام (admin) يمر دائماً لأي مسار يستخدم هذا الميدل وير.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      console.log('❌ requireRole: لا يوجد مستخدم في req.user');
      return res
        .status(401)
        .json({ status: 'error', message: 'غير مصرح: لا يوجد مستخدم' });
    }

    const userRole = req.user.role;
    console.log(
      `🔍 requireRole: المطلوب أحد [${allowedRoles.join(', ')}]، المستخدم: ${userRole}`
    );

    if (userRole === 'admin') {
      console.log('✅ requireRole: مدير عام — مسموح');
      return next();
    }

    if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
      console.log('✅ requireRole: الصلاحيات كافية');
      return next();
    }

    console.log('❌ requireRole: صلاحيات غير كافية');
    return res
      .status(403)
      .json({ status: 'error', message: 'صلاحيات غير كافية' });
  };
}

module.exports = {
  authMiddleware,
  requireRole
};
