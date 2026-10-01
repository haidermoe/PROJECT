/**
 * ======================================================
 * Accounting Controller - نظام الحسابات والتحليلات المالية
 * مبني طبقاً لمعايير وهيكلية Odoo 19 (Odoo Accounting)
 * ======================================================
 */

const { appPool } = require('../database/appConnection');

// ===============================
//      1) شجرة الحسابات (Chart of Accounts)
// ===============================
exports.getChartOfAccounts = async (req, res) => {
  try {
    const { branchId } = req.query;
    let branchFilter = "";
    const params = [];
    if (branchId && branchId !== 'all') {
      branchFilter = "AND m.branch_id = ?";
      params.push(branchId);
    }

    // جلب الحسابات مع حساب الرصيد التراكمي من قيود اليومية المرحّلة (الموحدة أو لفرع محدد)
    const [accounts] = await appPool.query(`
      SELECT 
        a.id,
        a.code,
        a.name,
        a.account_type,
        a.reconcile,
        a.is_active,
        COALESCE(SUM(l.debit), 0) AS total_debit,
        COALESCE(SUM(l.credit), 0) AS total_credit
      FROM account_account a
      LEFT JOIN account_move_line l ON a.id = l.account_id
      LEFT JOIN account_move m ON l.move_id = m.id AND m.state = 'posted' ${branchFilter}
      WHERE a.is_active = 1
      GROUP BY a.id, a.code, a.name, a.account_type, a.reconcile, a.is_active
      ORDER BY a.code ASC
    `, params);

    // تصنيف وتحديد طبيعة الرصيد (مدين أو دائن حسب معايير أودو)
    const formattedAccounts = accounts.map(acc => {
      const debit = parseFloat(acc.total_debit) || 0;
      const credit = parseFloat(acc.total_credit) || 0;
      
      let balance = 0;
      // في أودو: الأصول والمصروفات طبيعتها مدينة (Debit - Credit)
      // والخصوم وحقوق الملكية والإيرادات طبيعتها دائنة (Credit - Debit)
      if (['asset_cash', 'asset_receivable', 'asset_current', 'asset_fixed', 'expense_direct_cost', 'expense'].includes(acc.account_type)) {
        balance = debit - credit;
      } else {
        balance = credit - debit;
      }

      // تصنيف أودو الرئيسي
      let category = 'أخرى';
      if (acc.account_type.startsWith('asset_')) category = 'أصول (Assets)';
      else if (acc.account_type.startsWith('liability_')) category = 'خصوم والتزامات (Liabilities)';
      else if (acc.account_type === 'equity') category = 'حقوق ملكية (Equity)';
      else if (acc.account_type === 'income') category = 'إيرادات (Income)';
      else if (acc.account_type === 'expense_direct_cost') category = 'تكلفة البضاعة والمواد (COGS)';
      else if (acc.account_type === 'expense') category = 'مصروفات تشغيلية (Expenses)';

      return {
        ...acc,
        total_debit: debit,
        total_credit: credit,
        balance: balance,
        category: category
      };
    });

    res.json({ status: 'success', data: formattedAccounts });
  } catch (err) {
    console.error('❌ خطأ في getChartOfAccounts:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// إضافة حساب جديد في شجرة الحسابات
exports.createAccount = async (req, res) => {
  try {
    const { code, name, account_type, reconcile } = req.body;
    if (!code || !name || !account_type) {
      return res.status(400).json({ status: 'error', message: 'الكود واسم الحساب ونوعه مطلوبة' });
    }

    const [existing] = await appPool.query('SELECT id FROM account_account WHERE code = ?', [code]);
    if (existing.length > 0) {
      return res.status(400).json({ status: 'error', message: 'كود الحساب موجود مسبقاً' });
    }

    const [result] = await appPool.query(
      `INSERT INTO account_account (code, name, account_type, reconcile) VALUES (?, ?, ?, ?)`,
      [code, name, account_type, reconcile ? 1 : 0]
    );

    res.json({ status: 'success', message: 'تم إنشاء الحساب بنجاح', accountId: result.insertId });
  } catch (err) {
    console.error('❌ خطأ في createAccount:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
//      2) دفاتر اليومية (Journals)
// ===============================
exports.getJournals = async (req, res) => {
  try {
    const [journals] = await appPool.query(`
      SELECT j.*, a.name AS default_account_name, a.code AS default_account_code
      FROM account_journal j
      LEFT JOIN account_account a ON j.default_account_id = a.id
      WHERE j.is_active = 1
      ORDER BY j.id ASC
    `);
    res.json({ status: 'success', data: journals });
  } catch (err) {
    console.error('❌ خطأ في getJournals:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ===============================
//      3) القيود اليومية (Journal Entries / Moves)
// ===============================
exports.getMoves = async (req, res) => {
  try {
    const { branchId } = req.query;
    let query = `
      SELECT m.*, j.name AS journal_name, j.code AS journal_code,
             COALESCE(b.branch_name, 'المقر الرئيسي') AS branch_name,
             COALESCE(b.branch_code, 'HQ') AS branch_code
      FROM account_move m
      JOIN account_journal j ON m.journal_id = j.id
      LEFT JOIN branches b ON m.branch_id = b.id
    `;
    const params = [];
    if (branchId && branchId !== 'all') {
      query += ` WHERE m.branch_id = ?`;
      params.push(branchId);
    }
    query += ` ORDER BY m.date DESC, m.id DESC LIMIT 100`;

    const [moves] = await appPool.query(query, params);

    // إرفاق سطور القيود لكل قيد
    for (const move of moves) {
      const [lines] = await appPool.query(`
        SELECT l.*, a.code AS account_code, a.name AS account_name
        FROM account_move_line l
        JOIN account_account a ON l.account_id = a.id
        WHERE l.move_id = ?
        ORDER BY l.id ASC
      `, [move.id]);
      move.lines = lines;
    }

    res.json({ status: 'success', data: moves });
  } catch (err) {
    console.error('❌ خطأ في getMoves:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// إنشاء قيد يومية جديد (مع التحقق من توازن المدين والدائن كما في Odoo)
exports.createMove = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const { date, ref, journal_id, lines, state = 'posted', branch_id } = req.body;
    if (!date || !journal_id || !lines || !Array.isArray(lines) || lines.length < 2) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'بيانات القيد غير مكتملة، يجب إدخال طرفين على الأقل' });
    }

    // التحقق من توازن القيد (Debit == Credit)
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      totalDebit += parseFloat(line.debit || 0);
      totalCredit += parseFloat(line.credit || 0);
    }

    totalDebit = Math.round(totalDebit * 100) / 100;
    totalCredit = Math.round(totalCredit * 100) / 100;

    if (totalDebit !== totalCredit) {
      await connection.rollback();
      return res.status(400).json({
        status: 'error',
        message: `القيد غير متوازن وفق المعايير المحاسبية! إجمالي المدين (${totalDebit}) لا يساوي إجمالي الدائن (${totalCredit})`
      });
    }

    // توليد رقم تسلسلي للقيد حسب اليومية والسنة
    const [journalRows] = await connection.query('SELECT code FROM account_journal WHERE id = ?', [journal_id]);
    const journalCode = journalRows[0]?.code || 'MISC';
    const year = new Date(date).getFullYear();

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS count FROM account_move WHERE journal_id = ? AND YEAR(date) = ?`,
      [journal_id, year]
    );
    const seq = String(countRows[0].count + 1).padStart(4, '0');
    const moveName = `${journalCode}/${year}/${seq}`;

    // إدراج القيد الرئيسي مع ربطه بالفرع
    const [moveResult] = await connection.query(
      `INSERT INTO account_move (name, date, ref, journal_id, state, total_amount, created_by, branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [moveName, date, ref || null, journal_id, state, totalDebit, req.user?.id || null, branch_id || 1]
    );
    const moveId = moveResult.insertId;

    // إدراج تفاصيل أسطر القيد
    for (const line of lines) {
      await connection.query(
        `INSERT INTO account_move_line (move_id, account_id, name, debit, credit)
         VALUES (?, ?, ?, ?, ?)`,
        [moveId, line.account_id, line.name || ref || 'قيد محاسبي', line.debit || 0, line.credit || 0]
      );
    }

    await connection.commit();
    res.json({
      status: 'success',
      message: `تم إنشاء القيد المحاسبي (${moveName}) بنجاح`,
      moveId,
      moveName
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في createMove:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
//      4) التحليلات والتقارير المالية (Financial Analytics)
// ===============================

// أ) تقرير الأرباح والخسائر (Profit & Loss / P&L)
exports.getProfitAndLoss = async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;
    let extraFilter = "";
    const params = [];

    if (startDate && endDate) {
      extraFilter += " AND m.date BETWEEN ? AND ?";
      params.push(startDate, endDate);
    }

    if (branchId && branchId !== 'all') {
      extraFilter += " AND m.branch_id = ?";
      params.push(branchId);
    }

    const [rows] = await appPool.query(`
      SELECT 
        a.id, a.code, a.name, a.account_type,
        COALESCE(SUM(l.debit), 0) AS total_debit,
        COALESCE(SUM(l.credit), 0) AS total_credit
      FROM account_account a
      LEFT JOIN account_move_line l ON a.id = l.account_id
      LEFT JOIN account_move m ON l.move_id = m.id AND m.state = 'posted' ${extraFilter}
      WHERE a.account_type IN ('income', 'expense_direct_cost', 'expense')
      GROUP BY a.id, a.code, a.name, a.account_type
      ORDER BY a.code ASC
    `, params);

    let totalRevenue = 0;
    let totalCOGS = 0;
    let totalOperatingExpenses = 0;

    const revenues = [];
    const directCosts = [];
    const expenses = [];

    for (const r of rows) {
      const debit = parseFloat(r.total_debit) || 0;
      const credit = parseFloat(r.total_credit) || 0;

      if (r.account_type === 'income') {
        const netIncome = credit - debit;
        totalRevenue += netIncome;
        revenues.push({ code: r.code, name: r.name, amount: netIncome });
      } else if (r.account_type === 'expense_direct_cost') {
        const cost = debit - credit;
        totalCOGS += cost;
        directCosts.push({ code: r.code, name: r.name, amount: cost });
      } else if (r.account_type === 'expense') {
        const exp = debit - credit;
        totalOperatingExpenses += exp;
        expenses.push({ code: r.code, name: r.name, amount: exp });
      }
    }

    const grossProfit = totalRevenue - totalCOGS;
    const netProfit = grossProfit - totalOperatingExpenses;
    const grossMarginPercent = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0;
    const netMarginPercent = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;
    const foodCostPercent = totalRevenue > 0 ? ((totalCOGS / totalRevenue) * 100).toFixed(2) : 0;

    res.json({
      status: 'success',
      data: {
        summary: {
          totalRevenue,
          totalCOGS,
          grossProfit,
          totalOperatingExpenses,
          netProfit,
          grossMarginPercent,
          netMarginPercent,
          foodCostPercent
        },
        revenues,
        directCosts,
        expenses
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getProfitAndLoss:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ب) الميزانية العمومية (Balance Sheet)
exports.getBalanceSheet = async (req, res) => {
  try {
    const { asOfDate, branchId } = req.query;
    let dateFilter = "";
    const params = [];

    if (asOfDate) {
      dateFilter += " AND m.date <= ?";
      params.push(asOfDate);
    }

    if (branchId && branchId !== 'all') {
      dateFilter += " AND m.branch_id = ?";
      params.push(branchId);
    }

    const [rows] = await appPool.query(`
      SELECT 
        a.id, a.code, a.name, a.account_type,
        COALESCE(SUM(l.debit), 0) AS total_debit,
        COALESCE(SUM(l.credit), 0) AS total_credit
      FROM account_account a
      LEFT JOIN account_move_line l ON a.id = l.account_id
      LEFT JOIN account_move m ON l.move_id = m.id AND m.state = 'posted' ${dateFilter}
      GROUP BY a.id, a.code, a.name, a.account_type
      ORDER BY a.code ASC
    `, params);

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    const assets = [];
    const liabilities = [];
    const equity = [];

    let currentPeriodNetProfit = 0;

    for (const r of rows) {
      const debit = parseFloat(r.total_debit) || 0;
      const credit = parseFloat(r.total_credit) || 0;

      if (r.account_type.startsWith('asset_')) {
        const balance = debit - credit;
        totalAssets += balance;
        assets.push({ code: r.code, name: r.name, type: r.account_type, balance });
      } else if (r.account_type.startsWith('liability_')) {
        const balance = credit - debit;
        totalLiabilities += balance;
        liabilities.push({ code: r.code, name: r.name, type: r.account_type, balance });
      } else if (r.account_type === 'equity') {
        const balance = credit - debit;
        totalEquity += balance;
        equity.push({ code: r.code, name: r.name, type: r.account_type, balance });
      } else if (r.account_type === 'income') {
        currentPeriodNetProfit += (credit - debit);
      } else if (r.account_type === 'expense' || r.account_type === 'expense_direct_cost') {
        currentPeriodNetProfit -= (debit - credit);
      }
    }

    // في محاسبة أودو، يضاف ربح العام الحالي إلى حقوق الملكية لموازنة الميزانية
    totalEquity += currentPeriodNetProfit;
    equity.push({
      code: '999999',
      name: 'أرباح / (خسائر) الفترة الحالية المحتسبة',
      type: 'equity_unaffected',
      balance: currentPeriodNetProfit
    });

    res.json({
      status: 'success',
      data: {
        summary: {
          totalAssets,
          totalLiabilities,
          totalEquity,
          totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
          isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.05
        },
        assets,
        liabilities,
        equity
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getBalanceSheet:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ج) ميزان المراجعة (Trial Balance)
exports.getTrialBalance = async (req, res) => {
  try {
    const { branchId } = req.query;
    let branchFilter = "";
    const params = [];

    if (branchId && branchId !== 'all') {
      branchFilter = "AND m.branch_id = ?";
      params.push(branchId);
    }

    const [rows] = await appPool.query(`
      SELECT 
        a.id, a.code, a.name, a.account_type,
        COALESCE(SUM(l.debit), 0) AS total_debit,
        COALESCE(SUM(l.credit), 0) AS total_credit
      FROM account_account a
      LEFT JOIN account_move_line l ON a.id = l.account_id
      LEFT JOIN account_move m ON l.move_id = m.id AND m.state = 'posted' ${branchFilter}
      WHERE a.is_active = 1
      GROUP BY a.id, a.code, a.name, a.account_type
      ORDER BY a.code ASC
    `, params);

    let sumDebit = 0;
    let sumCredit = 0;

    const data = rows.map(r => {
      const debit = parseFloat(r.total_debit) || 0;
      const credit = parseFloat(r.total_credit) || 0;
      sumDebit += debit;
      sumCredit += credit;

      return {
        id: r.id,
        code: r.code,
        name: r.name,
        account_type: r.account_type,
        debit,
        credit,
        netDebit: debit > credit ? debit - credit : 0,
        netCredit: credit > debit ? credit - debit : 0
      };
    });

    res.json({
      status: 'success',
      data: {
        accounts: data,
        totalDebit: sumDebit,
        totalCredit: sumCredit,
        isBalanced: Math.abs(sumDebit - sumCredit) < 0.05
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getTrialBalance:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// د) نظرة عامة سريعة للتحليلات (Financial Analytics Dashboard)
exports.getFinancialOverview = async (req, res) => {
  try {
    const { branchId } = req.query;
    let branchFilter = "";
    const params = [];

    if (branchId && branchId !== 'all') {
      branchFilter = "AND m.branch_id = ?";
      params.push(branchId);
    }

    // 1. السيولة النقدية المتوفرة (كاش وبنك)
    const [liquidityRows] = await appPool.query(`
      SELECT 
        COALESCE(SUM(l.debit - l.credit), 0) AS liquid_balance
      FROM account_account a
      JOIN account_move_line l ON a.id = l.account_id
      JOIN account_move m ON l.move_id = m.id AND m.state = 'posted' ${branchFilter}
      WHERE a.account_type = 'asset_cash'
    `, params);

    // 2. إجمالي مبيعات الشهر الحالي
    const [monthlyRevenueRows] = await appPool.query(`
      SELECT 
        COALESCE(SUM(l.credit - l.debit), 0) AS current_month_revenue
      FROM account_account a
      JOIN account_move_line l ON a.id = l.account_id
      JOIN account_move m ON l.move_id = m.id AND m.state = 'posted' ${branchFilter}
      WHERE a.account_type = 'income' AND MONTH(m.date) = MONTH(CURRENT_DATE()) AND YEAR(m.date) = YEAR(CURRENT_DATE())
    `, params);

    // 3. إجمالي مصاريف وتكاليف الشهر الحالي
    const [monthlyExpenseRows] = await appPool.query(`
      SELECT 
        COALESCE(SUM(l.debit - l.credit), 0) AS current_month_expense
      FROM account_account a
      JOIN account_move_line l ON a.id = l.account_id
      JOIN account_move m ON l.move_id = m.id AND m.state = 'posted' ${branchFilter}
      WHERE a.account_type IN ('expense', 'expense_direct_cost') AND MONTH(m.date) = MONTH(CURRENT_DATE()) AND YEAR(m.date) = YEAR(CURRENT_DATE())
    `, params);

    const cashAndBank = parseFloat(liquidityRows[0]?.liquid_balance) || 0;
    const monthlyRevenue = parseFloat(monthlyRevenueRows[0]?.current_month_revenue) || 0;
    const monthlyExpense = parseFloat(monthlyExpenseRows[0]?.current_month_expense) || 0;
    const monthlyNetProfit = monthlyRevenue - monthlyExpense;

    res.json({
      status: 'success',
      data: {
        cashAndBank,
        monthlyRevenue,
        monthlyExpense,
        monthlyNetProfit,
        profitMargin: monthlyRevenue > 0 ? ((monthlyNetProfit / monthlyRevenue) * 100).toFixed(1) : 0
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getFinancialOverview:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// هـ) التقرير المقارن المجمع لأداء الفروع (Multi-Branch Performance Comparison)
exports.getBranchFinancialComparison = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateFilter = "";
    const params = [];
    if (startDate && endDate) {
      dateFilter = "AND m.date BETWEEN ? AND ?";
      params.push(startDate, endDate);
    }

    const [rows] = await appPool.query(`
      SELECT 
        b.id AS branch_id,
        b.branch_name,
        b.branch_code,
        b.currency,
        b.is_headquarters,
        COALESCE(SUM(CASE WHEN a.account_type = 'income' THEN (l.credit - l.debit) ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN a.account_type = 'expense_direct_cost' THEN (l.debit - l.credit) ELSE 0 END), 0) AS cogs,
        COALESCE(SUM(CASE WHEN a.account_type = 'expense' THEN (l.debit - l.credit) ELSE 0 END), 0) AS operating_expenses
      FROM branches b
      LEFT JOIN account_move m ON b.id = m.branch_id AND m.state = 'posted' ${dateFilter}
      LEFT JOIN account_move_line l ON m.id = l.move_id
      LEFT JOIN account_account a ON l.account_id = a.id
      WHERE b.is_active = 1
      GROUP BY b.id, b.branch_name, b.branch_code, b.currency, b.is_headquarters
      ORDER BY revenue DESC
    `, params);

    const totalGroupRevenue = rows.reduce((sum, r) => sum + parseFloat(r.revenue || 0), 0);
    const totalGroupNetProfit = rows.reduce((sum, r) => {
      const gross = parseFloat(r.revenue || 0) - parseFloat(r.cogs || 0);
      const net = gross - parseFloat(r.operating_expenses || 0);
      return sum + net;
    }, 0);

    const comparison = rows.map(r => {
      const rev = parseFloat(r.revenue) || 0;
      const cogs = parseFloat(r.cogs) || 0;
      const opex = parseFloat(r.operating_expenses) || 0;
      const grossProfit = rev - cogs;
      const netProfit = grossProfit - opex;
      const grossMargin = rev > 0 ? ((grossProfit / rev) * 100).toFixed(2) : 0;
      const netMargin = rev > 0 ? ((netProfit / rev) * 100).toFixed(2) : 0;
      const contributionPercent = totalGroupRevenue > 0 ? ((rev / totalGroupRevenue) * 100).toFixed(1) : 0;

      return {
        branchId: r.branch_id,
        branchName: r.branch_name,
        branchCode: r.branch_code,
        currency: r.currency,
        isHeadquarters: !!r.is_headquarters,
        revenue: rev,
        cogs: cogs,
        grossProfit: grossProfit,
        operatingExpenses: opex,
        netProfit: netProfit,
        grossMargin: parseFloat(grossMargin),
        netMargin: parseFloat(netMargin),
        contributionPercent: parseFloat(contributionPercent)
      };
    });

    res.json({
      status: 'success',
      data: {
        totalGroupRevenue,
        totalGroupNetProfit,
        currency: 'IQD',
        branches: comparison
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getBranchFinancialComparison:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

