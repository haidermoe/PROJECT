const express = require('express');
const router = express.Router();
const controller = require('./posRestaurantController');
const { authMiddleware } = require('../auth/authMiddleware');

// جميع مسارات الويتر والصالات محمية بتوكن الدخول
router.use(authMiddleware);

// الصالات والطاولات
router.get('/floors-and-tables', controller.getFloorsAndTables);
router.post('/floors', controller.createFloor);
router.delete('/floors/:id', controller.deleteFloor);
router.post('/tables', controller.createTable);
router.delete('/tables/:id', controller.deleteTable);

// قائمة الطعام المتاحة وإدارتها
router.get('/menu', controller.getMenu);
router.post('/items', controller.createMenuItem);
router.put('/items/:id', controller.updateMenuItem);
router.delete('/items/:id', controller.deleteMenuItem);

// جلب السكاشن والوصفات لربط المنيو
router.get('/stations-and-recipes', controller.getStationsAndRecipes);

// إدارة الملاحظات السريعة
router.get('/quick-notes', controller.getQuickNotes);
router.post('/quick-notes', controller.createQuickNote);
router.delete('/quick-notes/:id', controller.deleteQuickNote);

// طلب الطاولة الفعلي
router.get('/tables/:tableId/order', controller.getTableOrder);

// إرسال طلب جديد من الويتر للمطبخ
router.post('/order/send', controller.sendWaiterOrder);

// محاسبة الطلب وإخلاء الطاولة وتوليد القيد المحاسبي
router.post('/order/pay', controller.payAndCloseOrder);

module.exports = router;
