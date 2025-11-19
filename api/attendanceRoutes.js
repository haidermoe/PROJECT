const express = require("express");
const router = express.Router();
const attendance = require("./attendanceController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware } = require("../auth/authMiddleware");

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

// جلب سجلات جميع الموظفين (للمدير)
router.get("/all-records", authMiddleware, attendance.getAllAttendance);

// إحصائيات ساعات العمل (للمدير)
router.get("/work-hours-stats", authMiddleware, attendance.getWorkHoursStats);

module.exports = router;

