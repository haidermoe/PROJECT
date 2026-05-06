const { appPool } = require('../database/appConnection');
const { authPool } = require('../database/authConnection');
const { hrPool } = require('../database/hrConnection');

async function ensurePayrollTablesExist(connection) {
  try {
    const [tables] = await connection.query(
      `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_periods'`
    );

    if (tables[0].count === 0) {
      console.log('⚠️ جداول الرواتب غير موجودة، جاري إنشائها...');
      
      await connection.query(`
        CREATE TABLE employee_salaries (
          user_id INT PRIMARY KEY,
          base_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE payroll_periods (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(100) NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          status ENUM('open', 'closed') DEFAULT 'open',
          created_by INT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await connection.query(`
        CREATE TABLE payroll_records (
          id INT AUTO_INCREMENT PRIMARY KEY,
          period_id INT NOT NULL,
          user_id INT NOT NULL,
          scheduled_hours DECIMAL(10,2) DEFAULT 0.00,
          actual_hours DECIMAL(10,2) DEFAULT 0.00,
          overtime_hours DECIMAL(10,2) DEFAULT 0.00,
          undertime_hours DECIMAL(10,2) DEFAULT 0.00,
          base_pay DECIMAL(10,2) DEFAULT 0.00,
          net_pay DECIMAL(10,2) DEFAULT 0.00,
          last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (period_id) REFERENCES payroll_periods(id) ON DELETE CASCADE,
          UNIQUE KEY unique_user_period (period_id, user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      console.log('✅ تم إنشاء جداول الرواتب بنجاح!');
    }
  } catch (err) {
    console.error('❌ خطأ في إنشاء جداول الرواتب:', err);
    throw err;
  }
}

// --------------------------------------------------------
// Get Salaries
// --------------------------------------------------------
exports.getSalaries = async (req, res) => {
  try {
    const connection = await appPool.getConnection();
    try {
      await ensurePayrollTablesExist(connection);
    } finally {
      connection.release();
    }

    // Get all users from auth_db
    const [users] = await authPool.query(
      `SELECT id, username, full_name, role FROM users WHERE is_active = 1`
    );

    // Get salaries from app_db
    const [salaries] = await appPool.query(
      `SELECT user_id, base_salary, hourly_rate FROM employee_salaries`
    );

    const salaryMap = {};
    salaries.forEach(s => {
      salaryMap[s.user_id] = s;
    });

    const data = users.map(user => ({
      user_id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      base_salary: salaryMap[user.id] ? parseFloat(salaryMap[user.id].base_salary) : 0,
      hourly_rate: salaryMap[user.id] ? parseFloat(salaryMap[user.id].hourly_rate) : 0
    }));

    res.json({ status: "success", data });
  } catch (err) {
    console.error('Error in getSalaries:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// --------------------------------------------------------
// Update Salary
// --------------------------------------------------------
exports.updateSalary = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { base_salary, hourly_rate } = req.body;

    if (base_salary === undefined || hourly_rate === undefined) {
      return res.status(400).json({ status: "error", message: "base_salary and hourly_rate are required" });
    }

    const connection = await appPool.getConnection();
    try {
      await ensurePayrollTablesExist(connection);
      
      await connection.query(
        `INSERT INTO employee_salaries (user_id, base_salary, hourly_rate)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE base_salary = ?, hourly_rate = ?`,
        [user_id, base_salary, hourly_rate, base_salary, hourly_rate]
      );
    } finally {
      connection.release();
    }

    res.json({ status: "success", message: "تم تحديث الراتب بنجاح" });
  } catch (err) {
    console.error('Error in updateSalary:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// --------------------------------------------------------
// Periods
// --------------------------------------------------------
exports.createPeriod = async (req, res) => {
  try {
    const { title, start_date, end_date } = req.body;
    const userId = req.user?.id;

    if (!title || !start_date || !end_date) {
      return res.status(400).json({ status: "error", message: "title, start_date, and end_date are required" });
    }

    const connection = await appPool.getConnection();
    try {
      await ensurePayrollTablesExist(connection);
      
      const [result] = await connection.query(
        `INSERT INTO payroll_periods (title, start_date, end_date, status, created_by) VALUES (?, ?, ?, 'open', ?)`,
        [title, start_date, end_date, userId]
      );
      
      res.json({
        status: "success", 
        message: "تم إنشاء الفترة بنجاح", 
        data: { id: result.insertId }
      });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error in createPeriod:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getPeriods = async (req, res) => {
  try {
    const connection = await appPool.getConnection();
    try {
      await ensurePayrollTablesExist(connection);
      
      const [periods] = await connection.query(
        `SELECT * FROM payroll_periods ORDER BY start_date DESC`
      );
      res.json({ status: "success", data: periods });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error in getPeriods:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.closePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await appPool.getConnection();
    try {
      await connection.query(
        `UPDATE payroll_periods SET status = 'closed' WHERE id = ?`,
        [id]
      );
      res.json({ status: "success", message: "تم إغلاق الفترة بنجاح" });
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('Error in closePeriod:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// --------------------------------------------------------
// Get Payroll Records
// --------------------------------------------------------
exports.getPayrollRecords = async (req, res) => {
  try {
    const { period_id } = req.params;
    
    // Join with authPool manually
    const [records] = await appPool.query(
      `SELECT pr.*, es.hourly_rate 
       FROM payroll_records pr 
       LEFT JOIN employee_salaries es ON pr.user_id = es.user_id
       WHERE pr.period_id = ?`,
      [period_id]
    );

    if (records.length === 0) {
      return res.json({ status: "success", data: [] });
    }

    const userIds = records.map(r => r.user_id);
    const placeholders = userIds.map(() => '?').join(',');
    const [users] = await authPool.query(
      `SELECT id, username, full_name, role FROM users WHERE id IN (${placeholders})`,
      userIds
    );

    const userMap = {};
    users.forEach(u => userMap[u.id] = u);

    const data = records.map(r => ({
      ...r,
      username: userMap[r.user_id]?.username || 'غير معروف',
      full_name: userMap[r.user_id]?.full_name,
      role: userMap[r.user_id]?.role
    }));

    res.json({ status: "success", data });
  } catch (err) {
    console.error('Error in getPayrollRecords:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// --------------------------------------------------------
// Generate Payroll
// --------------------------------------------------------
exports.generatePayroll = async (req, res) => {
  try {
    const { period_id } = req.params;
    
    const [periods] = await appPool.query(
      `SELECT start_date, end_date FROM payroll_periods WHERE id = ?`,
      [period_id]
    );

    if (periods.length === 0) {
      return res.status(404).json({ status: "error", message: "الفترة غير موجودة" });
    }

    const { start_date, end_date } = periods[0];
    const sDate = new Date(start_date);
    const eDate = new Date(end_date);
    eDate.setHours(23, 59, 59, 999);

    // Get all shift details for users in this period
    const [shifts] = await appPool.query(
      `SELECT user_id, shift_date, start_time, end_time, break_duration 
       FROM shift_details 
       WHERE shift_date >= ? AND shift_date <= ?`,
      [start_date, end_date]
    );

    // Calculate scheduled hours per user
    const scheduledHoursMap = {};
    shifts.forEach(shift => {
      const u = shift.user_id;
      if (!scheduledHoursMap[u]) scheduledHoursMap[u] = 0;
      
      const st = new Date(`1970-01-01T${shift.start_time}Z`);
      const et = new Date(`1970-01-01T${shift.end_time}Z`);
      let hours = (et - st) / (1000 * 60 * 60);
      if (hours < 0) hours += 24; // Handle passing midnight
      hours -= (shift.break_duration / 60); // Deduct break
      if (hours < 0) hours = 0;

      scheduledHoursMap[u] += hours;
    });

    // Get actual work hours from attendance
    const [attendances] = await hrPool.query(
      `SELECT user_id, sum(work_hours) as total_worked
       FROM hr_attendance_records 
       WHERE check_in_time >= ? AND check_in_time <= ? AND status='checked_out'
       GROUP BY user_id`,
      [sDate, eDate]
    );

    const actualHoursMap = {};
    attendances.forEach(att => {
      actualHoursMap[att.user_id] = parseFloat(att.total_worked) || 0;
    });

    // Get Base Salaries
    const [salaries] = await appPool.query(
      `SELECT user_id, base_salary, hourly_rate FROM employee_salaries`
    );
    const salaryMap = {};
    salaries.forEach(s => salaryMap[s.user_id] = s);

    // Create unique set of user_ids to process
    const allUsersSet = new Set([...Object.keys(scheduledHoursMap), ...Object.keys(actualHoursMap), ...Object.keys(salaryMap)]);
    const allUsers = Array.from(allUsersSet);

    for (const userId of allUsers) {
      const uId = parseInt(userId);
      const scheduled = scheduledHoursMap[uId] || 0;
      const actual = actualHoursMap[uId] || 0;

      let overtime = 0;
      let undertime = 0;

      if (actual > scheduled && scheduled > 0) {
        overtime = actual - scheduled;
      } else if (actual < scheduled) {
        undertime = scheduled - actual;
      }

      const sInfo = salaryMap[uId] || { base_salary: 0, hourly_rate: 0 };
      const basePay = parseFloat(sInfo.base_salary);
      const rate = parseFloat(sInfo.hourly_rate);

      // Core calculation
      let netPay = basePay;
      netPay += (overtime * rate); // Add overtime value
      netPay -= (undertime * rate); // Deduct undertime value
      if (netPay < 0) netPay = 0;

      await appPool.query(
        `INSERT INTO payroll_records 
         (period_id, user_id, scheduled_hours, actual_hours, overtime_hours, undertime_hours, base_pay, net_pay)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
         scheduled_hours = ?, actual_hours = ?, overtime_hours = ?, undertime_hours = ?, base_pay = ?, net_pay = ?`,
        [period_id, uId, scheduled, actual, overtime, undertime, basePay, netPay,
         scheduled, actual, overtime, undertime, basePay, netPay]
      );
    }

    res.json({ status: "success", message: "تم تحديث وحساب الرواتب للفترة بنجاح" });
  } catch (err) {
    console.error('Error in generatePayroll:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};
