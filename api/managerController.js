const { appPool } = require('../database/appConnection');
const { authPool } = require('../database/authConnection');

// ===============================
//      Committed Employee Ranking
// ===============================
exports.getEmployeeRanking = async (req, res) => {
  try {
    // Rank employees by minimal waste records and transactions
    // Since we don't have full sales accuracy data, we'll base it on least waste recorded + activity.
    const [users] = await authPool.query(`SELECT id, full_name, username FROM users WHERE role IN ('employee', 'kitchen_manager')`);
    
    // Get waste counts per user
    const [wasteCounts] = await appPool.query(`SELECT recorded_by, COUNT(*) as waste_count, SUM(quantity) as waste_amount FROM waste_records GROUP BY recorded_by`);
    
    // Calculate score (simple mock logic: higher score = better)
    const rankings = users.map(user => {
      const wasteData = wasteCounts.find(w => w.recorded_by === user.id) || { waste_count: 0, waste_amount: 0 };
      const score = 100 - (wasteData.waste_count * 5) - (wasteData.waste_amount * 2);
      return {
        id: user.id,
        name: user.full_name || user.username,
        waste_count: wasteData.waste_count,
        score: score > 0 ? score : 0
      };
    });

    rankings.sort((a, b) => b.score - a.score);

    res.json({ status: "success", data: rankings });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      Waste Metrics
// ===============================
exports.getWasteMetrics = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [wasteToday] = await appPool.query(
      `SELECT SUM(quantity) as total_waste FROM waste_records WHERE DATE(waste_date) = ?`,
      [today]
    );
    
    // Assume daily expected inventory total is around 1000 for percentage (mock target if none exists)
    const total_waste = wasteToday[0].total_waste || 0;
    const waste_percentage = ((total_waste / 1000) * 100).toFixed(2); // Example logic

    res.json({
      status: "success",
      data: {
        total_waste: total_waste,
        waste_percentage: waste_percentage
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      Fraud Alerts (Audit Trail)
// ===============================
exports.getFraudAlerts = async (req, res) => {
  try {
    const [alerts] = await appPool.query(
      `SELECT * FROM audit_trails 
       WHERE action_type IN ('delete', 'manual_adjustment', 'sensitive_update')
       ORDER BY created_at DESC LIMIT 5`
    );

    // Fetch user names
    for (let alert of alerts) {
      if (alert.user_id) {
        const [userRows] = await authPool.query(`SELECT username, full_name FROM users WHERE id = ?`, [alert.user_id]);
        if (userRows.length > 0) {
          alert.user_name = userRows[0].full_name || userRows[0].username;
        } else {
          alert.user_name = 'Unknown';
        }
      } else {
         alert.user_name = 'System';
      }
    }

    res.json({ status: "success", data: alerts });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      Inventory Watchdog
// ===============================
exports.getLowStockAlerts = async (req, res) => {
  try {
    const lowStockThreshold = 10; // This could be dynamic per ingredient
    const [lowStock] = await appPool.query(
      `SELECT id, name, stock_quantity, unit FROM ingredients WHERE stock_quantity <= ?`,
      [lowStockThreshold]
    );

    res.json({ status: "success", data: lowStock });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      Z-Report Logic
// ===============================
exports.generateZReport = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const userId = req.user?.id;

    // Calculate Actual Stock via SUM of all ingredients
    const [actualData] = await appPool.query(`SELECT SUM(stock_quantity) as total_actual FROM ingredients`);
    const actualStock = parseFloat(actualData[0].total_actual) || 0;

    // Calculate Theoretical Stock metrics for today
    const [depositsData] = await appPool.query(`SELECT SUM(quantity) as total_deposits FROM transactions WHERE type='deposit' AND DATE(created_at) = ?`, [today]);
    const deposits = parseFloat(depositsData[0].total_deposits) || 0;

    const [withdrawalsData] = await appPool.query(`SELECT SUM(quantity) as total_withdrawals FROM transactions WHERE type='withdraw' AND DATE(created_at) = ?`, [today]);
    const withdrawals = parseFloat(withdrawalsData[0].total_withdrawals) || 0;

    const [wasteData] = await appPool.query(`SELECT SUM(quantity) as total_waste FROM waste_records WHERE DATE(waste_date) = ?`, [today]);
    const waste = parseFloat(wasteData[0].total_waste) || 0;

    // Theoretical Stock incorporates the known waste to calculate the intended inventory level
    const theoreticalStock = actualStock + waste; 
    const variance = theoreticalStock - actualStock;

    const [result] = await appPool.execute(
      `INSERT INTO z_reports (report_date, generated_by, theoretical_stock, actual_stock, variance, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [today, userId, theoreticalStock, actualStock, variance, "Daily End of Day Report"]
    );

    res.json({
      status: "success",
      message: "Z-Report generated successfully",
      data: {
        id: result.insertId,
        theoretical_stock: theoreticalStock,
        actual_stock: actualStock,
        variance: variance
      }
    });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};

exports.getZReports = async (req, res) => {
  try {
    const [reports] = await appPool.query(`SELECT * FROM z_reports ORDER BY report_date DESC LIMIT 30`);
    res.json({ status: "success", data: reports });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
};
