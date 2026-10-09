const express = require('express');
const router = express.Router();
const controller = require('./kitchenOperationsController');
const { authMiddleware } = require('../auth/authMiddleware');

// حساب مقادير التحضير
router.post('/prep/calculate', authMiddleware, controller.calculatePrepPlan);

// تأكيد إنتاج دفعة تحضيرية وطباعة الباركودات
router.post('/prep/produce', authMiddleware, controller.producePrepBatch);

// مسح باركود العلبة وإيداعها في السكشن
router.post('/scan/station-transfer', authMiddleware, controller.scanItemToStation);

// كشف المطابقة بنهاية الشفت ومبيعات الويترية
router.get('/audit/summary', authMiddleware, controller.getStationAuditSummary);

// حفظ وإرسال كشف المطابقة مع التبريرات
router.post('/audit/submit', authMiddleware, controller.submitStationAudit);

// قائمة جلسات الجرد والمطابقة للمدراء والشيف
router.get('/audit/list', authMiddleware, controller.listStationAudits);

module.exports = router;
