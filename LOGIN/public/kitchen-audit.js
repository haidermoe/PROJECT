/**
 * ============================================================================
 * Kitchen Audit & Station Reconciliation - Frontend Logic
 * ============================================================================
 */

const token = localStorage.getItem('token');
if (!token) {
  alert('يجب تسجيل الدخول أولاً');
  window.location.href = '/index.html';
}

const user = JSON.parse(localStorage.getItem('user') || '{}');
let allStations = [];
let currentAuditData = null;

// ===============================
// 1) تهيئة الشاشة
// ===============================
async function initKitchenAudit() {
  document.getElementById('auditDateInput').value = new Date().toISOString().split('T')[0];

  try {
    const resSt = await fetch('/api/pos-restaurant/stations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataSt = await resSt.json();
    if (dataSt.status === 'success') {
      allStations = (dataSt.data || []).filter(s => s.station_type === 'kitchen');
      const sel = document.getElementById('auditStationSelect');
      sel.innerHTML = allStations.map(s => `
        <option value="${s.id}">📍 [${s.station_code || 'ST'}] ${s.station_name}</option>
      `).join('');

      // إذا كان المستخدم شيف سكشن مسند إليه، نختاره افتراضياً
      if (allStations.length > 0) {
        loadStationAudit();
      }
    }
  } catch (err) {
    console.error('خطأ في تهيئة السكاشن:', err);
  }
}

// ===============================
// 2) جلب كشف المطابقة لسكشن محدد
// ===============================
window.loadStationAudit = async function() {
  const stationId = document.getElementById('auditStationSelect').value;
  const date = document.getElementById('auditDateInput').value;
  if (!stationId) return;

  const tbody = document.getElementById('auditTableBody');
  tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:30px; color:#94a3b8;">جاري احتساب ومطابقة رصيد السكشن ومبيعات الويترية...</td></tr>`;

  try {
    const res = await fetch(`/api/kitchen-ops/audit/summary?station_id=${stationId}&date=${date}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#f87171; padding:20px;">خطأ: ${result.message}</td></tr>`;
      return;
    }

    currentAuditData = result.data;
    renderAuditTable(result.data.items);
  } catch (err) {
    console.error('خطأ في جلب كشف المطابقة:', err);
  }
};

function renderAuditTable(items) {
  const tbody = document.getElementById('auditTableBody');
  if (!items || items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:30px;">لا توجد أي حركات أو مواد مسجلة لهذا السكشن في هذا اليوم</td></tr>`;
    updateOverallBadge(true);
    return;
  }

  tbody.innerHTML = items.map((item, index) => {
    const hasWaiters = item.waiterBreakdown && item.waiterBreakdown.length > 0;
    const waiterBtn = hasWaiters 
      ? `<button type="button" class="btn-waiter-info" onclick="openWaiterModal(${item.ingredientId})">🔍 تفصيل مبيعات (${item.waiterBreakdown.length}) ويتر</button>`
      : `<span style="color:#64748b; font-size:0.8rem;">لا توجد مبيعات</span>`;

    return `
      <tr id="audit-row-${index}" class="row-matched">
        <td>
          <strong style="font-size:1rem; color:#f8fafc;">${item.name}</strong>
          <span style="font-size:0.75rem; color:#94a3b8; display:block;">(${item.unit})</span>
        </td>
        <td>${item.openingQty} ${item.unit}</td>
        <td style="color:#10b981; font-weight:bold;">+${item.transferredInQty}</td>
        <td>
          <div style="display:flex; flex-direction:column; gap: 4px;">
            <span style="color:#ef4444; font-weight:bold;">-${item.consumedQty} ${item.unit}</span>
            ${waiterBtn}
          </div>
        </td>
        <td style="color:#f59e0b;">-${item.wasteQty}</td>
        <td style="color:#38bdf8; font-weight:bold; font-size:1.1rem;">
          <span id="theo-val-${index}">${item.theoreticalQty}</span> ${item.unit}
        </td>
        <td>
          <input type="number" step="0.01" class="actual-input matched" id="actual-input-${index}" 
                 value="${item.actualQty}" oninput="onActualQtyChange(${index})" />
        </td>
        <td id="status-cell-${index}">
          <span class="variance-pill pill-matched">✅ متطابق</span>
        </td>
        <td>
          <input type="text" class="explanation-input" id="explanation-${index}" 
                 placeholder="اكتب التبرير في حال وجود فرق (انسكاب، تلف، زيادة)..." style="display:none;" />
        </td>
      </tr>
    `;
  }).join('');

  checkAllMatches();
}

// ===============================
// 3) التحقق اللحظي من الفارق والتلوين
// ===============================
window.onActualQtyChange = function(index) {
  const item = currentAuditData.items[index];
  const theo = parseFloat(document.getElementById(`theo-val-${index}`).textContent) || 0;
  const actualInput = document.getElementById(`actual-input-${index}`);
  const statusCell = document.getElementById(`status-cell-${index}`);
  const explanationInput = document.getElementById(`explanation-${index}`);
  const row = document.getElementById(`audit-row-${index}`);

  const actualVal = parseFloat(actualInput.value);
  const diff = isNaN(actualVal) ? 0 : parseFloat((actualVal - theo).toFixed(3));
  const isMatched = Math.abs(diff) < 0.001;

  item.actualQty = actualVal;
  item.isMatched = isMatched;

  if (isMatched) {
    row.className = 'row-matched';
    actualInput.className = 'actual-input matched';
    statusCell.innerHTML = `<span class="variance-pill pill-matched">✅ متطابق</span>`;
    explanationInput.style.display = 'none';
    explanationInput.value = '';
  } else {
    row.className = 'row-variance';
    actualInput.className = 'actual-input variance';
    const diffSign = diff > 0 ? `+${diff}` : `${diff}`;
    statusCell.innerHTML = `<span class="variance-pill pill-variance">⚠️ فارق: ${diffSign} ${item.unit}</span>`;
    explanationInput.style.display = 'block';
    explanationInput.focus();
  }

  checkAllMatches();
};

function checkAllMatches() {
  if (!currentAuditData || !currentAuditData.items) return;
  const hasVariance = currentAuditData.items.some(i => !i.isMatched);
  updateOverallBadge(!hasVariance);
}

function updateOverallBadge(isAllMatched) {
  const badge = document.getElementById('auditOverallStatusBadge');
  if (!badge) return;

  if (isAllMatched) {
    badge.style.background = 'rgba(16, 185, 129, 0.2)';
    badge.style.color = '#34d399';
    badge.innerHTML = '✅ كافة بنود السكشن متطابقة 100%';
  } else {
    badge.style.background = 'rgba(239, 68, 68, 0.2)';
    badge.style.color = '#f87171';
    badge.innerHTML = '⚠️ توجد فروقات بين الرصيد المفروض والفعلي';
  }
}

// ===============================
// 4) نافذة تفصيل مبيعات الويترية
// ===============================
window.openWaiterModal = function(ingredientId) {
  const item = currentAuditData.items.find(i => i.ingredientId === ingredientId);
  if (!item) return;

  document.getElementById('waiterModalTitle').textContent = `🍽️ تفصيل مبيعات الويترية لمادة: [ ${item.name} ]`;
  document.getElementById('waiterModalSub').textContent = `تتبع الوجبات التي طلبها الويترية بالصالة واستهلكت من عهدة هذا السكشن اليوم (المجموع: ${item.consumedQty} ${item.unit}):`;

  const tbody = document.getElementById('waiterTableBody');
  if (!item.waiterBreakdown || item.waiterBreakdown.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">لا توجد تفاصيل متوفرة</td></tr>`;
  } else {
    tbody.innerHTML = item.waiterBreakdown.map(w => `
      <tr>
        <td><strong style="color:#f8fafc;">👔 ${w.waiterName}</strong></td>
        <td><span style="color:#38bdf8;">🍳 ${w.itemName}</span></td>
        <td style="font-weight:bold;">${w.ordersCount} طلب</td>
        <td style="color:#ef4444; font-weight:bold;">${w.consumedQty} ${item.unit}</td>
      </tr>
    `).join('');
  }

  document.getElementById('waiterBreakdownModal').classList.add('active');
};

window.closeWaiterModal = function() {
  document.getElementById('waiterBreakdownModal').classList.remove('active');
};

// ===============================
// 5) اعتماد وإرسال كشف الجرد
// ===============================
window.submitAudit = async function() {
  if (!currentAuditData || !currentAuditData.items || currentAuditData.items.length === 0) {
    alert('لا توجد بيانات جرد لإرسالها');
    return;
  }

  const stationId = document.getElementById('auditStationSelect').value;
  const auditDate = document.getElementById('auditDateInput').value;
  const shiftName = document.getElementById('auditShiftName').value;

  // فحص هل توجد فروقات بدون تبرير
  let missingExplanation = false;
  const linesPayload = currentAuditData.items.map((item, index) => {
    const expEl = document.getElementById(`explanation-${index}`);
    const explanation = expEl ? expEl.value.trim() : '';

    if (!item.isMatched && !explanation) {
      missingExplanation = true;
    }

    return {
      ingredient_id: item.ingredientId,
      name: item.name,
      opening_qty: item.openingQty,
      transferred_in_qty: item.transferredInQty,
      consumed_qty: item.consumedQty,
      waste_qty: item.wasteQty,
      theoretical_qty: item.theoreticalQty,
      actual_qty: item.actualQty,
      is_matched: item.isMatched ? 1 : 0,
      chef_explanation: explanation,
      waiterBreakdown: item.waiterBreakdown
    };
  });

  if (missingExplanation) {
    alert('⚠️ توجد أصناف بها فروقات بين الرصيد المفروض والفعلي بدون كتابة تبرير الشيف! يرجى توضيح سبب الفرق قبل الإرسال.');
    return;
  }

  if (!confirm('هل تؤكد اعتماد كشف الجرد وإرساله لمدير المطبخ؟')) {
    return;
  }

  try {
    const res = await fetch('/api/kitchen-ops/audit/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        station_id: parseInt(stationId),
        audit_date: auditDate,
        shift_name: shiftName,
        lines: linesPayload
      })
    });

    const result = await res.json();
    if (result.status !== 'success') {
      alert(`خطأ: ${result.message}`);
      return;
    }

    alert(result.message);
    loadStationAudit();
  } catch (err) {
    console.error('خطأ في إرسال الجرد:', err);
    alert('حدث خطأ أثناء حفظ الجرد');
  }
};

// بدء التشغيل
initKitchenAudit();
