const express = require('express');
const router = express.Router();
const branches = require('./branchesController');
const { authMiddleware, requireRole } = require('../auth/authMiddleware');

// ===============================
//       مسارات الفروع والشركات
// ===============================

// قائمة الفروع
router.get('/', authMiddleware, branches.getBranches);
router.get('/dashboard/consolidated', authMiddleware, branches.getConsolidatedDashboard);
router.get('/:id', authMiddleware, branches.getBranchById);

// إدارة الفروع (للمدير العام)
router.post('/add', authMiddleware, requireRole('admin'), branches.createBranch);
router.put('/edit/:id', authMiddleware, requireRole('admin'), branches.updateBranch);

// التحويلات اللوجستية بين الفروع
router.get('/transfers/list', authMiddleware, branches.listInterBranchTransfers);
router.post('/transfers/create', authMiddleware, requireRole('admin', 'kitchen_manager', 'manager'), branches.createInterBranchTransfer);
router.post('/transfers/:id/receive', authMiddleware, requireRole('admin', 'kitchen_manager', 'manager'), branches.receiveInterBranchTransfer);

module.exports = router;
