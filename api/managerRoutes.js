const express = require('express');
const router = express.Router();
const managerController = require('./managerController');
const { authMiddleware } = require('../auth/authMiddleware');

// Middleware to ensure only managers or admins can access these routes
const managerOnly = (req, res, next) => {
  if (req.user && (req.user.role === 'manager' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ status: "error", message: "Access denied. Managers only." });
  }
};

router.use(authMiddleware);
router.use(managerOnly);

router.get('/ranking', managerController.getEmployeeRanking);
router.get('/waste-metrics', managerController.getWasteMetrics);
router.get('/fraud-alerts', managerController.getFraudAlerts);
router.get('/low-stock', managerController.getLowStockAlerts);
router.post('/z-report', managerController.generateZReport);
router.get('/z-report', managerController.getZReports);

module.exports = router;
