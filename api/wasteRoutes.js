const express = require("express");
const router = express.Router();
const waste = require("./wasteController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware, requireRole } = require("../auth/authMiddleware");

// ===============================
//          ROUTES
// ===============================

// تسجيل هدر جديد (مدير المطبخ)
router.post("/", authMiddleware, requireRole('admin', 'manager', 'kitchen_manager'), waste.addWaste);

// جلب جميع سجلات الهدر
router.get("/", authMiddleware, waste.getWasteRecords);

// إحصائيات الهدر (يجب أن يكون قبل /:id routes)
router.get("/stats", authMiddleware, waste.getWasteStats);

// الموافقة/رفض الهدر (المدير العام فقط)
router.put("/:id/approve", authMiddleware, requireRole('admin', 'manager'), waste.approveWaste);

// إلغاء طلب هدر (للمستخدم نفسه أو admin)
router.post("/:id/cancel", authMiddleware, requireRole('admin', 'manager', 'kitchen_manager'), waste.cancelWaste);

module.exports = router;

