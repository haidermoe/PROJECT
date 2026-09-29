/**
 * ======================================================
 * Accounting Frontend Logic - Odoo Standard Accounting
 * ======================================================
 */

const token = localStorage.getItem('token');
if (!token) {
  alert('يجب تسجيل الدخول أولاً للوصول للحسابات');
  window.location.href = '/index.html';
}

let allAccounts = [];
let allJournals = [];

// ===============================
// 1) تبديل التبويبات (Tabs Navigation)
// ===============================
window.switchTab = function(tabId) {
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
};

// ===============================
// 2) تحميل المؤشرات المالية العامة
// ===============================
async function loadFinancialOverview() {
  try {
    const res = await fetch('/api/accounting/overview', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') return;

    const data = result.data;
    document.getElementById('kpiCashVal').textContent = `${parseFloat(data.cashAndBank || 0).toLocaleString()} د.ع`;
    document.getElementById('kpiRevVal').textContent = `${parseFloat(data.monthlyRevenue || 0).toLocaleString()} د.ع`;
    document.getElementById('kpiExpVal').textContent = `${parseFloat(data.monthlyExpense || 0).toLocaleString()} د.ع`;
    document.getElementById('kpiNetVal').textContent = `${parseFloat(data.monthlyNetProfit || 0).toLocaleString()} د.ع`;
    document.getElementById('kpiMarginVal').textContent = `هامش الربح: ${data.profitMargin}%`;
  } catch (err) {
    console.error('خطأ في جلب المؤشرات:', err);
  }
}

// ===============================
// 3) شجرة الحسابات (Chart of Accounts)
// ===============================
async function loadChartOfAccounts() {
  try {
    const res = await fetch('/api/accounting/chart-of-accounts', {
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
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">لا توجد حسابات بعد</td></tr>';
    return;
  }

  tbody.innerHTML = accounts.map(acc => {
    let badgeClass = 'badge-asset';
    if (acc.account_type.startsWith('liability_')) badgeClass = 'badge-liability';
    else if (acc.account_type === 'equity') badgeClass = 'badge-equity';
    else if (acc.account_type === 'income') badgeClass = 'badge-income';
    else if (acc.account_type.startsWith('expense')) badgeClass = 'badge-expense';

    return `
      <tr>
        <td><strong>${acc.code}</strong></td>
        <td>${acc.name}</td>
        <td><span class="badge ${badgeClass}">${acc.category}</span></td>
        <td>${acc.reconcile ? '✅ نعم' : '—'}</td>
        <td>${parseFloat(acc.total_debit || 0).toLocaleString()} د.ع</td>
        <td>${parseFloat(acc.total_credit || 0).toLocaleString()} د.ع</td>
        <td><strong>${parseFloat(acc.balance || 0).toLocaleString()} د.ع</strong></td>
      </tr>
    `;
  }).join('');
}

window.filterAccounts = function() {
  const query = document.getElementById('searchAccountInput').value.toLowerCase();
  const filtered = allAccounts.filter(acc => 
    acc.code.toLowerCase().includes(query) ||
    acc.name.toLowerCase().includes(query) ||
    acc.category.toLowerCase().includes(query)
  );
  renderAccountsTable(filtered);
};

// ===============================
// 4) القيود اليومية (Journal Entries / Moves)
// ===============================
async function loadJournalMoves() {
  try {
    const res = await fetch('/api/accounting/moves', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    const moves = result.data;
    const tbody = document.getElementById('movesTableBody');
    if (!tbody) return;

    if (moves.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">لا توجد قيود مسجلة بعد</td></tr>';
      return;
    }

    tbody.innerHTML = moves.map(m => {
      const linesSummary = m.lines ? m.lines.map(l => 
        `<div>• ${l.account_name} (${l.account_code}): مدين ${parseFloat(l.debit).toLocaleString()} | دائن ${parseFloat(l.credit).toLocaleString()}</div>`
      ).join('') : '';

      return `
        <tr>
          <td><strong>${m.name}</strong></td>
          <td>${new Date(m.date).toLocaleDateString('ar-EG')}</td>
          <td>${m.ref || '—'}</td>
          <td>${m.journal_name}</td>
          <td><strong>${parseFloat(m.total_amount).toLocaleString()} د.ع</strong></td>
          <td style="font-size:0.8rem; color:#94a3b8;">${linesSummary}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('خطأ في جلب القيود:', err);
  }
}

// ===============================
// 5) إنشاء قيد جديد (New Balanced Move)
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
      <input type="text" class="form-control line-desc" placeholder="البيان" style="flex:2;" />
      <input type="number" class="form-control line-debit" placeholder="مدين" style="flex:1;" oninput="calcMoveBalance()" />
      <input type="number" class="form-control line-credit" placeholder="دائن" style="flex:1;" oninput="calcMoveBalance()" />
    </div>
    <div class="move-line-row" style="display: flex; gap: 8px; margin-bottom: 8px;">
      <select class="form-control account-select-line" style="flex:2;"></select>
      <input type="text" class="form-control line-desc" placeholder="البيان" style="flex:2;" />
      <input type="number" class="form-control line-debit" placeholder="مدين" style="flex:1;" oninput="calcMoveBalance()" />
      <input type="number" class="form-control line-credit" placeholder="دائن" style="flex:1;" oninput="calcMoveBalance()" />
    </div>
  `;
  populateAccountSelects();
  calcMoveBalance();
};

window.addMoveLine = function() {
  const container = document.getElementById('moveLinesContainer');
  const div = document.createElement('div');
  div.className = 'move-line-row';
  div.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px;';
  div.innerHTML = `
    <select class="form-control account-select-line" style="flex:2;"></select>
    <input type="text" class="form-control line-desc" placeholder="البيان" style="flex:2;" />
    <input type="number" class="form-control line-debit" placeholder="مدين" style="flex:1;" oninput="calcMoveBalance()" />
    <input type="number" class="form-control line-credit" placeholder="دائن" style="flex:1;" oninput="calcMoveBalance()" />
  `;
  container.appendChild(div);
  populateAccountSelects();
};

window.calcMoveBalance = function() {
  let totalDebit = 0;
  let totalCredit = 0;

  document.querySelectorAll('.line-debit').forEach(inp => totalDebit += parseFloat(inp.value || 0));
  document.querySelectorAll('.line-credit').forEach(inp => totalCredit += parseFloat(inp.value || 0));

  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const statusEl = document.getElementById('moveBalanceStatus');
  if (diff === 0 && totalDebit > 0) {
    statusEl.innerHTML = `<span style="color:#10b981;">✅ القيد متوازن: ${totalDebit.toLocaleString()} د.ع</span>`;
  } else {
    statusEl.innerHTML = `<span style="color:#f87171;">⚠️ غير متوازن (المدين: ${totalDebit.toLocaleString()} | الدائن: ${totalCredit.toLocaleString()}) الفارق: ${diff.toLocaleString()} د.ع</span>`;
  }
};

window.submitNewMove = async function() {
  const date = document.getElementById('newMoveDate').value;
  const journal_id = document.getElementById('newMoveJournal').value;
  const ref = document.getElementById('newMoveRef').value;

  const rows = document.querySelectorAll('.move-line-row');
  const lines = [];

  rows.forEach(r => {
    const account_id = r.querySelector('.account-select-line').value;
    const name = r.querySelector('.line-desc').value;
    const debit = parseFloat(r.querySelector('.line-debit').value || 0);
    const credit = parseFloat(r.querySelector('.line-credit').value || 0);

    if (debit > 0 || credit > 0) {
      lines.push({ account_id, name, debit, credit });
    }
  });

  if (lines.length < 2) {
    alert('يجب إدخال طرفين على الأقل للقيد المحاسبي');
    return;
  }

  try {
    const res = await fetch('/api/accounting/moves', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ date, journal_id, ref, lines })
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
// 6) تقرير الأرباح والخسائر (Profit & Loss)
// ===============================
async function loadProfitAndLoss() {
  try {
    const res = await fetch('/api/accounting/reports/profit-and-loss', {
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
// 7) الميزانية العمومية (Balance Sheet)
// ===============================
async function loadBalanceSheet() {
  try {
    const res = await fetch('/api/accounting/reports/balance-sheet', {
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
    `).join('') || '<div style="color:#94a3b8;">لا توجد خصوم مسجلة</div>';

    document.getElementById('bsTotalLiabilities').textContent = `${summary.totalLiabilities.toLocaleString()} د.ع`;

    document.getElementById('bsEquity').innerHTML = equity.map(eq => `
      <div class="statement-row">
        <span>${eq.name} (${eq.code})</span>
        <strong>${eq.balance.toLocaleString()} د.ع</strong>
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
// 8) ميزان المراجعة (Trial Balance)
// ===============================
async function loadTrialBalance() {
  try {
    const res = await fetch('/api/accounting/reports/trial-balance', {
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

// تسجيل الخروج
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
});

// بدء التشغيل
loadFinancialOverview();
loadChartOfAccounts();
loadJournals();
