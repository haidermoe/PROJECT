const express = require("express");
const router = express.Router();
const waste = require("./wasteController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware } = require("../auth/authMiddleware");

// ===============================
//          ROUTES
// ===============================

// تسجيل هدر جديد (مدير المطبخ)
router.post("/", authMiddleware, waste.addWaste);

// جلب جميع سجلات الهدر
router.get("/", authMiddleware, waste.getWasteRecords);

// الموافقة/رفض الهدر (المدير العام فقط)
router.put("/:id/approve", authMiddleware, waste.approveWaste);

// إحصائيات الهدر
router.get("/stats", authMiddleware, waste.getWasteStats);

module.exports = router;

