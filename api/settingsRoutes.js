const express = require('express');
const router = express.Router();
const settingsController = require('./settingsController');
const { authMiddleware } = require('../auth/authMiddleware');

// جميع المسارات تحتاج توكن
router.use(authMiddleware);

// جلب جميع الإعدادات (متاح لجميع المستخدمين - يحتاجونه لمعرفة موقع المطعم وساعات العمل)
router.get('/', settingsController.getSettings);

// تحديث الإعدادات (admin only)
router.put('/', (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      status: "error",
      message: "غير مسموح. فقط المدير العام يمكنه تحديث الإعدادات"
    });
  }
  next();
}, settingsController.updateSettings);

module.exports = router;

