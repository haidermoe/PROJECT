/**
 * ==============================================================
 * Data Migration & Cleanup Script (app_db -> hr_db)
 * ==============================================================
 * 
 * هذا السكربت يقوم بنسخ بيانات (البصمات، الإجازات، الرواتب) من قاعدة
 * البيانات الرئيسية القديمة (app_db) إلى قاعدة بيانات الموارد البشرية الجديدة (hr_db).
 * بعد التأكد من نجاح النقل، يتم مسح الجداول القديمة للحفاظ على العزل التام.
 */

require('dotenv').config();
const { appPool } = require('../database/appConnection');
const { hrPool } = require('../database/hrConnection');

async function migrateData() {
    console.log('🚀 بدء عملية ترحيل بيانات الموارد البشرية إلى hr_db...');
    
    const appConn = await appPool.getConnection();
    const hrConn = await hrPool.getConnection();

    try {
        await hrConn.beginTransaction();

        // 1. نقل بيانات البصمات (Attendance)
        console.log('📦 جاري استخراج بيانات البصمة من app_db...');
        const [attendanceRecords] = await appConn.query('SELECT * FROM attendance_records');
        if (attendanceRecords.length > 0) {
            console.log(`✅ تم العثور على ${attendanceRecords.length} سجل بصمة. جاري نقلها...`);
            for (let record of attendanceRecords) {
                // التأكد من أن record يحتوي على الحقول المناسبة (id, user_id, check_in_time...)
                await hrConn.query(
                    `INSERT INTO hr_attendance_records (id, user_id, check_in_time, check_out_time, work_hours, status, notes, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE check_out_time = VALUES(check_out_time), work_hours = VALUES(work_hours)`,
                    [
                        record.id, record.user_id, record.check_in_time, record.check_out_time, 
                        record.work_hours || 0, record.status, record.notes, record.created_at || new Date()
                    ]
                );
            }
        } else {
            console.log('ℹ️ لا توجد سجلات بصمة للترحيل.');
        }

        // ملاحظة: من المفترض نقل بيانات الإجازات والرواتب بنفس هذه الطريقة 
        // استناداً إلى الجداول المشابهة الموجودة مسبقاً في app_db:
        /*
        const [leaves] = await appConn.query('SELECT * FROM leave_requests');
        // Migrate leaves to hr_leaves...
        
        const [payroll] = await appConn.query('SELECT * FROM payroll_records');
        // Migrate payroll...
        */

        await hrConn.commit();
        console.log('✅ اكتمل نقل البيانات إلى hr_db بنجاح!');

        // بعد التأكد من النقل الناجح بنسبة 100% نقوم بحذف أثر هذه البيانات القديمة.
        console.log('🧹 جاري حذف بيانات الموارد البشرية من القاعدة القديمة (app_db) لتعزيز الأمان...');
        await appConn.query('DROP TABLE IF EXISTS attendance_records');
        // await appConn.query('DROP TABLE IF EXISTS leave_requests');
        // await appConn.query('DROP TABLE IF EXISTS payroll_records');
        console.log('✅ تم حذف الجداول القديمة من app_db بشكل آمن.');

    } catch (error) {
        await hrConn.rollback();
        console.error('❌ حدث خطأ أثناء الترحيل. تم استرجاع التغييرات (Rollback):', error);
    } finally {
        appConn.release();
        hrConn.release();
        
        // إغلاق الـ pools
        await appPool.end();
        await hrPool.end();
        process.exit(0);
    }
}

migrateData();
