/**
 * ======================================================
 * Shifts Schedule Controller - معالجة جداول الدوام
 * ======================================================
 */

// استيراد اتصال قاعدة البيانات الرئيسية (معزول)
const { appPool } = require('../database/appConnection');
// استيراد اتصال قاعدة بيانات المصادقة (للمستخدمين)
const { authPool } = require('../database/authConnection');
// استيراد دالة إنشاء الإشعارات
const { createNotification } = require('./notificationsController');

// ===============================
//      إنشاء الجداول تلقائياً
// ===============================
async function ensureShiftsTablesExist(connection) {
  try {
    const [tables] = await connection.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'shifts_schedules'`
    );

    if (tables[0].count === 0) {
      console.log('⚠️ جداول الدوام غير موجودة، جاري إنشائها...');
      
      await connection.query(`
        CREATE TABLE shifts_schedules (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          week_start_date DATE NOT NULL COMMENT 'تاريخ بداية الأسبوع (السبت)',
          week_end_date DATE NOT NULL COMMENT 'تاريخ نهاية الأسبوع (الجمعة)',
          created_by INT NOT NULL COMMENT 'المسؤول الذي أنشأ الجدول (admin, manager, kitchen_manager)',
          status ENUM('draft', 'pending_approval', 'approved', 'rejected', 'published') DEFAULT 'draft',
          approved_by INT NULL COMMENT 'المدير العام الذي وافق على الجدول',
          approved_at DATETIME NULL,
          rejected_reason TEXT NULL,
          notes TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_week_start (week_start_date),
          INDEX idx_status (status),
          INDEX idx_created_by (created_by)
        ) ENGINE=InnoDB 
        DEFAULT CHARSET=utf8mb4 
        COLLATE=utf8mb4_unicode_ci
      `);

      await connection.query(`
        CREATE TABLE shift_details (
          id INT AUTO_INCREMENT PRIMARY KEY,
          schedule_id INT NOT NULL,
          user_id INT NOT NULL COMMENT 'ID الموظف من auth_db',
          day_of_week ENUM('saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday') NOT NULL,
          shift_date DATE NOT NULL COMMENT 'تاريخ اليوم الفعلي',
          start_time TIME NOT NULL COMMENT 'وقت بداية الدوام (HH:MM)',
          end_time TIME NOT NULL COMMENT 'وقت نهاية الدوام (HH:MM)',
          break_duration INT DEFAULT 0 COMMENT 'مدة الاستراحة بالدقائق',
          notes TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_schedule_id (schedule_id),
          INDEX idx_user_id (user_id),
          INDEX idx_shift_date (shift_date),
          UNIQUE KEY unique_shift (schedule_id, user_id, shift_date),
          FOREIGN KEY (schedule_id) REFERENCES shifts_schedules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB 
        DEFAULT CHARSET=utf8mb4 
        COLLATE=utf8mb4_unicode_ci
      `);

      await connection.query(`
        CREATE TABLE schedule_approvals (
          id INT AUTO_INCREMENT PRIMARY KEY,
          schedule_id INT NOT NULL,
          requested_by INT NOT NULL COMMENT 'المسؤول الذي طلب الموافقة',
          approved_by INT NULL COMMENT 'المدير العام الذي وافق',
          status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
          approval_notes TEXT NULL,
          rejection_reason TEXT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          approved_at DATETIME NULL,
          INDEX idx_schedule_id (schedule_id),
          INDEX idx_status (status),
          FOREIGN KEY (schedule_id) REFERENCES shifts_schedules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB 
        DEFAULT CHARSET=utf8mb4 
        COLLATE=utf8mb4_unicode_ci
      `);

      console.log('✅ تم إنشاء جداول الدوام بنجاح');
    }
  } catch (err) {
    console.error('❌ خطأ في إنشاء جداول الدوام:', err);
    throw err;
  }
}

// ===============================
//      إنشاء جدول دوام جديد
// ===============================
exports.createSchedule = async (req, res) => {
  try {
    console.log('🔵 createSchedule: بدء إنشاء جدول دوام جديد');
    const userId = req.user?.id;
    const userRole = req.user?.role;

    // السماح لجميع الأدوار الإدارية بإنشاء جداول الدوام
    const allowedRoles = ['admin', 'manager', 'kitchen_manager', 'hr'];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        status: "error",
        message: "ليس لديك صلاحية لإنشاء جداول الدوام"
      });
    }

    const { title, week_start_date, shifts, notes } = req.body;

    if (!title || !week_start_date || !shifts || !Array.isArray(shifts) || shifts.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "البيانات المطلوبة: title, week_start_date, shifts (مصفوفة)"
      });
    }

    const startDate = new Date(week_start_date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const connection = await appPool.getConnection();
    try {
      await ensureShiftsTablesExist(connection);
      await connection.beginTransaction();

      const [scheduleResult] = await connection.execute(
        `INSERT INTO shifts_schedules 
         (title, week_start_date, week_end_date, created_by, status, notes) 
         VALUES (?, ?, ?, ?, 'pending_approval', ?)`,
        [title, startDate, endDate, userId, notes || null]
      );

      const scheduleId = scheduleResult.insertId;
      console.log('✅ createSchedule: تم إنشاء الجدول:', scheduleId);

      const daysOfWeek = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      
      for (const shift of shifts) {
        const { user_id, day, start_time, end_time, break_duration, notes: shiftNotes } = shift;
        
        if (!user_id || !day || !start_time || !end_time) {
          await connection.rollback();
          return res.status(400).json({
            status: "error",
            message: `بيانات غير كاملة للدوام: user_id, day, start_time, end_time مطلوبة`
          });
        }

        const dayIndex = daysOfWeek.indexOf(day.toLowerCase());
        if (dayIndex === -1) {
          await connection.rollback();
          return res.status(400).json({
            status: "error",
            message: `اسم اليوم غير صحيح: ${day}`
          });
        }

        const shiftDate = new Date(startDate);
        shiftDate.setDate(startDate.getDate() + dayIndex);

        const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timePattern.test(start_time) || !timePattern.test(end_time)) {
          await connection.rollback();
          return res.status(400).json({
            status: "error",
            message: `تنسيق الوقت غير صحيح. يجب أن يكون HH:MM (مثلاً: 08:00)`
          });
        }

        await connection.execute(
          `INSERT INTO shift_details 
           (schedule_id, user_id, day_of_week, shift_date, start_time, end_time, break_duration, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            scheduleId,
            user_id,
            day.toLowerCase(),
            shiftDate,
            start_time,
            end_time,
            break_duration || 0,
            shiftNotes || null
          ]
        );
      }

      await connection.execute(
        `INSERT INTO schedule_approvals 
         (schedule_id, requested_by, status) 
         VALUES (?, ?, 'pending')`,
        [scheduleId, userId]
      );

      await connection.commit();
      console.log('✅ createSchedule: تم حفظ جدول الدوام بنجاح');

      try {
        const [adminRows] = await authPool.query(
          `SELECT id FROM users WHERE role IN ('admin', 'hr') AND is_active = 1`
        );
        
        for (const admin of adminRows) {
          await createNotification(
            admin.id,
            'schedule_approval',
            scheduleId,
            'طلب موافقة على جدول دوام جديد',
            `تم إنشاء جدول دوام جديد: ${title} - الأسبوع من ${startDate.toLocaleDateString('ar-EG')}`
          );
        }
      } catch (notifErr) {
        console.error('⚠️ خطأ في إرسال الإشعار:', notifErr);
      }

      res.json({
        status: "success",
        message: "تم إنشاء جدول الدوام بنجاح وتم إرساله للموافقة",
        data: {
          id: scheduleId,
          title,
          week_start_date: startDate.toISOString().split('T')[0],
          week_end_date: endDate.toISOString().split('T')[0],
          status: 'pending_approval'
        }
      });
    } catch (dbErr) {
      await connection.rollback();
      throw dbErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ خطأ في createSchedule:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في إنشاء جدول الدوام'
    });
  }
};

// ===============================
//      جلب جميع جداول الدوام
// ===============================
exports.getSchedules = async (req, res) => {
  try {
    const connection = await appPool.getConnection();
    try {
      await ensureShiftsTablesExist(connection);
    } finally {
      connection.release();
    }

    const userRole = req.user?.role;
    const userId = req.user?.id;
    const { status, limit = 100 } = req.query;

    let query = `SELECT s.* FROM shifts_schedules s WHERE 1=1`;
    const params = [];

    // admin و HR يريان كل الجداول، manager و kitchen_manager يرون جداولهم فقط
    if (userRole === 'admin' || userRole === 'hr') {
      // يرى كل الجداول
    } else if (userRole === 'manager' || userRole === 'kitchen_manager') {
      query += ' AND s.created_by = ?';
      params.push(userId);
    }

    if (status) {
      query += ' AND s.status = ?';
      params.push(status);
    } else if (userRole === 'employee') {
      query += ' AND s.status = ?';
      params.push('published');
    }

    query += ' ORDER BY s.week_start_date DESC, s.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await appPool.query(query, params);

    const creatorIds = [...new Set(rows.map(r => r.created_by).filter(id => id))];
    const creatorMap = {};
    
    if (creatorIds.length > 0) {
      try {
        const placeholders = creatorIds.map(() => '?').join(',');
        const [creatorRows] = await authPool.query(
          `SELECT id, username, full_name FROM users WHERE id IN (${placeholders})`,
          creatorIds
        );
        creatorRows.forEach(user => {
          creatorMap[user.id] = {
            username: user.username,
            full_name: user.full_name
          };
        });
      } catch (err) {
        console.error('⚠️ خطأ في جلب أسماء المنشئين:', err);
      }
    }

    const schedules = rows.map(row => ({
      ...row,
      creator_name: creatorMap[row.created_by]?.full_name || creatorMap[row.created_by]?.username || 'غير معروف'
    }));

    res.json({
      status: "success",
      data: schedules
    });
  } catch (err) {
    console.error('❌ خطأ في getSchedules:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في جلب جداول الدوام'
    });
  }
};

// ===============================
//      جلب تفاصيل جدول دوام
// ===============================
exports.getScheduleDetails = async (req, res) => {
  try {
    const connection = await appPool.getConnection();
    try {
      await ensureShiftsTablesExist(connection);
    } finally {
      connection.release();
    }

    const { id } = req.params;
    const userRole = req.user?.role;
    const userId = req.user?.id;

    const [scheduleRows] = await appPool.query(
      `SELECT * FROM shifts_schedules WHERE id = ?`,
      [id]
    );

    if (scheduleRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "جدول الدوام غير موجود"
      });
    }

    const schedule = scheduleRows[0];

    if (userRole !== 'admin' && userRole !== 'hr') {
      if ((userRole === 'manager' || userRole === 'kitchen_manager') && schedule.created_by !== userId) {
        return res.status(403).json({
          status: "error",
          message: "ليس لديك صلاحية لعرض هذا الجدول"
        });
      }
    }

    if (userRole === 'employee' && schedule.status !== 'published') {
      return res.status(403).json({
        status: "error",
        message: "هذا الجدول غير متاح للعرض"
      });
    }

    const [shiftRows] = await appPool.query(
      `SELECT * FROM shift_details 
       WHERE schedule_id = ? 
       ORDER BY user_id, shift_date`,
      [id]
    );

    const userIds = [...new Set(shiftRows.map(s => s.user_id).filter(id => id))];
    const userMap = {};
    
    if (userIds.length > 0) {
      try {
        const placeholders = userIds.map(() => '?').join(',');
        const [userRows] = await authPool.query(
          `SELECT id, username, full_name FROM users WHERE id IN (${placeholders})`,
          userIds
        );
        userRows.forEach(user => {
          userMap[user.id] = {
            username: user.username,
            full_name: user.full_name
          };
        });
      } catch (err) {
        console.error('⚠️ خطأ في جلب أسماء الموظفين:', err);
      }
    }

    const daysOfWeek = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const organizedShifts = {};

    shiftRows.forEach(shift => {
      if (!organizedShifts[shift.user_id]) {
        organizedShifts[shift.user_id] = {
          user_id: shift.user_id,
          username: userMap[shift.user_id]?.username || 'غير معروف',
          full_name: userMap[shift.user_id]?.full_name || null,
          shifts: {}
        };
      }

      organizedShifts[shift.user_id].shifts[shift.day_of_week] = {
        shift_date: shift.shift_date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        break_duration: shift.break_duration,
        notes: shift.notes
      };
    });

    let creatorName = 'غير معروف';
    if (schedule.created_by) {
      try {
        const [creatorRows] = await authPool.query(
          `SELECT username, full_name FROM users WHERE id = ?`,
          [schedule.created_by]
        );
        if (creatorRows.length > 0) {
          creatorName = creatorRows[0].full_name || creatorRows[0].username || 'غير معروف';
        }
      } catch (err) {
        console.error('⚠️ خطأ في جلب اسم المنشئ:', err);
      }
    }

    res.json({
      status: "success",
      data: {
        schedule: {
          id: schedule.id,
          title: schedule.title,
          week_start_date: schedule.week_start_date,
          week_end_date: schedule.week_end_date,
          status: schedule.status,
          created_by: schedule.created_by,
          creator_name: creatorName,
          notes: schedule.notes,
          created_at: schedule.created_at
        },
        shifts: Object.values(organizedShifts),
        days_of_week: daysOfWeek
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getScheduleDetails:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في جلب تفاصيل جدول الدوام'
    });
  }
};

// ===============================
//      الموافقة على جدول دوام (admin)
// ===============================
exports.approveSchedule = async (req, res) => {
  try {
    console.log('🔵 approveSchedule: بدء الموافقة على جدول دوام');
    
    const connection = await appPool.getConnection();
    try {
      await ensureShiftsTablesExist(connection);
    } finally {
      connection.release();
    }

    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (userRole !== 'admin' && userRole !== 'hr') {
      return res.status(403).json({
        status: "error",
        message: "ليس لديك صلاحية للموافقة على جداول الدوام"
      });
    }

    const { id } = req.params;
    const { action, notes } = req.body;

    if (!action || (action !== 'approve' && action !== 'reject')) {
      return res.status(400).json({
        status: "error",
        message: "action مطلوب: 'approve' أو 'reject'"
      });
    }

    const [scheduleRows] = await appPool.query(
      `SELECT * FROM shifts_schedules WHERE id = ?`,
      [id]
    );

    if (scheduleRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "جدول الدوام غير موجود"
      });
    }

    const schedule = scheduleRows[0];

    if (schedule.status !== 'pending_approval') {
      return res.status(400).json({
        status: "error",
        message: `حالة الجدول: ${schedule.status} - لا يمكن الموافقة/الرفض`
      });
    }

    const conn = await appPool.getConnection();
    try {
      await conn.beginTransaction();

      if (action === 'approve') {
        await conn.execute(
          `UPDATE shifts_schedules 
           SET status = 'published', 
               approved_by = ?, 
               approved_at = NOW(),
               notes = COALESCE(?, notes)
           WHERE id = ?`,
          [userId, notes || null, id]
        );

        await conn.execute(
          `UPDATE schedule_approvals 
           SET status = 'approved', 
               approved_by = ?, 
               approved_at = NOW(),
               approval_notes = ?
           WHERE schedule_id = ? AND status = 'pending'`,
          [userId, notes || null, id]
        );

        await conn.commit();
        console.log('✅ approveSchedule: تم الموافقة على الجدول');

        try {
          const [shiftRows] = await appPool.query(
            `SELECT DISTINCT user_id FROM shift_details WHERE schedule_id = ?`,
            [id]
          );

          const userIds = shiftRows.map(r => r.user_id).filter(id => id);
          
          for (const empId of userIds) {
            await createNotification(
              empId,
              'schedule_published',
              id,
              'جدول دوام جديد',
              `تم نشر جدول دوام جديد: ${schedule.title}`
            );
          }
        } catch (notifErr) {
          console.error('⚠️ خطأ في إرسال الإشعارات:', notifErr);
        }

        res.json({
          status: "success",
          message: "تم الموافقة على جدول الدوام ونشره بنجاح"
        });
      } else {
        if (!notes || notes.trim() === '') {
          return res.status(400).json({
            status: "error",
            message: "يرجى إدخال سبب الرفض"
          });
        }

        await conn.execute(
          `UPDATE shifts_schedules 
           SET status = 'rejected', 
               approved_by = ?, 
               approved_at = NOW(),
               rejected_reason = ?
           WHERE id = ?`,
          [userId, notes, id]
        );

        await conn.execute(
          `UPDATE schedule_approvals 
           SET status = 'rejected', 
               approved_by = ?, 
               approved_at = NOW(),
               rejection_reason = ?
           WHERE schedule_id = ? AND status = 'pending'`,
          [userId, notes, id]
        );

        await conn.commit();
        console.log('✅ approveSchedule: تم رفض الجدول');

        try {
          await createNotification(
            schedule.created_by,
            'schedule_rejected',
            id,
            'رفض جدول الدوام',
            `تم رفض جدول الدوام: ${schedule.title} - السبب: ${notes}`
          );
        } catch (notifErr) {
          console.error('⚠️ خطأ في إرسال الإشعار:', notifErr);
        }

        res.json({
          status: "success",
          message: "تم رفض جدول الدوام"
        });
      }
    } catch (dbErr) {
      await conn.rollback();
      throw dbErr;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('❌ خطأ في approveSchedule:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في الموافقة على جدول الدوام'
    });
  }
};

