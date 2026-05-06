const express = require('express');
const router = express.Router();
const controller = require('./printRoutingController');
const { authMiddleware, requireRole } = require('../auth/authMiddleware');

router.use(authMiddleware);

router.get('/print-config', requireRole('admin'), controller.getPrintConfiguration);
router.put('/print-config', requireRole('admin'), controller.updatePrintConfiguration);

router.get('/stations', requireRole('admin'), controller.listStations);
router.post('/stations', requireRole('admin'), controller.createStation);
router.put('/stations/:id', requireRole('admin'), controller.updateStation);
router.post('/stations/:id/test-print', requireRole('admin'), controller.testSingleStation);
router.post('/stations/test-print-all', requireRole('admin'), controller.testAllActiveStations);

router.get('/items', requireRole('admin'), controller.listItems);
router.post('/items', requireRole('admin'), controller.createItem);
router.put('/items/:id', requireRole('admin'), controller.updateItem);

router.post('/orders/print', requireRole('manager', 'kitchen_manager'), controller.createOrderAndPrint);

router.get('/queue', requireRole('admin'), controller.listPrintQueue);
router.post('/queue', requireRole('admin'), controller.clearPrintQueue);

module.exports = router;
