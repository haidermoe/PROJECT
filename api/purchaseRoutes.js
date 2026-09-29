const express = require('express');
const router = express.Router();
const controller = require('./purchaseController');
const { authMiddleware, requireRole } = require('../auth/authMiddleware');

router.use(authMiddleware);

// لوحة المؤشرات (KPIs)
router.get('/kpis', requireRole('admin', 'manager', 'kitchen_manager'), controller.getPurchaseKPIs);

// الموردين (Vendors)
router.get('/vendors', requireRole('admin', 'manager', 'kitchen_manager'), controller.getVendors);
router.get('/vendors/:id', requireRole('admin', 'manager', 'kitchen_manager'), controller.getVendorById);
router.post('/vendors', requireRole('admin', 'manager'), controller.createVendor);
router.put('/vendors/:id', requireRole('admin', 'manager'), controller.updateVendor);

// أوامر الشراء (Purchase Orders)
router.get('/orders', requireRole('admin', 'manager', 'kitchen_manager'), controller.getOrders);
router.get('/orders/:id', requireRole('admin', 'manager', 'kitchen_manager'), controller.getOrderDetails);
router.post('/orders', requireRole('admin', 'manager', 'kitchen_manager'), controller.createOrder);
router.post('/orders/:id/confirm', requireRole('admin', 'manager'), controller.confirmOrder);
router.post('/orders/:id/receive', requireRole('admin', 'manager', 'kitchen_manager'), controller.receiveOrder);
router.post('/orders/:id/create-bill', requireRole('admin', 'manager'), controller.createVendorBill);

// فواتير الموردين وسداد الدفعات (Bills & Payments)
router.get('/bills', requireRole('admin', 'manager'), controller.getBills);
router.post('/bills/:id/pay', requireRole('admin', 'manager'), controller.payBill);

module.exports = router;
