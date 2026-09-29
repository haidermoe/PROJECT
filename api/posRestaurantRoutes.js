const express = require('express');
const router = express.Router();
const controller = require('./posRestaurantController');
const { authMiddleware } = require('../auth/authMiddleware');

// جميع مسارات الويتر والصالات محمية بتوكن الدخول
router.use(authMiddleware);

// الصالات والطاولات
router.get('/floors-and-tables', controller.getFloorsAndTables);
router.post('/floors', controller.createFloor);
router.post('/tables', controller.createTable);

// قائمة الطعام المتاحة
router.get('/menu', controller.getMenu);

// طلب الطاولة الفعلي
router.get('/tables/:tableId/order', controller.getTableOrder);

// إرسال طلب جديد من الويتر للمطبخ
router.post('/order/send', controller.sendWaiterOrder);

// محاسبة الطلب وإخلاء الطاولة وتوليد القيد المحاسبي
router.post('/order/pay', controller.payAndCloseOrder);

module.exports = router;
