/**
 * ==============================================================
 * HR Controller (Isolated Employee Management)
 * ==============================================================
 * 
 * هذا الملف يعمل حصرياً مع قاعدة بيانات hr_db (المعزولة تماماً).
 * يوفر وظائف: تعديل الرواتب/الرتب، واستيراد البيانات من Excel.
 */

const { hrPool } = require('../database/hrConnection');
const { authPool } = require('../database/authConnection'); // فقط لقراءة أسماء المستخدمين (Micro-batching)
const xlsx = require('xlsx');

const hrController = {
    /**
     * تحديث أو تعديل راتب ورتبة الموظف
     */
    updateSalaryAndRank: async (req, res) => {
        const { userId, baseSalary, hourlyRate, jobRank } = req.body;
        const hrId = req.user.id; // User making the change (must be HR or Admin)

        try {
            // التحقق من صلاحيات الموظف الذي قام بالطلب (تطبيق إجراءات الأمان)
            if (req.user.role !== 'admin' && req.user.role !== 'hr') {
                return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل الرواتب.' });
            }

            // تحديث السجل في hr_db
            const [result] = await hrPool.query(
                `UPDATE hr_employees 
                 SET base_salary = ?, hourly_rate = ?, job_rank = ?
                 WHERE user_id = ?`,
                [baseSalary, hourlyRate, jobRank, userId]
            );

            // في حال عدم وجود سجل للموظف، نقوم بإنشائه (Upsert)
            if (result.affectedRows === 0) {
                await hrPool.query(
                    `INSERT INTO hr_employees (user_id, base_salary, hourly_rate, job_rank)
                     VALUES (?, ?, ?, ?)`,
                    [userId, baseSalary, hourlyRate, jobRank]
                );
            }

            // تسجيل العملية في سجل التدقيق (Audit Logs) للأمان
            await hrPool.query(
                `INSERT INTO hr_audit_logs (target_user_id, performed_by, action_type, table_name, new_value)
                 VALUES (?, ?, 'UPDATE_SALARY_RANK', 'hr_employees', ?)`,
                [userId, hrId, JSON.stringify({ baseSalary, hourlyRate, jobRank })]
            );

            res.json({ success: true, message: 'تم تحديث راتب ورتبة الموظف بنجاح (معزول آمن).' });

        } catch (error) {
            console.error('HR Update Error:', error);
            res.status(500).json({ success: false, message: 'حدث خطأ أثناء تعديل بيانات الموظف.' });
        }
    },

    /**
     * استيراد بيانات الموظفين من ملف Excel أو CSV
     * يتطلب Multer middleware (req.file)
     */
    importEmployeesFromExcel: async (req, res) => {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'يرجى إرفاق ملف إكسل (.xlsx أو .csv)' });
        }

        try {
            // قراءة ملف الإكسل
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            // تحويل الورقة إلى JSON
            const employeesData = xlsx.utils.sheet_to_json(sheet);
            
            if (employeesData.length === 0) {
                return res.status(400).json({ success: false, message: 'الملف فارغ أو صيغته غير صحيحة.' });
            }

            let importedCount = 0;

            // بدء عملية التحديث (Micro-batching)
            for (const emp of employeesData) {
                // يفترض أن يحتوي الإكسل على عمود user_id كمرجع
                if (emp.user_id) {
                    await hrPool.query(
                        `INSERT INTO hr_employees (user_id, first_name, last_name, national_id, job_rank, base_salary)
                         VALUES (?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE 
                         base_salary = VALUES(base_salary), job_rank = VALUES(job_rank)`,
                        [
                            emp.user_id, 
                            emp.first_name || '', 
                            emp.last_name || '', 
                            emp.national_id || '', // سيتم تشفيره لاحقاً
                            emp.job_rank || 'Employee',
                            emp.base_salary || 0
                        ]
                    );
                    importedCount++;
                }
            }

            // Audit
            await hrPool.query(
                `INSERT INTO hr_audit_logs (performed_by, action_type, table_name, new_value)
                 VALUES (?, 'EXCEL_IMPORT', 'hr_employees', ?)`,
                [req.user.id, `Imported ${importedCount} employees`]
            );

            res.json({ 
                success: true, 
                message: `تم استيراد/تحديث ${importedCount} موظف بنجاح في قاعدة HR المستقلة.` 
            });

        } catch (error) {
            console.error('Excel Import Error:', error);
            res.status(500).json({ success: false, message: 'خطأ في قراءة ملف الإكسل ومعالجة البيانات.' });
        }
    }
};

module.exports = hrController;
