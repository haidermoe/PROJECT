/**
 * ======================================================
 * Attendance Controller - معالجة البصمة
 * ======================================================
 */

// استيراد اتصال قاعدة البيانات الرئيسية (معزول)
const { hrPool } = require('../database/hrConnection');
// استيراد اتصال قاعدة بيانات المصادقة (للمستخدمين)
const { authPool } = require('../database/authConnection');

// ===============================
//      تسجيل دخول (Check-in)
// ===============================
exports.checkIn = async (req, res) => {
  try {
    console.log('🔵 checkIn: بدء تسجيل دخول');
    const userId = req.user?.id;
    const { location, notes } = req.body;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "المستخدم غير معروف"
      });
    }

    // التحقق من عدم وجود بصمة دخول مفتوحة
    const [existingCheckIn] = await hrPool.query(
      `SELECT id, check_in_time FROM hr_attendance_records 
       WHERE user_id = ? AND status = 'checked_in' 
       ORDER BY check_in_time DESC LIMIT 1`,
      [userId]
    );

    if (existingCheckIn.length > 0) {
      return res.status(400).json({
        status: "error",
        message: "لديك بصمة دخول مفتوحة. يرجى تسجيل الخروج أولاً"
      });
    }

    // تسجيل الدخول
    const checkInTime = new Date();
    const [result] = await hrPool.execute(
      `INSERT INTO hr_attendance_records 
       (user_id, check_in_time, check_in_location, status, notes) 
       VALUES (?, ?, ?, 'checked_in', ?)`,
      [userId, checkInTime, location || null, notes || null]
    );

    console.log('✅ checkIn: تم تسجيل الدخول بنجاح:', result.insertId);

    res.json({
      status: "success",
      message: "تم تسجيل الدخول بنجاح",
      data: {
        id: result.insertId,
        check_in_time: checkInTime.toISOString(),
        user_id: userId
      }
    });
  } catch (err) {
    console.error('❌ خطأ في checkIn:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في تسجيل الدخول'
    });
  }
};

// ===============================
//      تسجيل خروج (Check-out)
// ===============================
exports.checkOut = async (req, res) => {
  try {
    console.log('🔵 checkOut: بدء تسجيل خروج');
    const userId = req.user?.id;
    const { location, notes } = req.body;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "المستخدم غير معروف"
      });
    }

    // البحث عن بصمة دخول مفتوحة
    const [checkInRecord] = await hrPool.query(
      `SELECT id, check_in_time FROM hr_attendance_records 
       WHERE user_id = ? AND status = 'checked_in' 
       ORDER BY check_in_time DESC LIMIT 1`,
      [userId]
    );

    if (checkInRecord.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "لا توجد بصمة دخول مفتوحة"
      });
    }

    const checkInTime = new Date(checkInRecord[0].check_in_time);
    const checkOutTime = new Date();
    
    // حساب عدد الساعات
    const diffMs = checkOutTime - checkInTime;
    const workHours = (diffMs / (1000 * 60 * 60)).toFixed(2); // تحويل من milliseconds إلى ساعات

    // تحديث سجل البصمة
    await hrPool.execute(
      `UPDATE hr_attendance_records 
       SET check_out_time = ?, 
           check_out_location = ?,
           work_hours = ?,
           status = 'checked_out',
           notes = COALESCE(?, notes)
       WHERE id = ?`,
      [checkOutTime, location || null, workHours, notes || null, checkInRecord[0].id]
    );

    console.log('✅ checkOut: تم تسجيل الخروج بنجاح. ساعات العمل:', workHours);

    res.json({
      status: "success",
      message: "تم تسجيل الخروج بنجاح",
      data: {
        id: checkInRecord[0].id,
        check_in_time: checkInTime.toISOString(),
        check_out_time: checkOutTime.toISOString(),
        work_hours: parseFloat(workHours)
      }
    });
  } catch (err) {
    console.error('❌ خطأ في checkOut:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في تسجيل الخروج'
    });
  }
};

// ===============================
//      جلب حالة البصمة الحالية للموظف
// ===============================
exports.getCurrentStatus = async (req, res) => {
  try {
    const userId = req.user?.id;

    const [record] = await hrPool.query(
      `SELECT id, check_in_time, check_out_time, work_hours, status 
       FROM hr_attendance_records 
       WHERE user_id = ? AND status = 'checked_in' 
       ORDER BY check_in_time DESC LIMIT 1`,
      [userId]
    );

    if (record.length > 0) {
      res.json({
        status: "success",
        data: {
          is_checked_in: true,
          check_in_time: record[0].check_in_time,
          record_id: record[0].id
        }
      });
    } else {
      res.json({
        status: "success",
        data: {
          is_checked_in: false
        }
      });
    }
  } catch (err) {
    console.error('❌ خطأ في getCurrentStatus:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      جلب سجلات البصمة (للموظف)
// ===============================
exports.getMyAttendance = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { start_date, end_date, limit = 50 } = req.query;

    let query = `SELECT id, check_in_time, check_out_time, work_hours, status, notes 
                 FROM hr_attendance_records 
                 WHERE user_id = ?`;
    const params = [userId];

    if (start_date) {
      query += ' AND DATE(check_in_time) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(check_in_time) <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY check_in_time DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await hrPool.query(query, params);

    res.json({
      status: "success",
      data: rows
    });
  } catch (err) {
    console.error('❌ خطأ في getMyAttendance:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      جلب سجلات جميع الموظفين (للمدير)
// ===============================
exports.getAllAttendance = async (req, res) => {
  try {
    const userRole = req.user?.role;

    // المدير و HR يمكنهم رؤية جميع السجلات
    if (userRole !== 'admin' && userRole !== 'hr') {
      return res.status(403).json({
        status: "error",
        message: "ليس لديك صلاحية لعرض سجلات جميع الموظفين"
      });
    }

    const { user_id, start_date, end_date, limit = 100 } = req.query;

    // جلب سجلات البصمة
    let query = `SELECT ar.* FROM hr_attendance_records ar WHERE 1=1`;
    const params = [];

    if (user_id) {
      query += ' AND ar.user_id = ?';
      params.push(user_id);
    }

    if (start_date) {
      query += ' AND DATE(ar.check_in_time) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(ar.check_in_time) <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY ar.check_in_time DESC LIMIT ?';
    params.push(parseInt(limit));

    const [rows] = await hrPool.query(query, params);

    // جلب أسماء المستخدمين من auth_db
    const userIds = [...new Set(rows.map(row => row.user_id))];
    const userMap = {};
    
    if (userIds.length > 0) {
      try {
        const placeholders = userIds.map(() => '?').join(',');
        const [userRows] = await authPool.query(
          `SELECT id, username, full_name, role FROM users WHERE id IN (${placeholders})`,
          userIds
        );
        userRows.forEach(user => {
          userMap[user.id] = {
            username: user.username,
            full_name: user.full_name,
            role: user.role
          };
        });
      } catch (userErr) {
        console.error('⚠️ خطأ في جلب أسماء المستخدمين:', userErr);
      }
    }

    // إضافة أسماء المستخدمين
    const attendanceRecords = rows.map(row => ({
      ...row,
      username: userMap[row.user_id]?.username || 'غير معروف',
      full_name: userMap[row.user_id]?.full_name || null,
      role: userMap[row.user_id]?.role || null
    }));

    res.json({
      status: "success",
      data: attendanceRecords
    });
  } catch (err) {
    console.error('❌ خطأ في getAllAttendance:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      إحصائيات ساعات العمل (للمدير)
// ===============================
exports.getWorkHoursStats = async (req, res) => {
  try {
    const userRole = req.user?.role;

    // المدير و HR يمكنهم رؤية الإحصائيات
    if (userRole !== 'admin' && userRole !== 'hr') {
      return res.status(403).json({
        status: "error",
        message: "ليس لديك صلاحية لعرض إحصائيات ساعات العمل"
      });
    }

    const { start_date, end_date } = req.query;

    let query = `SELECT 
                 ar.user_id,
                 COUNT(ar.id) AS total_records,
                 SUM(ar.work_hours) AS total_hours,
                 AVG(ar.work_hours) AS avg_hours_per_day,
                 MIN(ar.check_in_time) AS first_check_in,
                 MAX(ar.check_out_time) AS last_check_out
                 FROM hr_attendance_records ar
                 WHERE ar.status = 'checked_out' AND ar.work_hours IS NOT NULL`;
    const params = [];

    if (start_date) {
      query += ' AND DATE(ar.check_in_time) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(ar.check_in_time) <= ?';
      params.push(end_date);
    }

    query += ' GROUP BY ar.user_id ORDER BY total_hours DESC';

    const [rows] = await hrPool.query(query, params);

    // جلب أسماء المستخدمين من auth_db
    const userIds = rows.map(row => row.user_id);
    const userMap = {};
    
    if (userIds.length > 0) {
      try {
        const placeholders = userIds.map(() => '?').join(',');
        const [userRows] = await authPool.query(
          `SELECT id, username, full_name, role FROM users WHERE id IN (${placeholders})`,
          userIds
        );
        userRows.forEach(user => {
          userMap[user.id] = {
            username: user.username,
            full_name: user.full_name,
            role: user.role
          };
        });
      } catch (userErr) {
        console.error('⚠️ خطأ في جلب أسماء المستخدمين:', userErr);
      }
    }

    // تنسيق البيانات
    const stats = rows.map(row => ({
      user_id: row.user_id,
      username: userMap[row.user_id]?.username || 'غير معروف',
      full_name: userMap[row.user_id]?.full_name || null,
      role: userMap[row.user_id]?.role || null,
      total_records: parseInt(row.total_records) || 0,
      total_hours: parseFloat(row.total_hours) || 0,
      avg_hours_per_day: parseFloat(row.avg_hours_per_day) || 0,
      first_check_in: row.first_check_in,
      last_check_out: row.last_check_out
    }));

    res.json({
      status: "success",
      data: stats
    });
  } catch (err) {
    console.error('❌ خطأ في getWorkHoursStats:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

