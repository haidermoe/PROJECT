const express = require('express');
const router = express.Router();
const settingsController = require('./settingsController');
const { authMiddleware, requireRole } = require('../auth/authMiddleware');

// جميع المسارات تحتاج توكن
router.use(authMiddleware);

// جلب جميع الإعدادات (متاح لجميع المستخدمين - يحتاجونه لمعرفة موقع المطعم وساعات العمل)
router.get('/', settingsController.getSettings);

// تحديث الإعدادات (admin only)
router.put('/', requireRole('admin'), settingsController.updateSettings);

module.exports = router;

