const express = require("express");
const router = express.Router();
const inv = require("./inventoryController");
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware } = require("../auth/authMiddleware");

// ===============================
//          ROUTES
// ===============================

router.get("/items", authMiddleware, inv.getItems);
router.get("/low-stock", authMiddleware, inv.getLowStock);
router.get("/kpi", authMiddleware, inv.getKPI);
router.get("/chart", authMiddleware, inv.getChart);

router.post("/add", authMiddleware, inv.addItem);
router.put("/edit/:id", authMiddleware, inv.editItem);
router.delete("/delete/:id", authMiddleware, inv.deleteItem);

router.post("/withdraw/:id", authMiddleware, inv.withdraw);
router.post("/deposit/:id", authMiddleware, inv.deposit);

module.exports = router;
