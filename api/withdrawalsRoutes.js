const express = require("express");
const router = express.Router();
const withdrawals = require("./withdrawalsController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware, requireRole } = require("../auth/authMiddleware");

// ===============================
//          ROUTES
// ===============================

// مسح QR Code وتسجيل السحب
router.post("/scan", authMiddleware, requireRole('admin', 'manager', 'kitchen_manager', 'kitchen_employee'), withdrawals.scanQRCode);

// جلب جميع السحوبات
router.get("/", authMiddleware, withdrawals.getWithdrawals);

// جلب سحب معين
router.get("/:id", authMiddleware, withdrawals.getWithdrawal);

// إحصائيات السحوبات
router.get("/stats/summary", authMiddleware, withdrawals.getWithdrawalsStats);

module.exports = router;

