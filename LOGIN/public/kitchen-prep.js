/**
 * ============================================================================
 * Kitchen Prep & Barcode Label Generator - Frontend Logic
 * ============================================================================
 */

const token = localStorage.getItem('token');
if (!token) {
  alert('يجب تسجيل الدخول أولاً');
  window.location.href = '/index.html';
}

let allRecipes = [];
let allStations = [];
let currentPlanData = null;
const scanHistory = [];

window.switchPrepTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));

  const btn = document.getElementById(`tab-btn-${tabId}`);
  const panel = document.getElementById(`panel-${tabId}`);
  if (btn) btn.classList.add('active');
  if (panel) panel.classList.add('active');

  if (tabId === 'scanner') {
    setTimeout(() => document.getElementById('barcodeScanInput')?.focus(), 200);
  }
};

// ===============================
// 1) تحميل الوصفات والسكاشن
// ===============================
async function initKitchenPrep() {
  try {
    // 1. جلب الوصفات
    const resRec = await fetch('/api/recipes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataRec = await resRec.json();
    if (dataRec.status === 'success') {
      allRecipes = dataRec.data || [];
      const sel = document.getElementById('prepRecipeSelect');
      sel.innerHTML = '<option value="">-- اختر الوصفة أو الصوص --</option>' +
        allRecipes.map(r => `<option value="${r.id}">${r.item_name || r.name} (حجم الأساس: ${r.portions || 1} ${r.yield || 'وجبة'})</option>`).join('');
    }

    // 2. جلب محطات وسكاشن المطبخ
    const resSt = await fetch('/api/pos-restaurant/stations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataSt = await resSt.json();
    if (dataSt.status === 'success') {
      allStations = (dataSt.data || []).filter(s => s.station_type === 'kitchen');
      const scanSel = document.getElementById('scanTargetStation');
      scanSel.innerHTML = allStations.map(s => `
        <option value="${s.id}">📍 [${s.station_code || 'ST'}] ${s.station_name}</option>
      `).join('');
    }
  } catch (err) {
    console.error('خطأ في تهيئة التحضير:', err);
  }
}

window.onRecipeSelected = function() {
  const recipeId = parseInt(document.getElementById('prepRecipeSelect').value);
  const recipe = allRecipes.find(r => r.id === recipeId);
  if (recipe) {
    document.getElementById('plannedPortionsInput').value = recipe.portions || 20;
    calculatePlan();
  }
};

// ===============================
// 2) احتساب مقادير المواد الخام المطلوبة
// ===============================
window.calculatePlan = async function() {
  const recipeId = document.getElementById('prepRecipeSelect').value;
  const portions = document.getElementById('plannedPortionsInput').value;
  const size = document.getElementById('portionSizeInput').value;

  if (!recipeId || !portions) return;

  try {
    const res = await fetch('/api/kitchen-ops/prep/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        recipe_id: parseInt(recipeId),
        planned_portions: parseInt(portions),
        portion_size: parseFloat(size)
      })
    });

    const result = await res.json();
    if (result.status !== 'success') {
      alert(`خطأ: ${result.message}`);
      return;
    }

    currentPlanData = result.data;
    renderIngredientsCheck(result.data);
  } catch (err) {
    console.error('خطأ في احتساب المقادير:', err);
  }
};

function renderIngredientsCheck(data) {
  const container = document.getElementById('ingredientsCheckContainer');
  const tbody = document.getElementById('ingredientsCheckTableBody');
  const statusMsg = document.getElementById('planStatusMsg');
  const confirmBtn = document.getElementById('confirmProduceBtn');

  container.style.display = 'block';

  tbody.innerHTML = data.items.map(item => {
    const statusPill = item.isShort
      ? `<span style="color:#f87171; font-weight:bold;">⚠️ رصيد غير كافٍ (ناقص ${item.shortageQty} ${item.unit})</span>`
      : `<span style="color:#10b981; font-weight:bold;">✅ متوفر بالمخزن</span>`;

    return `
      <tr>
        <td><strong>${item.name}</strong></td>
        <td style="color:#38bdf8; font-weight:bold;">${item.requiredQty} ${item.unit}</td>
        <td>${item.currentStock} ${item.unit}</td>
        <td>${statusPill}</td>
      </tr>
    `;
  }).join('');

  if (data.hasShortage) {
    statusMsg.innerHTML = `<span style="color:#f87171;">⚠️ توجد مواد خام غير كافية بالمخزن لتحضير هذه الكمية بالكامل</span>`;
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.5';
  } else {
    statusMsg.innerHTML = `<span style="color:#10b981;">✅ جميع المواد الخام متوفرة بالكامل في المخزن</span>`;
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
  }
}

// ===============================
// 3) تأكيد الإنتاج وتوليد باركودات العلب الفردية
// ===============================
window.confirmProduceBatch = async function() {
  const recipeId = parseInt(document.getElementById('prepRecipeSelect').value);
  const portions = parseInt(document.getElementById('plannedPortionsInput').value);
  const size = parseFloat(document.getElementById('portionSizeInput').value);
  const shelfLife = parseInt(document.getElementById('shelfLifeInput').value) || 7;

  if (!confirm(`هل تؤكد إنتاج دفعة تحضير (${portions} علبة) وخصم المواد الخام وتوليد الباركودات؟`)) {
    return;
  }

  try {
    const res = await fetch('/api/kitchen-ops/prep/produce', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        recipe_id: recipeId,
        planned_portions: portions,
        portion_size: size,
        shelf_life_days: shelfLife
      })
    });

    const result = await res.json();
    if (result.status !== 'success') {
      alert(`خطأ: ${result.message}`);
      return;
    }

    alert(`🎉 ${result.message}`);
    renderPrintableLabels(result.data);
  } catch (err) {
    console.error('خطأ في تأكيد الإنتاج:', err);
    alert('حدث خطأ أثناء الاتصال بالخادم');
  }
};

function renderPrintableLabels(batchData) {
  const card = document.getElementById('labelsPrintCard');
  const container = document.getElementById('labelsGridContainer');
  const summary = document.getElementById('labelsSummaryText');

  card.style.display = 'block';
  summary.textContent = `تم توليد (${batchData.portions} علبة) للدفعة #${batchData.batchNumber} - تاريخ الصلاحية: ${batchData.expiryDate}`;

  container.innerHTML = batchData.labels.map(lbl => `
    <div class="portion-label-card">
      <div class="label-header">${lbl.recipeName}</div>
      <div class="label-portion">بورشن: ${lbl.portionQty} ${lbl.unit} (علبة #${lbl.portionNumber} من ${batchData.portions})</div>
      <svg class="barcode-svg" id="barcode-${lbl.labelCode.replace(/[^a-zA-Z0-9]/g, '_')}"></svg>
      <div class="label-code-text">${lbl.labelCode}</div>
      <div class="label-dates">
        <span>تحضير: ${lbl.prepDate}</span>
        <span>صالح حتى: ${lbl.expiryDate}</span>
      </div>
    </div>
  `).join('');

  // رسم الباركود الحقيقي لكل علبة عبر JsBarcode
  setTimeout(() => {
    batchData.labels.forEach(lbl => {
      const elId = `barcode-${lbl.labelCode.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const svg = document.getElementById(elId);
      if (svg && window.JsBarcode) {
        JsBarcode(svg, lbl.labelCode, {
          format: "CODE128",
          width: 1.5,
          height: 45,
          displayValue: false,
          margin: 0
        });
      }
    });
  }, 100);

  card.scrollIntoView({ behavior: 'smooth' });
}

// ===============================
// 4) المسح السريع بالباركود ونقل العهدة للسكشن
// ===============================
window.handleScanKeyPress = function(e) {
  if (e.key === 'Enter') {
    processScan();
  }
};

window.processScan = async function() {
  const input = document.getElementById('barcodeScanInput');
  const stationId = parseInt(document.getElementById('scanTargetStation').value);
  const code = input.value.trim();
  const feedback = document.getElementById('scanFeedback');

  if (!code) {
    input.focus();
    return;
  }

  try {
    const res = await fetch('/api/kitchen-ops/scan/station-transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        label_code: code,
        station_id: stationId
      })
    });

    const result = await res.json();
    if (result.status !== 'success') {
      feedback.className = 'scan-feedback error';
      feedback.textContent = `❌ ${result.message}`;
      input.select();
      return;
    }

    feedback.className = 'scan-feedback success';
    feedback.textContent = result.message;

    // إضافة إلى سجل المسح
    scanHistory.unshift({
      code: result.data.labelCode,
      name: result.data.ingredientName,
      qty: result.data.portionQty,
      station: result.data.stationName,
      time: new Date().toLocaleTimeString('ar-IQ')
    });

    renderScanHistory();
    input.value = '';
    input.focus();
  } catch (err) {
    feedback.className = 'scan-feedback error';
    feedback.textContent = 'حدث خطأ في الاتصال بالماسح';
  }
};

function renderScanHistory() {
  const tbody = document.getElementById('scanHistoryTableBody');
  if (!tbody || scanHistory.length === 0) return;

  tbody.innerHTML = scanHistory.map(item => `
    <tr>
      <td><strong style="color:#38bdf8; font-family:monospace;">${item.code}</strong></td>
      <td><strong>${item.name}</strong></td>
      <td style="color:#10b981; font-weight:bold;">+${item.qty}</td>
      <td>${item.station}</td>
      <td style="color:#94a3b8;">${item.time}</td>
    </tr>
  `).join('');
}

// بدء التشغيل
initKitchenPrep();
