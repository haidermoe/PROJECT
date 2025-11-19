/**
 * ======================================================
 * Auth Routes - مسارات المصادقة
 * ======================================================
 */

const express = require('express');
const {
  login,
  createUser,
  me,
  getUsers,
  updateUser,
  toggleUser,
  deleteUser
} = require('./authController');

// استيراد الميدل وير
const { authMiddleware, requireRole } = require('./authMiddleware');
const { validateLogin, validateCreateUser } = require('../middleware/security');

const router = express.Router();


// =======================
// المسارات (Routes)
// =======================

// تسجيل الدخول (مع التحقق من البيانات)
router.post('/login', validateLogin, login);

// إنشاء مستخدم جديد (بس الأدمن) - مع التحقق من البيانات
// ملاحظة: validateCreateUser يتحقق من البيانات قبل createUser
router.post('/users', authMiddleware, requireRole('admin'), validateCreateUser, createUser);

// يرجع بيانات المستخدم الحالي بناءً على التوكن
router.get('/me', authMiddleware, me);

// جلب جميع المستخدمين — فقط الأدمن
router.get('/users', authMiddleware, requireRole('admin'), getUsers);

// تحديث مستخدم معيّن
router.put('/users/:id', authMiddleware, requireRole('admin'), updateUser);

// تعطيل / تفعيل حساب
router.patch('/users/:id/toggle', authMiddleware, requireRole('admin'), toggleUser);

// حذف مستخدم
router.delete('/users/:id', authMiddleware, requireRole('admin'), deleteUser);


module.exports = router;
