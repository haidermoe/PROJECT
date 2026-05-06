const express = require("express");
const router = express.Router();
const inv = require("./inventoryController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware, requireRole } = require("../auth/authMiddleware");

// ===============================
//          ROUTES
// ===============================

router.get("/items", authMiddleware, inv.getItems);
router.get("/low-stock", authMiddleware, inv.getLowStock);
router.get("/kpi", authMiddleware, inv.getKPI);
router.get("/chart", authMiddleware, inv.getChart);

router.post("/add", authMiddleware, requireRole('admin', 'manager', 'kitchen_manager'), inv.addItem);
router.put("/edit/:id", authMiddleware, requireRole('admin', 'manager', 'kitchen_manager'), inv.editItem);
router.delete("/delete/:id", authMiddleware, requireRole('admin', 'manager', 'kitchen_manager'), inv.deleteItem);

router.post("/withdraw/:id", authMiddleware, requireRole('admin', 'manager', 'kitchen_manager'), inv.withdraw);
router.post("/deposit/:id", authMiddleware, requireRole('admin', 'manager', 'kitchen_manager'), inv.deposit);

module.exports = router;
