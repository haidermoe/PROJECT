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
let selectedStationId = localStorage.getItem('kitchen_prep_selected_station') || 'all';

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
// 1) تحميل السكاشن والوصفات
// ===============================
async function initKitchenPrep() {
  try {
    // 1. جلب محطات وسكاشن المطبخ
    const resSt = await fetch('/api/pos-restaurant/stations', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataSt = await resSt.json();
    if (dataSt.status === 'success') {
      allStations = (dataSt.data || []).filter(s => s.station_type === 'kitchen' && s.is_active);

      // تعبئة قائمة فلترة السكاشن في قسم التحضير
      const prepFilter = document.getElementById('prepStationFilter');
      if (prepFilter) {
        prepFilter.innerHTML = '<option value="all">🌐 كل السكاشن (عرض كافة الوصفات)</option>' +
          allStations.map(s => `<option value="${s.id}">📍 [${s.station_code || 'ST'}] ${s.station_name}</option>`).join('');

        // استرجاع السكشن المحفوظ مسبقاً للشيف
        if (selectedStationId && (selectedStationId === 'all' || allStations.some(s => s.id === parseInt(selectedStationId)))) {
          prepFilter.value = selectedStationId;
        } else {
          selectedStationId = 'all';
          prepFilter.value = 'all';
        }
      }

      // تعبئة السكشن في تبويب الماسح
      const scanSel = document.getElementById('scanTargetStation');
      if (scanSel) {
        scanSel.innerHTML = allStations.map(s => `
          <option value="${s.id}">📍 [${s.station_code || 'ST'}] ${s.station_name}</option>
        `).join('');
      }

      // تحديث شارة السكشن الحالي
      updateStationBadge();
    }

    // 2. جلب جميع الوصفات مع السكاشن المسندة إليها
    await loadRecipesList();

  } catch (err) {
    console.error('خطأ في تهيئة التحضير والسكاشن:', err);
  }
}

async function loadRecipesList() {
  try {
    const resRec = await fetch('/api/recipes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const dataRec = await resRec.json();
    if (dataRec.status === 'success') {
      allRecipes = dataRec.data || [];
      renderRecipesDropdown();
    }
  } catch (err) {
    console.error('خطأ في تحميل الوصفات:', err);
  }
}

function updateStationBadge() {
  const badge = document.getElementById('currentStationBadge');
  if (!badge) return;

  if (selectedStationId === 'all') {
    badge.textContent = 'كل السكاشن (عرض الكل)';
    badge.style.background = 'rgba(56, 189, 248, 0.15)';
    badge.style.color = '#38bdf8';
    badge.style.borderColor = 'rgba(56, 189, 248, 0.3)';
  } else {
    const st = allStations.find(s => s.id === parseInt(selectedStationId));
    if (st) {
      badge.textContent = `📍 ${st.station_name}`;
      badge.style.background = 'rgba(0, 255, 136, 0.15)';
      badge.style.color = '#00ff88';
      badge.style.borderColor = 'rgba(0, 255, 136, 0.3)';
    }
  }
}

window.onStationFilterChanged = function() {
  const filterEl = document.getElementById('prepStationFilter');
  selectedStationId = filterEl ? filterEl.value : 'all';
  localStorage.setItem('kitchen_prep_selected_station', selectedStationId);

  updateStationBadge();
  renderRecipesDropdown();

  // تصفير الخطة وحساب المقادير عند تغيير السكشن
  const container = document.getElementById('ingredientsCheckContainer');
  if (container) container.style.display = 'none';
  const statusMsg = document.getElementById('planStatusMsg');
  if (statusMsg) statusMsg.innerHTML = '';
  const labelsCard = document.getElementById('labelsPrintCard');
  if (labelsCard) labelsCard.style.display = 'none';
};

function renderRecipesDropdown() {
  const sel = document.getElementById('prepRecipeSelect');
  if (!sel) return;

  const currentVal = parseInt(sel.value);
  let filtered = allRecipes;

  if (selectedStationId !== 'all') {
    const targetStId = parseInt(selectedStationId);
    filtered = allRecipes.filter(r => r.station_id === targetStId);
  }

  if (filtered.length === 0) {
    sel.innerHTML = '<option value="">-- لا توجد وصفات مسندة لهذا السكشن حالياً (اضغط "تخصيص وتوزيع وصفات السكاشن" أعلاه) --</option>';
    return;
  }

  const stObj = allStations.find(s => s.id === parseInt(selectedStationId));
  const stLabel = stObj ? stObj.station_name.split('(')[0].trim() : 'كل السكاشن';

  sel.innerHTML = `<option value="">-- اختر الوصفة من كروت ${stLabel} (${filtered.length} صنف متاح) --</option>` +
    filtered.map(r => {
      const sName = r.station_name ? r.station_name.split('(')[0].trim() : 'غير محدد';
      return `<option value="${r.id}">[${sName}] ${r.item_name || r.name} (أساس: ${r.portions || 1} ${r.yield || 'وجبة'})</option>`;
    }).join('');

  // إذا كانت الوصفة المختارة مسبقاً لا تزال ضمن القائمة المفلترة، احتفظ بها
  if (currentVal && filtered.some(r => r.id === currentVal)) {
    sel.value = currentVal;
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

  const selectedStationFilter = document.getElementById('prepStationFilter')?.value;
  const currentRecipeObj = allRecipes.find(r => r.id === recipeId);
  const stationId = (selectedStationFilter && selectedStationFilter !== 'all')
    ? parseInt(selectedStationFilter)
    : (currentRecipeObj ? currentRecipeObj.station_id : null);

  try {
    const res = await fetch('/api/kitchen-ops/prep/produce', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        recipe_id: recipeId,
        station_id: stationId,
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

// ======================================================
// 5) نافذة تخصيص وتوزيع الوصفات على السكاشن (Modal Logic)
// ======================================================
window.openStationCustomizerModal = function() {
  const modal = document.getElementById('stationCustomizerModal');
  if (!modal) return;

  // تعبئة قائمة فلترة السكاشن داخل المودال
  const filterSel = document.getElementById('customizerStationFilter');
  if (filterSel) {
    filterSel.innerHTML = '<option value="all">🌐 جميع السكاشن</option>' +
      allStations.map(s => `<option value="${s.id}">📍 ${s.station_name}</option>`).join('') +
      '<option value="unassigned">⚠️ وصفات غير مسندة لسكشن</option>';
  }

  // تفريغ حقل البحث
  const searchInput = document.getElementById('customizerSearchInput');
  if (searchInput) searchInput.value = '';

  renderCustomizerTable();
  modal.style.display = 'flex';
};

window.closeStationCustomizerModal = function() {
  const modal = document.getElementById('stationCustomizerModal');
  if (modal) modal.style.display = 'none';
};

function renderCustomizerTable() {
  const tbody = document.getElementById('customizerTableBody');
  if (!tbody) return;

  const searchKeyword = (document.getElementById('customizerSearchInput')?.value || '').trim().toLowerCase();
  const stationFilterVal = document.getElementById('customizerStationFilter')?.value || 'all';

  let list = allRecipes;

  if (searchKeyword) {
    list = list.filter(r => (r.item_name || r.name || '').toLowerCase().includes(searchKeyword));
  }

  if (stationFilterVal !== 'all') {
    if (stationFilterVal === 'unassigned') {
      list = list.filter(r => !r.station_id);
    } else {
      const targetId = parseInt(stationFilterVal);
      list = list.filter(r => r.station_id === targetId);
    }
  }

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#94a3b8; padding:24px;">لا توجد وصفات تطابق خيارات البحث</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const optionsHtml = [
      '<option value="">-- غير مسند لسكشن --</option>',
      ...allStations.map(s => `<option value="${s.id}" ${r.station_id === s.id ? 'selected' : ''}>📍 [${s.station_code || 'ST'}] ${s.station_name}</option>`)
    ].join('');

    return `
      <tr>
        <td>
          <strong style="color:#f8fafc; font-size:0.95rem;">${r.item_name || r.name}</strong>
        </td>
        <td style="color:#38bdf8; font-weight:600;">
          ${r.portions || 1} ${r.yield || 'وجبة'}
        </td>
        <td>
          <select class="customizer-station-select" data-recipe-id="${r.id}">
            ${optionsHtml}
          </select>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterCustomizerList = function() {
  renderCustomizerTable();
};

window.saveStationAssignments = async function() {
  const saveBtn = document.getElementById('btnSaveAssignments');
  const selects = document.querySelectorAll('.customizer-station-select');

  const assignments = Array.from(selects).map(sel => ({
    recipe_id: parseInt(sel.dataset.recipeId),
    station_id: sel.value ? parseInt(sel.value) : null
  }));

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span>⏳ جاري الحفظ...</span>';
  }

  try {
    const res = await fetch('/api/recipes/batch-assign-stations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ assignments })
    });

    const result = await res.json();
    if (result.status !== 'success') {
      throw new Error(result.message || 'فشل حفظ توزيع الوصفات');
    }

    alert('✅ تم حفظ وتحديث توزيع وصفات السكاشن بنجاح! سيتم تطبيقها فوراً.');

    // إعادة تحميل الوصفات لتحديث القوائم والشارات
    await loadRecipesList();
    closeStationCustomizerModal();

  } catch (err) {
    console.error('خطأ في حفظ السكاشن:', err);
    alert(`❌ خطأ: ${err.message}`);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<span>💾 حفظ التوزيع واعتماد السكاشن</span>';
    }
  }
};

// بدء التشغيل
initKitchenPrep();

