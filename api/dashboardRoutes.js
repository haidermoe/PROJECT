const express = require('express');
const router = express.Router();
const dash = require('./dashboardController');
// استخدام authMiddleware الموحد من auth/authMiddleware.js
const { authMiddleware } = require("../auth/authMiddleware");

// API endpoints
router.get('/low-stock', authMiddleware, dash.getLowStock);
router.get('/daily-waste', authMiddleware, dash.getDailyWaste);
router.get('/last-out', authMiddleware, dash.getLastOut);
router.get('/employee-count', authMiddleware, dash.getEmployeeCount);
router.get('/employees', authMiddleware, dash.getEmployees);
router.get('/usd-rate', authMiddleware, dash.getUsdRate);

module.exports = router;
