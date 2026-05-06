/**
 * ==============================================================
 * HR Routes
 * ==============================================================
 * 
 * مسارات مخصصة لإدارة بيانات الموارد البشرية من خلال قاعدة hr_db المستقلة.
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const hrController = require('./hrController');
const { authMiddleware, requireRole } = require('../auth/authMiddleware');

// إعداد multer لاستقبال ملفات الإكسل في الذاكرة (MemoryStorage)
const upload = multer({ 
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        // يتم قبول ملفات Excel الأساسية فقط
        if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet') || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('الرجاء رفع ملف إكسل صحيح'), false);
        }
    }
});

// المسارات محمية بالتوكن وتتطلب صلاحيات HR أو Admin
router.use(authMiddleware);
router.use(requireRole('hr'));

// تعديل أو إضافة راتب / رتبة لموظف
router.post('/update-salary', hrController.updateSalaryAndRank);

// استيراد الموظفين أو رواتبهم من ملف أكسل
router.post('/import-excel', upload.single('file'), hrController.importEmployeesFromExcel);

module.exports = router;
