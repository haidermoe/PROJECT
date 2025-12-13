const express = require('express');
const router = express.Router();
const shiftsController = require('./shiftsController');
const { authMiddleware } = require('../auth/authMiddleware');

// جميع المسارات تحتاج توكن
router.use(authMiddleware);

// إنشاء جدول دوام (admin, manager, kitchen_manager)
router.post('/', (req, res, next) => {
  const userRole = req.user?.role;
  const allowedRoles = ['admin', 'manager', 'kitchen_manager'];
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({
      status: "error",
      message: "ليس لديك صلاحية لإنشاء جداول الدوام"
    });
  }
  next();
}, shiftsController.createSchedule);

// جلب جميع جداول الدوام
router.get('/', shiftsController.getSchedules);

// جلب تفاصيل جدول دوام
router.get('/:id', shiftsController.getScheduleDetails);

// الموافقة/الرفض على جدول دوام (admin only)
router.post('/:id/approve', (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ status: "error", message: "صلاحيات غير كافية" });
  }
  next();
}, shiftsController.approveSchedule);

module.exports = router;

