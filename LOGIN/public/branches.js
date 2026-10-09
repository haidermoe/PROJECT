/**
 * ======================================================
 * Branches & Inter-Branch Logistics Frontend Logic
 * Multi-Company Consolidation (Odoo Standard)
 * ======================================================
 */

const token = localStorage.getItem('token');
if (!token) {
  alert('يجب تسجيل الدخول أولاً للوصول للنظام');
  window.location.href = '/index.html';
}

let allBranches = [];
let sourceIngredients = [];

// ===============================
// 1) تبديل التبويبات
// ===============================
window.switchBranchTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

  const btn = document.getElementById(`tab-btn-${tabId}`);
  const panel = document.getElementById(`panel-${tabId}`);
  if (btn) btn.classList.add('active');
  if (panel) panel.classList.add('active');

  if (tabId === 'branches') loadBranches();
  else if (tabId === 'transfers') loadTransfers();
  else if (tabId === 'consolidation') loadConsolidationPerformance();
};

// ===============================
// 2) جلب المؤشرات الموحدة للشركة القابضة
// ===============================
async function loadConsolidatedKPIs() {
  try {
    const res = await fetch('/api/branches/consolidated-overview', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') return;

    const data = result.data;
    document.getElementById('kpiTotalBranches').textContent = data.branchesCount || 0;
    document.getElementById('kpiConsolidatedSales').textContent = `${parseFloat(data.totalSalesToday || 0).toLocaleString()} د.ع`;
    document.getElementById('kpiConsolidatedNet').textContent = `${parseFloat(data.totalNetProfitMonth || 0).toLocaleString()} د.ع`;
    document.getElementById('kpiTransfersInTransit').textContent = data.inTransitTransfers || 0;
    
    const margin = data.totalSalesMonth > 0 
      ? ((data.totalNetProfitMonth / data.totalSalesMonth) * 100).toFixed(1) 
      : 0;
    document.getElementById('kpiNetMarginSub').textContent = `هامش الربح العام الموحد: ${margin}%`;
  } catch (err) {
    console.error('خطأ في جلب مؤشرات الفروع:', err);
  }
}

// ===============================
// 3) جلب قائمة الفروع وبناء البطاقات
// ===============================
async function loadBranches() {
  try {
    const res = await fetch('/api/branches', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    allBranches = result.data;
    renderBranchesGrid(allBranches);
    populateTransferBranchSelects(allBranches);
  } catch (err) {
    console.error('خطأ في جلب الفروع:', err);
  }
}

function renderBranchesGrid(branches) {
  const container = document.getElementById('branchesGrid');
  if (!container) return;

  if (branches.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px; color:#94a3b8;">لا توجد فروع مسجلة حتى الآن</div>`;
    return;
  }

  container.innerHTML = branches.map(b => {
    const isCentral = b.type === 'central_kitchen' || b.type === 'warehouse';
    const badgeClass = isCentral ? 'badge-central' : 'badge-branch';
    const typeLabel = b.type === 'central_kitchen' ? 'مطبخ مركزي 👨‍🍳' : (b.type === 'warehouse' ? 'مستودع رئيسي 📦' : 'فرع مطعم وصالة 🍽️');

    return `
      <div class="branch-card">
        <div class="branch-header">
          <div>
            <div class="branch-name">${b.name}</div>
            <span class="branch-code">${b.code}</span>
          </div>
          <span class="branch-badge ${badgeClass}">${typeLabel}</span>
        </div>

        <div class="branch-metrics">
          <div class="metric-item">
            <span class="metric-label">مبيعات اليوم:</span>
            <span class="metric-val" style="color:#10b981;">${parseFloat(b.todaySales || 0).toLocaleString()} د.ع</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">أصناف المواد بالمخزن:</span>
            <span class="metric-val" style="color:#38bdf8;">${b.inventoryCount || 0} صنف</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">محطات الطبخ النشطة:</span>
            <span class="metric-val">${b.stationsCount || 0}</span>
          </div>
          <div class="metric-item">
            <span class="metric-label">طاولات الصالة:</span>
            <span class="metric-val">${b.tablesCount || 0}</span>
          </div>
        </div>

        <div class="branch-meta">
          <div>📍 <strong>المدينة/العنوان:</strong> ${b.city || 'بغداد'} ${b.address ? `- ${b.address}` : ''}</div>
          ${b.phone ? `<div>📞 <strong>الهاتف:</strong> ${b.phone}</div>` : ''}
        </div>

        <div class="branch-actions">
          <button class="btn-secondary" style="flex:1;" onclick="editBranch(${b.id})">
            ✏️ تعديل البيانات
          </button>
          <button class="btn-primary" style="flex:1;" onclick="quickTransferFrom(${b.id})">
            🚚 إرسال شحنة
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ===============================
// 4) جلب سجل المناقلات المخزنية
// ===============================
async function loadTransfers() {
  try {
    const res = await fetch('/api/branches/transfers/list', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    renderTransfersTable(result.data);
  } catch (err) {
    console.error('خطأ في جلب المناقلات:', err);
  }
}

function renderTransfersTable(transfers) {
  const tbody = document.getElementById('transfersTableBody');
  if (!tbody) return;

  if (transfers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:#94a3b8;">لا توجد أي شحنات أو مناقلات مسجلة</td></tr>`;
    return;
  }

  tbody.innerHTML = transfers.map(t => {
    const isTransit = t.status === 'in_transit';
    const statusPill = isTransit 
      ? `<span class="status-pill status-in-transit">🚚 في الطريق (In Transit)</span>`
      : `<span class="status-pill status-received">✅ تم الاستلام (Received)</span>`;

    const actionBtn = isTransit 
      ? `<button class="btn-primary" style="padding: 4px 10px; font-size:0.8rem; background:#10b981;" onclick="confirmReceiveTransfer(${t.id}, '${t.ingredient_name}', ${t.quantity}, '${t.to_branch_name}')">📥 تأكيد الاستلام</button>`
      : `<span style="color:#64748b; font-size:0.8rem;">مكتملة</span>`;

    const sendDate = t.dispatched_at ? new Date(t.dispatched_at).toLocaleString('ar-IQ') : '--';
    const receiveDate = t.received_at ? new Date(t.received_at).toLocaleString('ar-IQ') : '--';

    return `
      <tr>
        <td><strong>#TR-${t.id}</strong></td>
        <td>🏢 ${t.from_branch_name} (${t.from_branch_code})</td>
        <td>🏬 ${t.to_branch_name} (${t.to_branch_code})</td>
        <td><strong style="color:#f8fafc;">${t.ingredient_name}</strong></td>
        <td style="color:#38bdf8; font-weight:bold;">${parseFloat(t.quantity).toLocaleString()} ${t.unit}</td>
        <td>${statusPill}</td>
        <td>${sendDate}</td>
        <td>${t.sender_name || 'مدير المستودع'}</td>
        <td>${receiveDate}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

// تأكيد استلام الشحنة وتحديث مخزن الفرع المستلم
window.confirmReceiveTransfer = async function(transferId, ingName, qty, toBranchName) {
  if (!confirm(`هل تؤكد وصول واستلام الشحنة (${qty} من ${ingName}) في ${toBranchName}؟ سيتم إضافة الكمية إلى رصيد مخزن الفرع تلقائياً.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/branches/transfers/${transferId}/receive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ notes: 'تم الفحص والتطابق والاستلام في مخزن الفرع' })
    });
    const result = await res.json();
    if (result.status !== 'success') {
      alert(`خطأ: ${result.message}`);
      return;
    }

    alert('✅ تم تأكيد استلام الشحنة وترحيل الرصيد لمخزن الفرع بنجاح!');
    loadTransfers();
    loadConsolidatedKPIs();
    loadBranches();
  } catch (err) {
    console.error('خطأ في استلام الشحنة:', err);
    alert('حدث خطأ أثناء الاتصال بالخادم');
  }
};

// ===============================
// 5) جلب الأداء والمقارنة المالية الموحدة
// ===============================
async function loadConsolidationPerformance() {
  try {
    const res = await fetch('/api/accounting/reports/branch-comparison', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    const { branches, totalHoldingRevenue, totalHoldingNetProfit } = result.data;
    const tbody = document.getElementById('consolidationTableBody');
    if (!tbody) return;

    if (branches.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:30px; color:#94a3b8;">لا تتوفر بيانات مالية حالياً</td></tr>`;
      return;
    }

    tbody.innerHTML = branches.map(b => {
      const marginColor = b.profitMargin >= 20 ? '#10b981' : (b.profitMargin >= 0 ? '#38bdf8' : '#f87171');
      const netColor = b.netProfit >= 0 ? '#10b981' : '#f87171';

      return `
        <tr>
          <td><strong class="branch-code">${b.code}</strong></td>
          <td><strong>${b.name}</strong></td>
          <td>${b.city || 'بغداد'}</td>
          <td style="color:#10b981; font-weight:600;">${b.revenue.toLocaleString()} د.ع</td>
          <td style="color:#f87171;">${b.cogs.toLocaleString()} د.ع</td>
          <td style="color:#38bdf8; font-weight:600;">${b.grossProfit.toLocaleString()} د.ع</td>
          <td style="color:#f87171;">${b.operatingExpenses.toLocaleString()} د.ع</td>
          <td style="color:${netColor}; font-weight:bold; font-size:1rem;">${b.netProfit.toLocaleString()} د.ع</td>
          <td style="color:${marginColor}; font-weight:bold;">${b.profitMargin}%</td>
          <td>
            <div style="display:flex; align-items:center; gap: 8px;">
              <span style="font-weight:600; color:#c084fc;">${b.contributionPercentage}%</span>
              <div style="flex:1; background:#0f172a; height:6px; border-radius:3px; overflow:hidden; min-width:60px;">
                <div style="width:${Math.max(0, Math.min(100, b.contributionPercentage))}%; background:#8b5cf6; height:100%;"></div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // إضافة سطر الإجمالي الموحد للمجموعة القابضة
    tbody.innerHTML += `
      <tr style="background:#172033; font-weight:bold; border-top:2px solid #3b82f6;">
        <td colspan="3" style="color:#38bdf8;">🌐 المجموع الموحد لكافة شركات وفروع المجموعة:</td>
        <td style="color:#10b981;">${totalHoldingRevenue.toLocaleString()} د.ع</td>
        <td colspan="3"></td>
        <td style="color:#10b981; font-size:1.05rem;">${totalHoldingNetProfit.toLocaleString()} د.ع</td>
        <td></td>
        <td style="color:#c084fc;">100%</td>
      </tr>
    `;
  } catch (err) {
    console.error('خطأ في جلب تقرير الأداء الموحد:', err);
  }
}

// ===============================
// 6) النوافذ المنبثقة (Modals)
// ===============================

// نافذة الفرع
window.openBranchModal = function(branch = null) {
  const modal = document.getElementById('branchModal');
  const title = document.getElementById('branchModalTitle');
  document.getElementById('branchIdField').value = branch ? branch.id : '';
  document.getElementById('branchNameField').value = branch ? branch.name : '';
  document.getElementById('branchCodeField').value = branch ? branch.code : '';
  document.getElementById('branchTypeField').value = branch ? branch.type : 'branch';
  document.getElementById('branchCityField').value = branch ? (branch.city || '') : '';
  document.getElementById('branchAddressField').value = branch ? (branch.address || '') : '';
  document.getElementById('branchPhoneField').value = branch ? (branch.phone || '') : '';
  document.getElementById('branchEmailField').value = branch ? (branch.email || '') : '';

  title.textContent = branch ? `✏️ تعديل بيانات الفرع: ${branch.name}` : '➕ إضافة فرع أو مطبخ مركزي جديد';
  modal.classList.add('active');
};

window.closeBranchModal = function() {
  document.getElementById('branchModal').classList.remove('active');
};

window.editBranch = function(id) {
  const b = allBranches.find(item => item.id === id);
  if (b) openBranchModal(b);
};

window.submitBranch = async function() {
  const id = document.getElementById('branchIdField').value;
  const name = document.getElementById('branchNameField').value.trim();
  const code = document.getElementById('branchCodeField').value.trim();
  const type = document.getElementById('branchTypeField').value;
  const city = document.getElementById('branchCityField').value.trim();
  const address = document.getElementById('branchAddressField').value.trim();
  const phone = document.getElementById('branchPhoneField').value.trim();
  const email = document.getElementById('branchEmailField').value.trim();

  if (!name || !code) {
    alert('يرجى إدخال اسم الفرع وكود الفرع');
    return;
  }

  const payload = { name, code, type, city, address, phone, email };

  try {
    const url = id ? `/api/branches/${id}` : '/api/branches';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.status !== 'success') {
      alert(`خطأ: ${result.message}`);
      return;
    }

    alert('✅ تم حفظ بيانات الفرع بنجاح!');
    closeBranchModal();
    loadBranches();
    loadConsolidatedKPIs();
  } catch (err) {
    console.error('خطأ في حفظ الفرع:', err);
    alert('حدث خطأ أثناء حفظ الفرع');
  }
};

// نافذة المناقلة بين الفروع
function populateTransferBranchSelects(branches) {
  const fromSel = document.getElementById('transferFromBranch');
  const toSel = document.getElementById('transferToBranch');
  if (!fromSel || !toSel) return;

  const options = branches.map(b => `<option value="${b.id}">${b.name} (${b.code})</option>`).join('');
  fromSel.innerHTML = options;
  toSel.innerHTML = options;

  if (branches.length > 1) {
    toSel.selectedIndex = 1; // اختيار الفرع الثاني افتراضياً كوجهة
  }
}

window.openTransferModal = async function() {
  if (allBranches.length < 2) {
    alert('يجب وجود فرعين على الأقل لإجراء مناقلة لوجستية مخزنية');
    return;
  }
  document.getElementById('transferModal').classList.add('active');
  await onSourceBranchChange();
};

window.closeTransferModal = function() {
  document.getElementById('transferModal').classList.remove('active');
};

window.quickTransferFrom = function(sourceBranchId) {
  openTransferModal().then(() => {
    const fromSel = document.getElementById('transferFromBranch');
    if (fromSel) {
      fromSel.value = sourceBranchId;
      onSourceBranchChange();
    }
  });
};

// عند تغيير الفرع المصدر نجلب مواده المخزنية
window.onSourceBranchChange = async function() {
  const sourceBranchId = document.getElementById('transferFromBranch').value;
  const ingSel = document.getElementById('transferIngredient');
  const notice = document.getElementById('sourceStockNotice');
  const unitDisp = document.getElementById('transferUnitDisplay');

  ingSel.innerHTML = `<option value="">-- جاري تحميل مخزون الفرع... --</option>`;
  notice.textContent = `الرصيد المتاح: --`;
  unitDisp.value = '';

  try {
    const res = await fetch(`/api/inventory/items?branch_id=${sourceBranchId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') return;

    sourceIngredients = result.data || [];
    if (sourceIngredients.length === 0) {
      ingSel.innerHTML = `<option value="">⚠️ لا توجد مواد في مخزن هذا الفرع</option>`;
      return;
    }

    ingSel.innerHTML = `<option value="">-- اختر مادة من المخزن (${sourceIngredients.length} مادة متوفرة) --</option>` +
      sourceIngredients.map(i => `
        <option value="${i.id}">
          ${i.name} (المتاح: ${parseFloat(i.stock_quantity || 0).toLocaleString()} ${i.unit}) [${i.material_type === 'manufactured' ? 'مادة مصنعة 🥫' : 'مادة خام 🌾'}]
        </option>
      `).join('');
  } catch (err) {
    console.error('خطأ في جلب مخزون الفرع المصدر:', err);
    ingSel.innerHTML = `<option value="">خطأ في تحميل المواد</option>`;
  }
};

window.onIngredientChange = function() {
  const ingId = parseInt(document.getElementById('transferIngredient').value);
  const selected = sourceIngredients.find(i => i.id === ingId);
  const notice = document.getElementById('sourceStockNotice');
  const unitDisp = document.getElementById('transferUnitDisplay');

  if (selected) {
    notice.innerHTML = `الرصيد المتاح في مخزن المصدر: <strong>${parseFloat(selected.stock_quantity || 0).toLocaleString()} ${selected.unit}</strong>`;
    unitDisp.value = selected.unit || '';
  } else {
    notice.textContent = `الرصيد المتاح: --`;
    unitDisp.value = '';
  }
};

window.submitInterBranchTransfer = async function() {
  const fromBranchId = parseInt(document.getElementById('transferFromBranch').value);
  const toBranchId = parseInt(document.getElementById('transferToBranch').value);
  const ingredientId = parseInt(document.getElementById('transferIngredient').value);
  const quantity = parseFloat(document.getElementById('transferQuantity').value);
  const notes = document.getElementById('transferNotes').value.trim();

  if (fromBranchId === toBranchId) {
    alert('لا يمكن إجراء مناقلة بين نفس الفرع! يرجى اختيار فرع وجهة مختلف.');
    return;
  }
  if (!ingredientId) {
    alert('يرجى اختيار المادة المراد تحويلها');
    return;
  }
  if (!quantity || quantity <= 0) {
    alert('يرجى إدخال كمية صحيحة أكبر من الصفر');
    return;
  }

  const selected = sourceIngredients.find(i => i.id === ingredientId);
  if (selected && quantity > selected.stock_quantity) {
    alert(`الكمية المطلوبة (${quantity}) تتجاوز الرصيد المتوفر في مخزن المصدر (${selected.stock_quantity})!`);
    return;
  }

  const payload = {
    from_branch_id: fromBranchId,
    to_branch_id: toBranchId,
    ingredient_id: ingredientId,
    quantity,
    notes
  };

  try {
    const res = await fetch('/api/branches/transfers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.status !== 'success') {
      alert(`خطأ: ${result.message}`);
      return;
    }

    alert('🚀 تم إنشاء المناقلة وخصم الرصيد من مخزن المصدر بنجاح! الشحنة الآن في الطريق (In Transit) بانتظار استلام فرع الوجهة.');
    closeTransferModal();
    loadTransfers();
    loadConsolidatedKPIs();
    loadBranches();
  } catch (err) {
    console.error('خطأ في إنشاء المناقلة:', err);
    alert('حدث خطأ أثناء إنشاء المناقلة');
  }
};

// تسجيل الخروج
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
});

// بدء التحميل
loadConsolidatedKPIs();
loadBranches();
