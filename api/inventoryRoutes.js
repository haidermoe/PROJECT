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

// تحضير وإنتاج دفعة تشغيلية لمادة مصنعة
router.post("/produce-batch", authMiddleware, requireRole('admin', 'manager', 'kitchen_manager', 'chef'), inv.produceBatch);


// مسارات مخزون السكاشن والعهد التشغيلية
router.get("/station-stocks", authMiddleware, inv.getStationStocks);
router.post("/station-transfer", authMiddleware, requireRole('admin', 'manager', 'kitchen_manager'), inv.transferToStationStock);

// حساب التغطية والإنتاجية المتوقعة (المواد الخام والمصنعة)
router.post("/station-coverage", authMiddleware, inv.getStationCoverage);

// طلبات تحويل العهد واعتماد مدير المطبخ
router.post("/station-transfer-request", authMiddleware, inv.requestStationTransferStock);
router.get("/station-transfer-requests", authMiddleware, inv.getStationTransferRequests);
router.post("/station-transfer-requests/:id/approve", authMiddleware, requireRole('admin', 'kitchen_manager'), inv.approveStationTransferRequest);
router.post("/station-transfer-requests/:id/reject", authMiddleware, requireRole('admin', 'kitchen_manager'), inv.rejectStationTransferRequest);

module.exports = router;

