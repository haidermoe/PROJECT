const express = require("express");
const router = express.Router();
const approval = require("./approvalController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware } = require("../auth/authMiddleware");

// التحقق من أن المستخدم مدير
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ status: "error", message: "صلاحيات غير كافية" });
  }
  next();
}

// ===============================
//          ROUTES
// ===============================

router.post("/request", authMiddleware, approval.requestApproval);
router.get("/requests", authMiddleware, requireAdmin, approval.getApprovalRequests);
router.post("/approve/:id", authMiddleware, requireAdmin, approval.approveRequest);
router.post("/reject/:id", authMiddleware, requireAdmin, approval.rejectRequest);

module.exports = router;

