const express = require('express');
const router = express.Router();
const rbacController = require('./rbacController');
const { authMiddleware, requireRole } = require('../auth/authMiddleware');

// جميع مسارات RBAC تتطلب تسجيل الدخول
router.use(authMiddleware);

// جلب صلاحيات المستخدم الحالي (متاح لجميع المستخدمين المسجلين)
router.get('/user-permissions', rbacController.getUserPermissions);

// جلب شجرة الصلاحيات والأدوار
router.get('/roles', rbacController.listRoles);
router.get('/permissions', rbacController.listPermissions);

// مسارات إدارة الصلاحيات وتعديلها (حصرياً للمدير العام admin)
router.post('/roles', requireRole('admin'), rbacController.createRole);
router.put('/roles/:roleId/permissions', requireRole('admin'), rbacController.updateRolePermissions);

module.exports = router;
