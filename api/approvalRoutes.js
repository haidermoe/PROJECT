const express = require("express");
const router = express.Router();
const approval = require("./approvalController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware, requireRole } = require("../auth/authMiddleware");

// ===============================
//          ROUTES
// ===============================

router.post("/request", authMiddleware, approval.requestApproval);
router.get("/requests", authMiddleware, requireRole('admin', 'manager'), approval.getApprovalRequests);
router.post("/approve/:id", authMiddleware, requireRole('admin', 'manager'), approval.approveRequest);
router.post("/reject/:id", authMiddleware, requireRole('admin', 'manager'), approval.rejectRequest);

module.exports = router;

