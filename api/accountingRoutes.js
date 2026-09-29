const express = require('express');
const router = express.Router();
const controller = require('./accountingController');
const { authMiddleware, requireRole } = require('../auth/authMiddleware');

router.use(authMiddleware);

// شجرة الحسابات
router.get('/chart-of-accounts', requireRole('admin', 'manager'), controller.getChartOfAccounts);
router.post('/accounts', requireRole('admin'), controller.createAccount);

// دفاتر اليومية
router.get('/journals', requireRole('admin', 'manager'), controller.getJournals);

// القيود اليومية
router.get('/moves', requireRole('admin', 'manager'), controller.getMoves);
router.post('/moves', requireRole('admin', 'manager'), controller.createMove);

// التقارير والتحليلات المالية
router.get('/overview', requireRole('admin', 'manager'), controller.getFinancialOverview);
router.get('/reports/profit-and-loss', requireRole('admin', 'manager'), controller.getProfitAndLoss);
router.get('/reports/balance-sheet', requireRole('admin', 'manager'), controller.getBalanceSheet);
router.get('/reports/trial-balance', requireRole('admin', 'manager'), controller.getTrialBalance);

module.exports = router;
