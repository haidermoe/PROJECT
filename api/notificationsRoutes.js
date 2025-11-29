/**
 * ======================================================
 * Notifications Routes - مسارات الإشعارات
 * ======================================================
 */

const express = require('express');
const {
  getNotifications,
  markAsRead,
  deleteNotification,
  getUnreadCount
} = require('./notificationsController');
const { authMiddleware } = require('../auth/authMiddleware');

const router = express.Router();

// جلب جميع الإشعارات
router.get('/', authMiddleware, getNotifications);

// جلب عدد الإشعارات غير المقروءة
router.get('/unread-count', authMiddleware, getUnreadCount);

// تحديد الإشعار كمقروء
router.patch('/:id/read', authMiddleware, markAsRead);

// حذف إشعار
router.delete('/:id', authMiddleware, deleteNotification);

module.exports = router;

