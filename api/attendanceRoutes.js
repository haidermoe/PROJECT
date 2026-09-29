const express = require("express");
const router = express.Router();
const attendance = require("./attendanceController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware, requireRole } = require("../auth/authMiddleware");

// ===============================
//          ROUTES
// ===============================

// تسجيل دخول
router.post("/checkin", authMiddleware, attendance.checkIn);

// تسجيل خروج
router.post("/checkout", authMiddleware, attendance.checkOut);

// جلب حالة البصمة الحالية
router.get("/status", authMiddleware, attendance.getCurrentStatus);

// جلب سجلات البصمة للموظف
router.get("/my-records", authMiddleware, attendance.getMyAttendance);

// جلب سجلات جميع الموظفين (للمدير و HR)
router.get("/all", authMiddleware, requireRole('admin', 'manager', 'hr'), attendance.getAllAttendance);
router.get("/all-records", authMiddleware, requireRole('admin', 'manager', 'hr'), attendance.getAllAttendance);

// إحصائيات ساعات العمل (للمدير)
router.get("/work-hours-stats", authMiddleware, requireRole('admin', 'manager', 'hr'), attendance.getWorkHoursStats);

module.exports = router;

