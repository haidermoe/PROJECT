/**
 * ======================================================
 * Accounting Frontend Logic - Odoo Standard Accounting
 * Multi-Company & Branch Consolidation Support
 * ======================================================
 */

const token = localStorage.getItem('token');
if (!token) {
  alert('يجب تسجيل الدخول أولاً للوصول للحسابات');
  window.location.href = '/index.html';
}

let allAccounts = [];
let allJournals = [];
let allBranches = [];
let currentBranchId = localStorage.getItem('selected_branch_id') || 'all';
let currentActiveTab = 'chart';

// ===============================
// 1) إدارة الفروع والتوحيد المالي (Consolidation)
// ===============================
async function initBranchSelector() {
  try {
    const res = await fetch('/api/branches', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status === 'success') {
      allBranches = result.data || [];

      // تعبئة فلتر رأس الصفحة
      const filterSel = document.getElementById('accountingBranchFilter');
      if (filterSel) {
        filterSel.innerHTML = `
          <option value="all">🌐 كل الفروع (الميزانية الموحدة للشركة القابضة - Consolidated)</option>
          ${allBranches.map(b => `<option value="${b.id}">🏢 ${b.name} (${b.code})</option>`).join('')}
        `;
        filterSel.value = currentBranchId;
      }

      // تعبئة قائمة الفرع في نافذة القيد الجديد
      const moveBranchSel = document.getElementById('newMoveBranch');
      if (moveBranchSel) {
        moveBranchSel.innerHTML = allBranches.map(b => `<option value="${b.id}">${b.name} (${b.code})</option>`).join('');
        if (currentBranchId !== 'all') {
          moveBranchSel.value = currentBranchId;
        }
      }
    }
  } catch (err) {
    console.error('خطأ في تحميل الفروع المحاسبية:', err);
  }
}

window.onAccountingBranchChange = function() {
  const filterSel = document.getElementById('accountingBranchFilter');
  if (filterSel) {
    currentBranchId = filterSel.value;
    localStorage.setItem('selected_branch_id', currentBranchId);
    loadFinancialOverview();
    switchTab(currentActiveTab);
  }
};

// ===============================
// 2) تبديل التبويبات (Tabs Navigation)
// ===============================
window.switchTab = function(tabId) {
  currentActiveTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

  const btn = document.getElementById(`tab-btn-${tabId}`);
  const panel = document.getElementById(`panel-${tabId}`);
  if (btn) btn.classList.add('active');
  if (panel) panel.classList.add('active');

  if (tabId === 'chart') loadChartOfAccounts();
  else if (tabId === 'moves') loadJournalMoves();
  else if (tabId === 'pl') loadProfitAndLoss();
  else if (tabId === 'bs') loadBalanceSheet();
  else if (tabId === 'tb') loadTrialBalance();
  else if (tabId === 'branch-comp') loadBranchComparison();
};

// ===============================
// 3) تحميل المؤشرات المالية العامة
// ===============================
async function loadFinancialOverview() {
  try {
    const res = await fetch(`/api/accounting/overview?branchId=${currentBranchId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') return;

    const data = result.data;
    document.getElementById('kpiCashVal').textContent = `${parseFloat(data.cashAndBank || 0).toLocaleString()} د.ع`;
    document.getElementById('kpiRevVal').textContent = `${parseFloat(data.monthlyRevenue || 0).toLocaleString()} د.ع`;
    document.getElementById('kpiExpVal').textContent = `${parseFloat(data.monthlyExpense || 0).toLocaleString()} د.ع`;
    document.getElementById('kpiNetVal').textContent = `${parseFloat(data.monthlyNetProfit || 0).toLocaleString()} د.ع`;
    
    const marginEl = document.getElementById('kpiMarginVal');
    if (marginEl) {
      marginEl.textContent = `هامش الربح: ${data.profitMargin}%`;
    }
  } catch (err) {
    console.error('خطأ في جلب المؤشرات:', err);
  }
}

// ===============================
// 4) شجرة الحسابات (Chart of Accounts)
// ===============================
async function loadChartOfAccounts() {
  try {
    const res = await fetch(`/api/accounting/chart-of-accounts?branchId=${currentBranchId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    allAccounts = result.data;
    renderAccountsTable(allAccounts);
    populateAccountSelects();
  } catch (err) {
    console.error('خطأ في جلب شجرة الحسابات:', err);
  }
}

function renderAccountsTable(accounts) {
  const tbody = document.getElementById('accountsTableBody');
  if (!tbody) return;

  if (accounts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#94a3b8;">لا توجد حسابات</td></tr>`;
    return;
  }

  tbody.innerHTML = accounts.map(a => {
    let typeBadgeClass = 'badge-asset';
    let typeNameAr = 'أصول';
    if (a.type === 'liability') { typeBadgeClass = 'badge-liability'; typeNameAr = 'خصوم'; }
    else if (a.type === 'equity') { typeBadgeClass = 'badge-equity'; typeNameAr = 'حقوق ملكية'; }
    else if (a.type === 'income') { typeBadgeClass = 'badge-income'; typeNameAr = 'إيرادات'; }
    else if (a.type === 'expense') { typeBadgeClass = 'badge-expense'; typeNameAr = 'مصاريف'; }

    return `
      <tr>
        <td><strong>${a.code}</strong></td>
        <td><strong>${a.name}</strong></td>
        <td><span class="badge ${typeBadgeClass}">${typeNameAr}</span></td>
        <td>${a.reconcile ? '✅ نعم' : 'لا'}</td>
        <td style="color: #10b981;">${parseFloat(a.total_debit || 0).toLocaleString()} د.ع</td>
        <td style="color: #ef4444;">${parseFloat(a.total_credit || 0).toLocaleString()} د.ع</td>
        <td style="font-weight: bold; color: ${a.current_balance >= 0 ? '#38bdf8' : '#f87171'};">
          ${parseFloat(a.current_balance || 0).toLocaleString()} د.ع
        </td>
      </tr>
    `;
  }).join('');
}

// ===============================
// 5) دفتر اليومية والقيود (Journal Moves)
// ===============================
async function loadJournalMoves() {
  try {
    const res = await fetch(`/api/accounting/moves?branchId=${currentBranchId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    const moves = result.data;
    const tbody = document.getElementById('movesTableBody');
    if (!tbody) return;

    if (moves.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#94a3b8;">لا توجد قيود مسجلة لهذا النطاق</td></tr>`;
      return;
    }

    tbody.innerHTML = moves.map(m => {
      const stateBadge = m.state === 'posted' 
        ? `<span class="badge badge-posted">مُرحّل (Posted)</span>` 
        : `<span class="badge badge-draft">مسودة (Draft)</span>`;

      return `
        <tr>
          <td><strong>${m.name}</strong></td>
          <td>${m.date ? m.date.split('T')[0] : ''}</td>
          <td>${m.journal_name || 'عام'}</td>
          <td><span style="font-size:0.8rem; background:#1e293b; padding:2px 6px; border-radius:4px; color:#38bdf8;">${m.branch_name || 'المركز الرئيسي'}</span></td>
          <td>${m.ref || '-'}</td>
          <td style="color: #10b981; font-weight: bold;">${parseFloat(m.total_amount || 0).toLocaleString()} د.ع</td>
          <td>${stateBadge}</td>
          <td>${m.user_name || 'النظام'}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('خطأ في جلب القيود:', err);
  }
}

// ===============================
// 6) إنشاء قيد جديد (New Balanced Move)
// ===============================
async function loadJournals() {
  try {
    const res = await fetch('/api/accounting/journals', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status === 'success') {
      allJournals = result.data;
      const select = document.getElementById('newMoveJournal');
      if (select) {
        select.innerHTML = allJournals.map(j => `<option value="${j.id}">${j.name} (${j.code})</option>`).join('');
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function populateAccountSelects() {
  const options = allAccounts.map(a => `<option value="${a.id}">[${a.code}] ${a.name}</option>`).join('');
  document.querySelectorAll('.account-select-line').forEach(sel => {
    sel.innerHTML = options;
  });
}

window.openNewMoveModal = function() {
  document.getElementById('newMoveDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('newMoveRef').value = '';
  if (currentBranchId !== 'all') {
    const moveBranchSel = document.getElementById('newMoveBranch');
    if (moveBranchSel) moveBranchSel.value = currentBranchId;
  }
  document.getElementById('moveModal').classList.add('active');
  resetMoveLines();
};

window.closeNewMoveModal = function() {
  document.getElementById('moveModal').classList.remove('active');
};

window.resetMoveLines = function() {
  const container = document.getElementById('moveLinesContainer');
  container.innerHTML = `
    <div class="move-line-row" style="display: flex; gap: 8px; margin-bottom: 8px;">
      <select class="form-control account-select-line" style="flex:2;"></select>
      <input type="text" class="form-control line-label" placeholder="البيان والشرح" style="flex:2;" />
      <input type="number" step="0.01" class="form-control line-debit" placeholder="مدين" style="flex:1;" oninput="recalcMoveBalance()" />
      <input type="number" step="0.01" class="form-control line-credit" placeholder="دائن" style="flex:1;" oninput="recalcMoveBalance()" />
      <button type="button" class="btn-primary" style="background:#ef4444; padding:0 10px;" onclick="removeMoveLine(this)">✖</button>
    </div>
    <div class="move-line-row" style="display: flex; gap: 8px; margin-bottom: 8px;">
      <select class="form-control account-select-line" style="flex:2;"></select>
      <input type="text" class="form-control line-label" placeholder="البيان والشرح" style="flex:2;" />
      <input type="number" step="0.01" class="form-control line-debit" placeholder="مدين" style="flex:1;" oninput="recalcMoveBalance()" />
      <input type="number" step="0.01" class="form-control line-credit" placeholder="دائن" style="flex:1;" oninput="recalcMoveBalance()" />
      <button type="button" class="btn-primary" style="background:#ef4444; padding:0 10px;" onclick="removeMoveLine(this)">✖</button>
    </div>
  `;
  populateAccountSelects();
  recalcMoveBalance();
};

window.addMoveLine = function() {
  const container = document.getElementById('moveLinesContainer');
  const row = document.createElement('div');
  row.className = 'move-line-row';
  row.style = 'display: flex; gap: 8px; margin-bottom: 8px;';
  row.innerHTML = `
    <select class="form-control account-select-line" style="flex:2;"></select>
    <input type="text" class="form-control line-label" placeholder="البيان والشرح" style="flex:2;" />
    <input type="number" step="0.01" class="form-control line-debit" placeholder="مدين" style="flex:1;" oninput="recalcMoveBalance()" />
    <input type="number" step="0.01" class="form-control line-credit" placeholder="دائن" style="flex:1;" oninput="recalcMoveBalance()" />
    <button type="button" class="btn-primary" style="background:#ef4444; padding:0 10px;" onclick="removeMoveLine(this)">✖</button>
  `;
  container.appendChild(row);
  populateAccountSelects();
};

window.removeMoveLine = function(btn) {
  const rows = document.querySelectorAll('.move-line-row');
  if (rows.length <= 2) {
    alert('يجب أن يحتوي القيد على سطرين على الأقل (طرف مدين وطرف دائن)');
    return;
  }
  btn.closest('.move-line-row').remove();
  recalcMoveBalance();
};

window.recalcMoveBalance = function() {
  let totalDebit = 0;
  let totalCredit = 0;

  document.querySelectorAll('.move-line-row').forEach(row => {
    const debit = parseFloat(row.querySelector('.line-debit').value) || 0;
    const credit = parseFloat(row.querySelector('.line-credit').value) || 0;
    totalDebit += debit;
    totalCredit += credit;
  });

  const diff = totalDebit - totalCredit;
  const statusDiv = document.getElementById('moveBalanceStatus');
  if (Math.abs(diff) < 0.001 && totalDebit > 0) {
    statusDiv.innerHTML = `<span style="color:#10b981; font-weight:bold;">✅ القيد متوازن تماماً | مجموع المدين: ${totalDebit.toLocaleString()} د.ع = مجموع الدائن: ${totalCredit.toLocaleString()} د.ع</span>`;
  } else {
    statusDiv.innerHTML = `<span style="color:#f87171; font-weight:bold;">⚠️ القيد غير متوازن | مدين: ${totalDebit.toLocaleString()} د.ع | دائن: ${totalCredit.toLocaleString()} د.ع | الفارق: ${Math.abs(diff).toLocaleString()} د.ع</span>`;
  }
};

window.submitNewMove = async function() {
  const date = document.getElementById('newMoveDate').value;
  const journal_id = document.getElementById('newMoveJournal').value;
  const branch_id = document.getElementById('newMoveBranch')?.value || 1;
  const ref = document.getElementById('newMoveRef').value;

  const rows = document.querySelectorAll('.move-line-row');
  const lines = [];
  let totalDebit = 0;
  let totalCredit = 0;

  rows.forEach(r => {
    const account_id = r.querySelector('.account-select-line').value;
    const name = r.querySelector('.line-label').value;
    const debit = parseFloat(r.querySelector('.line-debit').value) || 0;
    const credit = parseFloat(r.querySelector('.line-credit').value) || 0;

    if (debit > 0 || credit > 0) {
      lines.push({ account_id, name, debit, credit });
      totalDebit += debit;
      totalCredit += credit;
    }
  });

  if (lines.length < 2) {
    alert('يجب إدخال طرفين على الأقل للقيد المحاسبي');
    return;
  }

  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    alert(`لا يمكن ترحيل القيد! القيد غير متوازن، الفرق بين المدين والدائن هو ${(totalDebit - totalCredit).toLocaleString()} د.ع`);
    return;
  }

  try {
    const res = await fetch('/api/accounting/moves', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ date, journal_id, branch_id, ref, lines })
    });

    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert(`✅ ${result.message}`);
    closeNewMoveModal();
    loadJournalMoves();
    loadFinancialOverview();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

// ===============================
// 7) تقرير الأرباح والخسائر (Profit & Loss)
// ===============================
async function loadProfitAndLoss() {
  try {
    const res = await fetch(`/api/accounting/reports/profit-and-loss?branchId=${currentBranchId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') return;

    const { summary, revenues, directCosts, expenses } = result.data;

    document.getElementById('plRevenues').innerHTML = revenues.map(r => `
      <div class="statement-row">
        <span>${r.name} (${r.code})</span>
        <strong>${r.amount.toLocaleString()} د.ع</strong>
      </div>
    `).join('') || '<div style="color:#94a3b8;">لا توجد مبيعات مسجلة في هذه الفترة</div>';

    document.getElementById('plTotalRevenue').textContent = `${summary.totalRevenue.toLocaleString()} د.ع`;

    document.getElementById('plDirectCosts').innerHTML = directCosts.map(c => `
      <div class="statement-row">
        <span>${c.name} (${c.code})</span>
        <strong>${c.amount.toLocaleString()} د.ع</strong>
      </div>
    `).join('') || '<div style="color:#94a3b8;">لا توجد تكاليف مباشرة مسجلة</div>';

    document.getElementById('plTotalCOGS').textContent = `${summary.totalCOGS.toLocaleString()} د.ع`;
    document.getElementById('plGrossProfit').textContent = `${summary.grossProfit.toLocaleString()} د.ع (هامش ${summary.grossMarginPercent}%)`;

    document.getElementById('plExpenses').innerHTML = expenses.map(e => `
      <div class="statement-row">
        <span>${e.name} (${e.code})</span>
        <strong>${e.amount.toLocaleString()} د.ع</strong>
      </div>
    `).join('') || '<div style="color:#94a3b8;">لا توجد مصاريف تشغيلية</div>';

    document.getElementById('plTotalExpenses').textContent = `${summary.totalOperatingExpenses.toLocaleString()} د.ع`;
    document.getElementById('plNetProfit').textContent = `${summary.netProfit.toLocaleString()} د.ع (صافي هامش ${summary.netMarginPercent}%)`;
  } catch (err) {
    console.error('خطأ في تقرير الأرباح والخسائر:', err);
  }
}

// ===============================
// 8) الميزانية العمومية (Balance Sheet)
// ===============================
async function loadBalanceSheet() {
  try {
    const res = await fetch(`/api/accounting/reports/balance-sheet?branchId=${currentBranchId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') return;

    const { summary, assets, liabilities, equity } = result.data;

    document.getElementById('bsAssets').innerHTML = assets.map(a => `
      <div class="statement-row">
        <span>${a.name} (${a.code})</span>
        <strong>${a.balance.toLocaleString()} د.ع</strong>
      </div>
    `).join('');

    document.getElementById('bsTotalAssets').textContent = `${summary.totalAssets.toLocaleString()} د.ع`;

    document.getElementById('bsLiabilities').innerHTML = liabilities.map(l => `
      <div class="statement-row">
        <span>${l.name} (${l.code})</span>
        <strong>${l.balance.toLocaleString()} د.ع</strong>
      </div>
    `).join('');

    document.getElementById('bsTotalLiabilities').textContent = `${summary.totalLiabilities.toLocaleString()} د.ع`;

    document.getElementById('bsEquity').innerHTML = equity.map(e => `
      <div class="statement-row">
        <span>${e.name} (${e.code})</span>
        <strong>${e.balance.toLocaleString()} د.ع</strong>
      </div>
    `).join('');

    document.getElementById('bsTotalEquity').textContent = `${summary.totalEquity.toLocaleString()} د.ع`;
    document.getElementById('bsTotalLiabEquity').textContent = `${summary.totalLiabilitiesAndEquity.toLocaleString()} د.ع`;

    const balanceCheck = document.getElementById('bsBalanceCheck');
    if (summary.isBalanced) {
      balanceCheck.innerHTML = `<span style="color:#10b981; font-weight:bold;">✅ الميزانية متوازنة تماماً: الأصول = الالتزامات + حقوق الملكية</span>`;
    } else {
      balanceCheck.innerHTML = `<span style="color:#f87171; font-weight:bold;">⚠️ الميزانية غير متوازنة (الفارق: ${(summary.totalAssets - summary.totalLiabilitiesAndEquity).toLocaleString()} د.ع)</span>`;
    }
  } catch (err) {
    console.error('خطأ في الميزانية العمومية:', err);
  }
}

// ===============================
// 9) ميزان المراجعة (Trial Balance)
// ===============================
async function loadTrialBalance() {
  try {
    const res = await fetch(`/api/accounting/reports/trial-balance?branchId=${currentBranchId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') return;

    const { accounts, totalDebit, totalCredit, isBalanced } = result.data;
    const tbody = document.getElementById('tbTableBody');
    if (!tbody) return;

    tbody.innerHTML = accounts.map(a => `
      <tr>
        <td><strong>${a.code}</strong></td>
        <td>${a.name}</td>
        <td>${parseFloat(a.debit || 0).toLocaleString()} د.ع</td>
        <td>${parseFloat(a.credit || 0).toLocaleString()} د.ع</td>
        <td>${parseFloat(a.netDebit || 0).toLocaleString()} د.ع</td>
        <td>${parseFloat(a.netCredit || 0).toLocaleString()} د.ع</td>
      </tr>
    `).join('');

    document.getElementById('tbTotalDebit').textContent = `${totalDebit.toLocaleString()} د.ع`;
    document.getElementById('tbTotalCredit').textContent = `${totalCredit.toLocaleString()} د.ع`;

    const checkEl = document.getElementById('tbBalanceCheck');
    if (isBalanced) {
      checkEl.innerHTML = `<span style="color:#10b981; font-weight:bold;">✅ ميزان المراجعة متطابق ومتوازن</span>`;
    } else {
      checkEl.innerHTML = `<span style="color:#f87171; font-weight:bold;">⚠️ ميزان المراجعة غير متوازن بفارق ${(totalDebit - totalCredit).toLocaleString()} د.ع</span>`;
    }
  } catch (err) {
    console.error('خطأ في ميزان المراجعة:', err);
  }
}

// ===============================
// 10) مقارنة أداء الفروع (Branch Performance Report)
// ===============================
async function loadBranchComparison() {
  try {
    const res = await fetch('/api/accounting/reports/branch-comparison', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    const { branches, totalHoldingRevenue, totalHoldingNetProfit } = result.data;
    const tbody = document.getElementById('branchCompTableBody');
    if (!tbody) return;

    if (branches.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:#94a3b8;">لا تتوفر بيانات مقارنة حالياً</td></tr>`;
      return;
    }

    tbody.innerHTML = branches.map(b => {
      const marginColor = b.profitMargin >= 20 ? '#10b981' : (b.profitMargin >= 0 ? '#38bdf8' : '#f87171');
      const netColor = b.netProfit >= 0 ? '#10b981' : '#f87171';

      return `
        <tr>
          <td><strong style="color:#38bdf8; font-family:monospace;">${b.code}</strong></td>
          <td><strong>${b.name}</strong></td>
          <td>${b.city || 'بغداد'}</td>
          <td style="color:#10b981; font-weight:600;">${b.revenue.toLocaleString()} د.ع</td>
          <td style="color:#f87171;">${b.cogs.toLocaleString()} د.ع</td>
          <td style="color:#38bdf8; font-weight:600;">${b.grossProfit.toLocaleString()} د.ع</td>
          <td style="color:#f87171;">${b.operatingExpenses.toLocaleString()} د.ع</td>
          <td style="color:${netColor}; font-weight:bold; font-size:1.05rem;">${b.netProfit.toLocaleString()} د.ع</td>
          <td style="color:${marginColor}; font-weight:bold;">${b.profitMargin}%</td>
          <td>
            <div style="display:flex; align-items:center; gap: 8px;">
              <span style="font-weight:bold; color:#c084fc;">${b.contributionPercentage}%</span>
              <div style="flex:1; background:#0f172a; height:6px; border-radius:3px; overflow:hidden; min-width:60px;">
                <div style="width:${Math.max(0, Math.min(100, b.contributionPercentage))}%; background:#8b5cf6; height:100%;"></div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML += `
      <tr style="background:#172033; font-weight:bold; border-top:2px solid #3b82f6;">
        <td colspan="3" style="color:#38bdf8;">🌐 المجموع الموحد لكافة شركات وفروع المجموعة:</td>
        <td style="color:#10b981;">${totalHoldingRevenue.toLocaleString()} د.ع</td>
        <td colspan="3"></td>
        <td style="color:#10b981; font-size:1.1rem;">${totalHoldingNetProfit.toLocaleString()} د.ع</td>
        <td></td>
        <td style="color:#c084fc;">100%</td>
      </tr>
    `;
  } catch (err) {
    console.error('خطأ في جلب تقرير مقارنة الفروع:', err);
  }
}

// تسجيل الخروج
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
});

// بدء التشغيل
initBranchSelector();
loadFinancialOverview();
loadChartOfAccounts();
loadJournals();
