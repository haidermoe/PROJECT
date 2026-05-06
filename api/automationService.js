// api/automationService.js
const { hrPool } = require('../database/hrConnection');
const { appPool } = require('../database/appConnection');

// This service handles automated background tasks for HR and Payroll

const ONE_HOUR = 60 * 60 * 1000;

async function autoCheckOut() {
    try {
        console.log('🔄 [Automation] Checking for missed check-outs...');
        // 14 hours = 14 * 3600 * 1000 ms
        const limitTime = new Date(Date.now() - 14 * 3600 * 1000);
        
        const [records] = await hrPool.query(
            `SELECT id, user_id, check_in_time FROM hr_attendance_records 
             WHERE status = 'checked_in' AND check_in_time < ?`,
            [limitTime]
        );

        if (records.length > 0) {
            console.log(`⚠️ [Automation] Found ${records.length} records that missed check-out.`);
        } else {
            console.log('✅ [Automation] No missed check-outs found.');
        }

        for (const rec of records) {
            const checkInDate = new Date(rec.check_in_time);
            const checkInDateStr = checkInDate.toISOString().split('T')[0];
            
            // جلب بيانات الدوام من الجدول الأسبوعي للموظف
            const [shifts] = await appPool.query(
                `SELECT start_time, end_time, break_duration 
                 FROM shift_details 
                 WHERE user_id = ? AND shift_date = ?`,
                [rec.user_id, checkInDateStr]
            );

            let checkOutTime;
            let workHours = 8.0;
            let notes = 'Auto-checkout by System';

            if (shifts.length > 0) {
                // الاعتماد على الجدول الأسبوعي
                const shift = shifts[0];
                const shiftEndTime = new Date(`${checkInDateStr}T${shift.end_time}Z`);
                const shiftStartTime = new Date(`${checkInDateStr}T${shift.start_time}Z`);
                
                // معالجة الدوام الليلي (بعد منتصف الليل)
                if (shiftEndTime < shiftStartTime) {
                    shiftEndTime.setDate(shiftEndTime.getDate() + 1);
                }

                checkOutTime = shiftEndTime;
                
                const diffMs = checkOutTime - checkInDate;
                workHours = (diffMs / (1000 * 60 * 60)).toFixed(2);
                if (shift.break_duration) {
                    workHours -= (shift.break_duration / 60);
                }
                if (workHours < 0) workHours = 0;
                
                notes = 'Auto-checkout based on shift schedule';
            } else {
                // افتراضي في حال لم يوجد جدول
                checkOutTime = new Date(checkInDate.getTime() + 8 * 3600 * 1000);
            }
            
            await hrPool.query(
                `UPDATE hr_attendance_records 
                 SET status = 'checked_out', 
                     check_out_time = ?, 
                     work_hours = ?, 
                     notes = ? 
                 WHERE id = ?`,
                [checkOutTime, workHours, notes, rec.id]
            );
            console.log(`✅ [Automation] Auto-checked out record ID: ${rec.id}`);
        }
    } catch (err) {
        console.error('❌ [Automation Error] autoCheckOut failed:', err);
    }
}

async function processDailyPenalties() {
    try {
        console.log('🔄 [Automation] Processing daily late penalties and overtime...');
        
        // جلب سجلات البارحة
        const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().split('T')[0];
        
        const [attendances] = await hrPool.query(
            `SELECT id, user_id, check_in_time, check_out_time 
             FROM hr_attendance_records 
             WHERE status = 'checked_out' 
               AND DATE(check_in_time) = ? 
               AND (notes IS NULL OR notes NOT LIKE '%Late:%')`,
            [yesterday]
        );

        for (const att of attendances) {
            const checkInDateStr = yesterday;
            const [shifts] = await appPool.query(
                `SELECT start_time, end_time FROM shift_details 
                 WHERE user_id = ? AND shift_date = ?`,
                [att.user_id, checkInDateStr]
            );

            if (shifts.length > 0) {
                const shift = shifts[0];
                const shiftStartTime = new Date(`${checkInDateStr}T${shift.start_time}Z`);
                const shiftEndTime = new Date(`${checkInDateStr}T${shift.end_time}Z`);
                if (shiftEndTime < shiftStartTime) shiftEndTime.setDate(shiftEndTime.getDate() + 1);

                const checkInTime = new Date(att.check_in_time);
                const checkOutTime = new Date(att.check_out_time);

                let lateMinutes = 0;
                let earlyLeaveMinutes = 0;
                let overtimeMinutes = 0;

                // تأخير (سماحية 15 دقيقة)
                const lateDiff = checkInTime - shiftStartTime;
                if (lateDiff > 15 * 60 * 1000) lateMinutes = Math.floor(lateDiff / 60000);

                // خروج مبكر
                const earlyDiff = shiftEndTime - checkOutTime;
                if (earlyDiff > 0) earlyLeaveMinutes = Math.floor(earlyDiff / 60000);

                // إضافي (أكثر من 30 دقيقة)
                const overtimeDiff = checkOutTime - shiftEndTime;
                if (overtimeDiff > 30 * 60 * 1000) overtimeMinutes = Math.floor(overtimeDiff / 60000);

                if (lateMinutes > 0 || earlyLeaveMinutes > 0 || overtimeMinutes > 0) {
                    const noteStr = `Late: ${lateMinutes}m, Early: ${earlyLeaveMinutes}m, Overtime: ${overtimeMinutes}m`;
                    await hrPool.query(
                        `UPDATE hr_attendance_records SET notes = CONCAT(IFNULL(notes, ''), ' | ', ?) WHERE id = ?`,
                        [noteStr, att.id]
                    );
                }
            }
        }
        console.log('✅ [Automation] Daily penalties processed.');
    } catch (err) {
        console.error('❌ [Automation Error] processDailyPenalties failed:', err);
    }
}

function startAutomations() {
    console.log('🚀 [Automation Service] Started HR Background Tasks');
    
    autoCheckOut();
    processDailyPenalties();
    
    setInterval(() => {
        autoCheckOut();
        processDailyPenalties();
    }, ONE_HOUR);
}

module.exports = { startAutomations };
