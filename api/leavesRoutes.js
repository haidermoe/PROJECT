const express = require("express");
const router = express.Router();
const leaves = require("./leavesController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware } = require("../auth/authMiddleware");

// ===============================
//          ROUTES
// ===============================

// إرسال طلب إجازة
router.post("/request", authMiddleware, leaves.requestLeave);

// جلب طلباتي
router.get("/my-leaves", authMiddleware, leaves.getMyLeaves);

// جلب جميع الطلبات (للمدير)
router.get("/all-leaves", authMiddleware, leaves.getAllLeaves);

// الموافقة/الرفض على طلب إجازة (للمدير)
router.post("/approve/:id", authMiddleware, leaves.approveLeave);

// إلغاء طلب إجازة (للمستخدم نفسه)
router.post("/cancel/:id", authMiddleware, leaves.cancelLeave);

// جلب رصيد الإجازات
router.get("/balance", authMiddleware, leaves.getLeaveBalance);

module.exports = router;

