/**
 * ======================================================
 * Leaves Controller - معالجة الإجازات
 * ======================================================
 */

// استيراد اتصال قاعدة البيانات الرئيسية
const { appPool } = require('../database/appConnection');
// استيراد اتصال قاعدة بيانات المصادقة (للمستخدمين)
const { authPool } = require('../database/authConnection');
// استيراد دالة إنشاء الإشعارات
const { createNotification } = require('./notificationsController');

// ===============================
//      إرسال طلب إجازة
// ===============================
exports.requestLeave = async (req, res) => {
  try {
    console.log('🔵 requestLeave: بدء إرسال طلب إجازة');
    const userId = req.user?.id;
    const { leave_type, start_date, end_date, reason } = req.body;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "المستخدم غير معروف"
      });
    }

    // التحقق من البيانات المطلوبة
    if (!leave_type || !start_date || !end_date) {
      return res.status(400).json({
        status: "error",
        message: "الحقول المطلوبة: leave_type, start_date, end_date"
      });
    }

    // التحقق من نوع الإجازة
    const validTypes = ['annual', 'sick', 'mourning', 'weekly'];
    if (!validTypes.includes(leave_type)) {
      return res.status(400).json({
        status: "error",
        message: "نوع الإجازة غير صحيح"
      });
    }

    // حساب عدد الأيام
    const start = new Date(start_date);
    const end = new Date(end_date);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 لتضمين اليوم الأول والأخير

    // التحقق من الحد الأقصى للإجازات
    if (leave_type === 'annual' && diffDays > 22) {
      return res.status(400).json({
        status: "error",
        message: "الإجازة السنوية لا يمكن أن تتجاوز 22 يوم"
      });
    }

    if (leave_type === 'sick' && diffDays > 30) {
      return res.status(400).json({
        status: "error",
        message: "الإجازة المرضية لا يمكن أن تتجاوز 30 يوم"
      });
    }

    // التحقق من الرصيد (فقط للسنوية والمرضية)
    if (leave_type === 'annual' || leave_type === 'sick') {
      const currentYear = new Date().getFullYear();
      
      // الحصول على رصيد المستخدم
      const [balanceRows] = await appPool.query(
        `SELECT * FROM leave_balances WHERE user_id = ? AND year = ?`,
        [userId, currentYear]
      );

      let balance;
      if (balanceRows.length === 0) {
        // إنشاء رصيد جديد
        const initialBalance = leave_type === 'annual' ? 22.00 : 30.00;
        await appPool.execute(
          `INSERT INTO leave_balances (user_id, year, annual_leave_balance, sick_leave_balance) 
           VALUES (?, ?, ?, ?)`,
          [userId, currentYear, leave_type === 'annual' ? 22.00 : 0, leave_type === 'sick' ? 30.00 : 0]
        );
        balance = initialBalance;
      } else {
        balance = leave_type === 'annual' 
          ? balanceRows[0].annual_leave_balance - balanceRows[0].annual_leave_used
          : balanceRows[0].sick_leave_balance - balanceRows[0].sick_leave_used;
      }

      if (diffDays > balance) {
        return res.status(400).json({
          status: "error",
          message: `رصيدك المتاح: ${balance.toFixed(1)} يوم. لا يمكنك طلب ${diffDays} يوم`
        });
      }
    }

    // إدراج طلب الإجازة
    const [result] = await appPool.execute(
      `INSERT INTO leave_requests 
       (user_id, leave_type, start_date, end_date, total_days, reason, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [userId, leave_type, start_date, end_date, diffDays, reason || null]
    );

    const leaveId = result.insertId;
    console.log('✅ requestLeave: تم إرسال طلب الإجازة بنجاح:', leaveId);

    // إشعار المدير العام وموارد بشرية بكل طلب إجازة جديد
    try {
      const [userRows] = await authPool.query(
        `SELECT role, full_name, username FROM users WHERE id = ?`,
        [userId]
      );
      const user = userRows[0];

      const [recipientRows] = await authPool.query(
        `SELECT id FROM users WHERE role IN ('admin', 'hr') AND is_active = 1`
      );

      const leaveTypeNames = {
        'annual': 'سنوية',
        'sick': 'مرضية',
        'mourning': 'حداد',
        'weekly': 'أسبوعية'
      };

      const fromName = user?.full_name || user?.username || 'موظف';
      for (const r of recipientRows) {
        await createNotification(
          r.id,
          'leave_request',
          leaveId,
          'طلب موافقة على إجازة جديدة',
          `طلب إجازة ${leaveTypeNames[leave_type] || leave_type} من ${fromName} — ${diffDays} يوم`
        );
      }
    } catch (notifErr) {
      console.error('⚠️ خطأ في إرسال الإشعار:', notifErr);
      // لا نوقف العملية إذا فشل الإشعار
    }

    res.json({
      status: "success",
      message: "تم إرسال طلب الإجازة بنجاح",
      data: {
        id: leaveId,
        total_days: diffDays
      }
    });
  } catch (err) {
    console.error('❌ خطأ في requestLeave:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في إرسال طلب الإجازة'
    });
  }
};

// ===============================
//      جلب طلباتي
// ===============================
exports.getMyLeaves = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { status, leave_type, year } = req.query;

    console.log('🔵 getMyLeaves: Query params:', { status, leave_type, year, userId });

    let query = `SELECT * FROM leave_requests WHERE user_id = ?`;
    const params = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (leave_type) {
      query += ' AND leave_type = ?';
      params.push(leave_type);
    }

    if (year) {
      query += ' AND YEAR(start_date) = ?';
      params.push(year);
    }

    query += ' ORDER BY created_at DESC';

    console.log('🔵 getMyLeaves: SQL Query:', query);
    console.log('🔵 getMyLeaves: Params:', params);

    const [rows] = await appPool.query(query, params);

    console.log('✅ getMyLeaves: عدد النتائج:', rows.length);

    res.json({
      status: "success",
      data: rows
    });
  } catch (err) {
    console.error('❌ خطأ في getMyLeaves:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      جلب جميع الطلبات (للمدير)
// ===============================
exports.getAllLeaves = async (req, res) => {
  try {
    const userRole = req.user?.role;

    if (userRole !== 'admin' && userRole !== 'hr') {
      return res.status(403).json({
        status: "error",
        message: "ليس لديك صلاحية لعرض جميع طلبات الإجازات"
      });
    }

    const { status, leave_type, user_id, year } = req.query;

    let query = `SELECT lr.* FROM leave_requests lr WHERE 1=1`;
    const params = [];

    if (status) {
      query += ' AND lr.status = ?';
      params.push(status);
    }

    if (leave_type) {
      query += ' AND lr.leave_type = ?';
      params.push(leave_type);
    }

    if (user_id) {
      query += ' AND lr.user_id = ?';
      params.push(user_id);
    }

    if (year) {
      query += ' AND YEAR(lr.start_date) = ?';
      params.push(year);
    }

    query += ' ORDER BY lr.created_at DESC';

    const [rows] = await appPool.query(query, params);

    // جلب أسماء المستخدمين
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

    const leaves = rows.map(row => ({
      ...row,
      user: userMap[row.user_id] || { username: 'غير معروف', full_name: null, role: null }
    }));

    res.json({
      status: "success",
      data: leaves
    });
  } catch (err) {
    console.error('❌ خطأ في getAllLeaves:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      الموافقة على طلب إجازة
// ===============================
exports.approveLeave = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const adminId = req.user?.id;

    if (userRole !== 'admin' && userRole !== 'hr') {
      return res.status(403).json({
        status: "error",
        message: "ليس لديك صلاحية للموافقة على طلبات الإجازات"
      });
    }

    const { id } = req.params;
    const { rejection_reason } = req.body;

    // جلب طلب الإجازة
    const [leaveRows] = await appPool.query(
      `SELECT * FROM leave_requests WHERE id = ?`,
      [id]
    );

    if (leaveRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "طلب الإجازة غير موجود"
      });
    }

    const leave = leaveRows[0];

    if (leave.status !== 'pending') {
      return res.status(400).json({
        status: "error",
        message: "تم معالجة هذا الطلب مسبقاً"
      });
    }

    // إذا كان الرفض
    if (rejection_reason) {
      await appPool.execute(
        `UPDATE leave_requests 
         SET status = 'rejected', 
             rejection_reason = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [rejection_reason, id]
      );

      return res.json({
        status: "success",
        message: "تم رفض طلب الإجازة"
      });
    }

    // الموافقة - خصم من الرصيد (فقط للسنوية والمرضية)
    if (leave.leave_type === 'annual' || leave.leave_type === 'sick') {
      const currentYear = new Date().getFullYear();
      
      // تحديث الرصيد
      if (leave.leave_type === 'annual') {
        await appPool.execute(
          `UPDATE leave_balances 
           SET annual_leave_used = annual_leave_used + ?,
               updated_at = NOW()
           WHERE user_id = ? AND year = ?`,
          [leave.total_days, leave.user_id, currentYear]
        );
      } else if (leave.leave_type === 'sick') {
        await appPool.execute(
          `UPDATE leave_balances 
           SET sick_leave_used = sick_leave_used + ?,
               updated_at = NOW()
           WHERE user_id = ? AND year = ?`,
          [leave.total_days, leave.user_id, currentYear]
        );
      }
    }

    // تحديث حالة الطلب
    await appPool.execute(
      `UPDATE leave_requests 
       SET status = 'approved',
           approved_by = ?,
           approved_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [adminId, id]
    );

    console.log('✅ approveLeave: تم الموافقة على طلب الإجازة:', id);

    res.json({
      status: "success",
      message: "تم الموافقة على طلب الإجازة"
    });
  } catch (err) {
    console.error('❌ خطأ في approveLeave:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في الموافقة على طلب الإجازة'
    });
  }
};

// ===============================
//      إلغاء طلب إجازة
// ===============================
exports.cancelLeave = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(400).json({
        status: "error",
        message: "المستخدم غير معروف"
      });
    }

    // جلب طلب الإجازة
    const [leaveRows] = await appPool.query(
      `SELECT * FROM leave_requests WHERE id = ?`,
      [id]
    );

    if (leaveRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "طلب الإجازة غير موجود"
      });
    }

    const leave = leaveRows[0];

    // التحقق من أن الطلب ملك المستخدم
    if (leave.user_id !== userId) {
      return res.status(403).json({
        status: "error",
        message: "ليس لديك صلاحية لإلغاء هذا الطلب"
      });
    }

    // التحقق من أن الطلب في حالة pending
    if (leave.status !== 'pending') {
      const statusNames = {
        'approved': 'تمت الموافقة عليه',
        'rejected': 'تم رفضه',
        'cancelled': 'تم إلغاؤه مسبقاً'
      };
      return res.status(400).json({
        status: "error",
        message: `لا يمكن إلغاء الطلب. الطلب ${statusNames[leave.status] || 'تم معالجته مسبقاً'}`
      });
    }

    // تحديث حالة الطلب إلى cancelled
    console.log('🔵 cancelLeave: جاري تحديث حالة الطلب إلى cancelled...', id);
    const [updateResult] = await appPool.execute(
      `UPDATE leave_requests 
       SET status = 'cancelled', 
           updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    console.log('🔵 cancelLeave: نتيجة التحديث:', updateResult);

    if (updateResult.affectedRows === 0) {
      console.error('❌ cancelLeave: لم يتم تحديث أي صف');
      return res.status(500).json({
        status: "error",
        message: "فشل تحديث حالة الطلب"
      });
    }

    // إرسال إشعار للمدير العام
    try {
      const [userRows] = await authPool.query(
        `SELECT username, full_name FROM users WHERE id = ?`,
        [userId]
      );
      
      const user = userRows[0];
      const userName = user?.full_name || user?.username || 'مستخدم';
      
      const leaveTypeNames = {
        'annual': 'سنوية',
        'sick': 'مرضية',
        'mourning': 'حداد',
        'weekly': 'أسبوعية'
      };
      
      const [recipientRows] = await authPool.query(
        `SELECT id FROM users WHERE role IN ('admin', 'hr') AND is_active = 1`
      );

      for (const r of recipientRows) {
        await createNotification(
          r.id,
          'leave_request',
          id,
          'تم إلغاء طلب إجازة',
          `تم إلغاء طلب إجازة ${leaveTypeNames[leave.leave_type] || leave.leave_type} من ${userName} - عدد الأيام: ${leave.total_days}`
        );
      }
    } catch (notifErr) {
      console.error('⚠️ خطأ في إرسال الإشعار:', notifErr);
      // لا نوقف العملية إذا فشل الإشعار
    }

    console.log('✅ cancelLeave: تم إلغاء طلب الإجازة بنجاح:', id);

    res.json({
      status: "success",
      message: "تم إلغاء طلب الإجازة بنجاح"
    });
  } catch (err) {
    console.error('❌ خطأ في cancelLeave:', err);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في إلغاء طلب الإجازة'
    });
  }
};

// ===============================
//      جلب رصيد الإجازات
// ===============================
exports.getLeaveBalance = async (req, res) => {
  try {
    const userId = req.user?.id;
    const currentYear = new Date().getFullYear();

    // الحصول على الرصيد
    const [balanceRows] = await appPool.query(
      `SELECT * FROM leave_balances WHERE user_id = ? AND year = ?`,
      [userId, currentYear]
    );

    let balance;
    if (balanceRows.length === 0) {
      // إنشاء رصيد جديد
      await appPool.execute(
        `INSERT INTO leave_balances (user_id, year, annual_leave_balance, sick_leave_balance) 
         VALUES (?, ?, 22.00, 30.00)`,
        [userId, currentYear]
      );
      balance = {
        annual_leave_balance: 22.00,
        sick_leave_balance: 30.00,
        annual_leave_used: 0.00,
        sick_leave_used: 0.00
      };
    } else {
      balance = balanceRows[0];
    }

    const annualAvailable = balance.annual_leave_balance - balance.annual_leave_used;
    const sickAvailable = balance.sick_leave_balance - balance.sick_leave_used;

    res.json({
      status: "success",
      data: {
        year: currentYear,
        annual: {
          total: balance.annual_leave_balance,
          used: balance.annual_leave_used,
          available: annualAvailable
        },
        sick: {
          total: balance.sick_leave_balance,
          used: balance.sick_leave_used,
          available: sickAvailable
        }
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getLeaveBalance:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

