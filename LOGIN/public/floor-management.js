/**
 * ======================================================
 * Floor & Menu Management Logic - نظام إدارة الصالات والمنيو
 * مع المخطط التفاعلي 2D وتحليلات دوران وإشغال الطاولات
 * ======================================================
 */

const token = localStorage.getItem('token');
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

let allFloors = [];
let allTables = [];
let allMenu = [];
let allStations = [];
let allRecipes = [];
let allNotes = [];
let currentFloorId = null;
let isDesignerMode = false;

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof requireAuth !== 'undefined') {
    const authValid = await requireAuth();
    if (!authValid) return;
  }

  await loadFloorsAndTables();
  await loadMenuAndStations();
  await loadQuickNotes();
  await loadAnalytics();
});

// ===============================
// 1) التنقل بين التبويبات (Tabs Navigation)
// ===============================
window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tabs-nav .tab-btn').forEach(el => el.classList.remove('active'));

  const targetPane = document.getElementById(`tab-${tabId}`);
  const targetBtn = document.getElementById(`tabBtn-${tabId}`);
  if (targetPane) targetPane.classList.add('active');
  if (targetBtn) targetBtn.classList.add('active');

  const designerBtn = document.getElementById('btnToggleDesigner');
  const saveLayoutBtn = document.getElementById('btnSaveLayout');
  if (tabId === 'map') {
    if (designerBtn) designerBtn.style.display = 'inline-flex';
    if (saveLayoutBtn && isDesignerMode) saveLayoutBtn.style.display = 'inline-flex';
    renderCanvasTables();
  } else {
    if (designerBtn) designerBtn.style.display = 'none';
    if (saveLayoutBtn) saveLayoutBtn.style.display = 'none';
  }
};

// ===============================
// 2) تحميل وإدارة الصالات والطاولات
// ===============================
async function loadFloorsAndTables() {
  try {
    const res = await fetch('/api/pos-restaurant/floors-and-tables', { headers });
    const json = await res.json();
    if (json.status === 'success') {
      allFloors = json.data.floors || [];
      allTables = [];
      allFloors.forEach(f => {
        (f.tables || []).forEach(t => {
          allTables.push({ ...t, floor_name: f.name });
        });
      });

      if (!currentFloorId && allFloors.length > 0) {
        currentFloorId = allFloors[0].id;
      }

      renderFloors();
      renderFloorsTabs();
      renderTablesList();
      populateTableFloorSelect();
      renderCanvasTables();
      updateKPIs();
    }
  } catch (err) {
    console.error('❌ خطأ في تحميل الصالات والطاولات:', err);
  }
}

// رسم بطاقات الصالات
function renderFloors() {
  const grid = document.getElementById('floorsGrid');
  if (!grid) return;

  if (allFloors.length === 0) {
    grid.innerHTML = '<div style="color:#94a3b8; grid-column: 1/-1; text-align:center; padding:30px;">لم يتم إضافة صالات بعد. أضف أول صالة من النموذج.</div>';
    return;
  }

  grid.innerHTML = allFloors.map(f => `
    <div class="info-card">
      <div class="card-header-flex">
        <h4 style="margin:0; font-size:16px; color:#f8fafc;">🏢 ${f.name}</h4>
        <button class="btn-action-danger" onclick="deleteFloor(${f.id}, '${f.name}')" title="حذف الصالة">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <div style="font-size:13px; color:#94a3b8; margin: 8px 0;">
        الترتيب: #${f.sequence || 1}
      </div>
      <div style="font-size:13px; color:#00ff88; font-weight:600;">
        🍽️ عدد الطاولات: ${f.tables ? f.tables.length : 0}
      </div>
    </div>
  `).join('');
}

// إضافة صالة جديدة
document.getElementById('createFloorForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('floorNameInput').value.trim();
  const sequence = parseInt(document.getElementById('floorSeqInput').value) || 1;
  if (!name) return;

  try {
    const res = await fetch('/api/pos-restaurant/floors', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, sequence })
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم إنشاء الصالة بنجاح');
    document.getElementById('floorNameInput').value = '';
    await loadFloorsAndTables();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
});

// حذف صالة
window.deleteFloor = async function(id, name) {
  if (!confirm(`هل أنت متأكد من حذف الصالة "${name}"؟ سيتم حذف جميع الطاولات المرتبطة بها!`)) return;

  try {
    const res = await fetch(`/api/pos-restaurant/floors/${id}`, {
      method: 'DELETE',
      headers
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم حذف الصالة بنجاح');
    if (currentFloorId === id) currentFloorId = null;
    await loadFloorsAndTables();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

// ===============================
// 3) المخطط الرسومي 2D Canvas & وضع التصميم
// ===============================
function renderFloorsTabs() {
  const container = document.getElementById('floorsTabsBar');
  if (!container) return;

  container.innerHTML = allFloors.map(f => `
    <button class="floor-tab-pill ${f.id === currentFloorId ? 'active' : ''}" onclick="selectFloor(${f.id})" style="background:${f.id === currentFloorId ? '#00ff88' : '#1e293b'}; color:${f.id === currentFloorId ? '#030712' : '#f8fafc'}; border:none; padding:8px 16px; border-radius:20px; font-weight:700; cursor:pointer; margin-left:8px;">
      <span>🏢 ${f.name}</span>
      <small style="opacity:0.8;">(${f.tables ? f.tables.length : 0})</small>
    </button>
  `).join('');
}

window.selectFloor = function(floorId) {
  currentFloorId = floorId;
  renderFloorsTabs();
  renderCanvasTables();
};

window.toggleDesignerMode = function() {
  isDesignerMode = !isDesignerMode;
  const canvas = document.getElementById('floorCanvas');
  const banner = document.getElementById('designerBanner');
  const btnSave = document.getElementById('btnSaveLayout');
  const btnToggle = document.getElementById('btnToggleDesigner');

  if (isDesignerMode) {
    canvas?.classList.add('designer-active');
    if (banner) banner.style.display = 'flex';
    if (btnSave) btnSave.style.display = 'inline-flex';
    if (btnToggle) btnToggle.innerHTML = '<i class="fa-solid fa-check"></i> إنهاء وضع التصميم';
  } else {
    canvas?.classList.remove('designer-active');
    if (banner) banner.style.display = 'none';
    if (btnSave) btnSave.style.display = 'none';
    if (btnToggle) btnToggle.innerHTML = '<i class="fa-solid fa-pen-ruler"></i> وضع تصميم المخطط';
  }
  renderCanvasTables();
};

function renderCanvasTables() {
  const canvas = document.getElementById('floorCanvas');
  if (!canvas) return;

  const currentFloor = allFloors.find(f => f.id === currentFloorId);
  const tables = currentFloor ? (currentFloor.tables || []) : [];

  if (tables.length === 0) {
    canvas.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; min-height:400px; color:#94a3b8;">
        <i class="fa-solid fa-chair" style="font-size:3rem; margin-bottom:12px; opacity:0.4;"></i>
        <div>لا توجد طاولات مضافة في هذه الصالة بعد.</div>
        <button onclick="switchTab('tables')" style="margin-top:12px; background:#00ff88; color:#030712; border:none; padding:6px 14px; border-radius:6px; font-weight:700; cursor:pointer;">
          ➕ إضافة طاولة لهذه الصالة
        </button>
      </div>
    `;
    return;
  }

  canvas.innerHTML = tables.map(t => {
    const isOccupied = t.status === 'occupied';
    const statusColor = isOccupied ? '#ef4444' : '#00ff88';
    const posX = Math.max(0, parseInt(t.position_x) || 50);
    const posY = Math.max(0, parseInt(t.position_y) || 50);
    const width = Math.max(70, parseInt(t.width) || 120);
    const height = Math.max(70, parseInt(t.height) || 120);
    const shape = t.shape || 'square';
    const borderRadius = shape === 'round' ? '50%' : '12px';

    return `
      <div class="visual-table ${isDesignerMode ? 'draggable' : ''}" 
           id="vtable-${t.id}"
           data-id="${t.id}"
           data-x="${posX}"
           data-y="${posY}"
           style="position:absolute; left:${posX}px; top:${posY}px; width:${width}px; height:${height}px; border-radius:${borderRadius}; background:#111827; border:2px solid ${statusColor}; box-shadow:0 8px 20px rgba(0,0,0,0.6); display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:${isDesignerMode ? 'grab' : 'pointer'}; user-select:none; z-index:10;"
           draggable="${isDesignerMode}"
           ondragstart="onTableDragStart(event)"
           onclick="onVisualTableClick(${t.id})">
        <div style="font-weight:700; font-size:1.1rem; color:#f8fafc;">${t.table_number}</div>
        <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">💺 ${t.seats} كراسي</div>
        <div style="font-size:0.7rem; color:${statusColor}; font-weight:600; margin-top:4px;">
          ${isOccupied ? '🔴 مشغولة' : '🟢 شاغرة'}
        </div>
      </div>
    `;
  }).join('');

  if (isDesignerMode) {
    canvas.ondragover = onCanvasDragOver;
    canvas.ondrop = onCanvasDrop;
  }
}

// منطق السحب والإفلات للطاولات
let draggedTableId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

window.onTableDragStart = function(e) {
  draggedTableId = e.currentTarget.getAttribute('data-id');
  const rect = e.currentTarget.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  e.dataTransfer.effectAllowed = 'move';
};

window.onCanvasDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};

window.onCanvasDrop = function(e) {
  e.preventDefault();
  if (!draggedTableId) return;

  const canvas = document.getElementById('floorCanvas');
  const canvasRect = canvas.getBoundingClientRect();
  let newX = e.clientX - canvasRect.left - dragOffsetX;
  let newY = e.clientY - canvasRect.top - dragOffsetY;

  newX = Math.max(10, Math.round(newX / 10) * 10);
  newY = Math.max(10, Math.round(newY / 10) * 10);

  const el = document.getElementById(`vtable-${draggedTableId}`);
  if (el) {
    el.style.left = `${newX}px`;
    el.style.top = `${newY}px`;
    el.setAttribute('data-x', newX);
    el.setAttribute('data-y', newY);
  }

  // تحديث الذاكرة المحلية
  const currentFloor = allFloors.find(f => f.id === currentFloorId);
  if (currentFloor) {
    const tableObj = currentFloor.tables.find(t => String(t.id) === String(draggedTableId));
    if (tableObj) {
      tableObj.position_x = newX;
      tableObj.position_y = newY;
    }
  }
  draggedTableId = null;
};

// حفظ المخطط المعماري
window.saveCurrentFloorLayout = async function() {
  const currentFloor = allFloors.find(f => f.id === currentFloorId);
  if (!currentFloor || !currentFloor.tables) return;

  try {
    const res = await fetch(`/api/pos-restaurant/floors/${currentFloorId}/layout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tables: currentFloor.tables })
    });
    const json = await res.json();
    if (json.status !== 'success') throw new Error(json.message);

    alert('✅ تم حفظ المخطط المعماري للصالة بنجاح!');
  } catch (err) {
    alert(`❌ خطأ في حفظ المخطط: ${err.message}`);
  }
};

window.onVisualTableClick = function(tableId) {
  if (isDesignerMode) {
    const currentFloor = allFloors.find(f => f.id === currentFloorId);
    const table = currentFloor?.tables?.find(t => t.id === tableId);
    if (table) openEditTableModal(table);
  } else {
    window.location.href = `/waiter.html`;
  }
};

function openEditTableModal(table) {
  document.getElementById('editTableId').value = table.id;
  document.getElementById('editTableNumber').value = table.table_number;
  document.getElementById('editTableSeats').value = table.seats;
  document.getElementById('editTableShape').value = table.shape || 'square';
  document.getElementById('editTableWidth').value = table.width || 120;
  document.getElementById('editTableHeight').value = table.height || 120;
  
  const modal = document.getElementById('modalEditTable');
  if (modal) modal.style.display = 'flex';
}

window.closeEditTableModal = function() {
  const modal = document.getElementById('modalEditTable');
  if (modal) modal.style.display = 'none';
};

window.submitUpdateTableModal = async function() {
  const id = document.getElementById('editTableId').value;
  const table_number = document.getElementById('editTableNumber').value.trim();
  const seats = parseInt(document.getElementById('editTableSeats').value) || 4;
  const shape = document.getElementById('editTableShape').value;
  const width = parseInt(document.getElementById('editTableWidth').value) || 120;
  const height = parseInt(document.getElementById('editTableHeight').value) || 120;

  try {
    const res = await fetch(`/api/pos-restaurant/tables/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ table_number, seats, shape, width, height })
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم تحديث بيانات الطاولة');
    closeEditTableModal();
    await loadFloorsAndTables();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

window.submitDeleteTableFromModal = async function() {
  const id = document.getElementById('editTableId').value;
  const table = allTables.find(t => String(t.id) === String(id));
  if (table) {
    closeEditTableModal();
    await deleteTable(table.id, table.table_number, table.status);
  }
};

// ===============================
// 4) إدارة الطاولات (قائمة Tab 3)
// ===============================
function populateTableFloorSelect() {
  const sel = document.getElementById('tableFloorSelect');
  const filterSel = document.getElementById('filterFloorSelect');
  if (!sel) return;

  const optionsHtml = allFloors.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  sel.innerHTML = optionsHtml || '<option value="">يرجى إضافة صالة أولاً</option>';

  if (filterSel) {
    filterSel.innerHTML = `<option value="all">كل الصالات (${allTables.length} طاولة)</option>` + 
      allFloors.map(f => `<option value="${f.id}">${f.name} (${f.tables ? f.tables.length : 0})</option>`).join('');
  }
}

window.renderTablesList = function() {
  const grid = document.getElementById('tablesGrid');
  const filterVal = document.getElementById('filterFloorSelect')?.value || 'all';
  if (!grid) return;

  const filtered = filterVal === 'all' ? allTables : allTables.filter(t => String(t.floor_id) === String(filterVal));

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="color:#94a3b8; grid-column: 1/-1; text-align:center; padding:30px;">لا توجد طاولات في هذه الصالة بعد.</div>';
    return;
  }

  grid.innerHTML = filtered.map(t => {
    const isOccupied = t.status === 'occupied';
    return `
      <div class="info-card">
        <div class="card-header-flex">
          <div style="font-weight:700; font-size:15px; color:#f8fafc;">🍽️ ${t.table_number}</div>
          <button class="btn-action-danger" onclick="deleteTable(${t.id}, '${t.table_number}', '${t.status}')" title="حذف الطاولة">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        <div style="font-size:13px; color:#94a3b8; margin: 6px 0;">
          🏢 ${t.floor_name || 'صالة غير محددة'} • 💺 ${t.seats} مقاعد
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
          <span style="font-size:12px; font-weight:600; color:${isOccupied ? '#ef4444' : '#00ff88'};">
            ${isOccupied ? '🔴 مشغولة بطلب' : '🟢 شاغرة وجاهزة'}
          </span>
          <button onclick='openEditTableModal(${JSON.stringify(t)})' style="background:none; border:none; color:#38bdf8; cursor:pointer; font-size:13px;">
            ✏️ تعديل
          </button>
        </div>
      </div>
    `;
  }).join('');
};

document.getElementById('createTableForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const floor_id = document.getElementById('tableFloorSelect').value;
  const table_number = document.getElementById('tableNumberInput').value.trim();
  const seats = parseInt(document.getElementById('tableSeatsInput').value) || 4;

  if (!floor_id || !table_number) return;

  try {
    const res = await fetch('/api/pos-restaurant/tables', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        floor_id,
        table_number,
        seats,
        shape: 'square',
        position_x: 60,
        position_y: 60,
        width: 120,
        height: 120
      })
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم إنشاء الطاولة بنجاح');
    document.getElementById('tableNumberInput').value = '';
    await loadFloorsAndTables();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
});

window.deleteTable = async function(id, number, status) {
  if (status === 'occupied') {
    alert('⚠️ لا يمكن حذف هذه الطاولة لأنها مشغولة بزبائن حالياً!');
    return;
  }
  if (!confirm(`هل أنت متأكد من حذف الطاولة "${number}"؟`)) return;

  try {
    const res = await fetch(`/api/pos-restaurant/tables/${id}`, {
      method: 'DELETE',
      headers
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم حذف الطاولة بنجاح');
    await loadFloorsAndTables();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

// ===============================
// 5) تحليلات أداء الصالة ودوران الطاولات (Tab 4)
// ===============================
async function loadAnalytics() {
  try {
    const res = await fetch('/api/pos-restaurant/analytics?days=1', { headers });
    const json = await res.json();
    if (json.status === 'success' && json.data) {
      const kpis = json.data.kpis;
      const tables = json.data.tables || [];

      const turnoverEl = document.getElementById('kpiTurnoverRate');
      const turnoverEl2 = document.getElementById('analyticsTurnoverRate');
      const avgDurationEl = document.getElementById('kpiAvgDuration');
      const occupancyEl = document.getElementById('kpiOccupancyRate');
      const avgGuestsEl = document.getElementById('kpiAvgGuests');

      if (turnoverEl) turnoverEl.innerText = `${kpis.table_turnover_rate || 0} دورة`;
      if (turnoverEl2) turnoverEl2.innerText = `${kpis.table_turnover_rate || 0} دورة/طاولة`;
      if (avgDurationEl) avgDurationEl.innerText = `${kpis.avg_seating_duration || 0} دقيقة`;
      if (occupancyEl) occupancyEl.innerText = `${kpis.live_occupancy_rate || 0}%`;
      if (avgGuestsEl) avgGuestsEl.innerText = `${kpis.avg_guests_per_table || 0} ضيوف`;

      renderAnalyticsTable(tables);
    }
  } catch (err) {
    console.error('❌ خطأ في تحميل التحليلات:', err);
  }
}

function renderAnalyticsTable(tables) {
  const tbody = document.getElementById('analyticsTableBody');
  if (!tbody) return;

  if (tables.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">لا توجد بيانات تشغيلية بعد.</td></tr>';
    return;
  }

  tbody.innerHTML = tables.map(t => {
    const isOccupied = t.status === 'occupied';
    return `
      <tr>
        <td style="font-weight:700; color:#f8fafc;">🍽️ ${t.table_number}</td>
        <td>🏢 ${t.floor_name}</td>
        <td>💺 ${t.seats}</td>
        <td>${t.shape === 'round' ? 'دائرية 🟢' : t.shape === 'rectangle' ? 'مستطيلة ▭' : 'مربعة 🟦'}</td>
        <td style="font-weight:700; color:#38bdf8;">${t.turnover_count || 0} جلسات</td>
        <td>${Math.round(t.avg_duration || 0)} دقيقة</td>
        <td>${t.avg_guests ? Number(t.avg_guests).toFixed(1) : 0} زبون</td>
        <td style="font-weight:700; color:#00ff88;">${Number(t.total_revenue || 0).toLocaleString()} د.ع</td>
        <td>
          <span style="color:${isOccupied ? '#ef4444' : '#00ff88'}; font-weight:600;">
            ${isOccupied ? '🔴 مشغولة' : '🟢 شاغرة'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// ===============================
// 6) إدارة المنيو وربط الوصفات (Tab 5)
// ===============================
async function loadMenuAndStations() {
  try {
    const res = await fetch('/api/pos-restaurant/menu', { headers });
    const json = await res.json();
    if (json.status === 'success') {
      allMenu = json.data || [];
      renderMenuItems();
      updateKPIs();
    }

    const resMeta = await fetch('/api/pos-restaurant/stations-and-recipes', { headers });
    const metaJson = await resMeta.json();
    if (metaJson.status === 'success') {
      allStations = metaJson.data.stations || [];
      allRecipes = metaJson.data.recipes || [];
      populateStationAndRecipeSelects();
    }
  } catch (err) {
    console.error('❌ خطأ في تحميل المنيو والسكاشن:', err);
  }
}

function populateStationAndRecipeSelects() {
  const stationSel = document.getElementById('dishStationSelect');
  const recipeSel = document.getElementById('dishRecipeSelect');

  if (stationSel) {
    stationSel.innerHTML = '<option value="">-- اختر سكشن المطبخ --</option>' + 
      allStations.map(s => `<option value="${s.id}">🍳 ${s.station_name} (${s.station_type || 'مطبخ'})</option>`).join('');
  }

  if (recipeSel) {
    recipeSel.innerHTML = '<option value="">-- بدون ربط (صنف جاهز / بدون تكلفة خامات) --</option>' + 
      allRecipes.map(r => `<option value="${r.id}">🍲 ${r.name || r.item_name}</option>`).join('');
  }
}

function renderMenuItems() {
  const tbody = document.getElementById('menuItemsTableBody');
  if (!tbody) return;

  if (allMenu.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:25px;">لا توجد أطباق مسجلة في المنيو.</td></tr>';
    return;
  }

  tbody.innerHTML = allMenu.map(m => `
    <tr>
      <td style="font-weight:700; color:#f8fafc;">${m.item_name}</td>
      <td><span class="badge" style="background:#1e293b; color:#38bdf8; padding:3px 8px; border-radius:4px; font-size:12px;">${m.category || 'عام'}</span></td>
      <td style="font-weight:700; color:#00ff88;">${Number(m.price).toLocaleString()} د.ع</td>
      <td>🍳 ${m.station_name || 'غير محدد'}</td>
      <td>
        ${m.recipe_id 
          ? `<span style="color:#10b981; font-weight:600;"><i class="fa-solid fa-link"></i> ${m.recipe_name || 'مرتبط بوصفة'}</span>` 
          : '<span style="color:#64748b; font-size:12px;">غير مرتبط</span>'}
      </td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="btn-action" onclick="editDish(${m.id})" title="تعديل" style="background:#1e293b; color:#38bdf8; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-action-danger" onclick="deleteDish(${m.id}, '${m.item_name}')" title="حذف" style="background:rgba(239,68,68,0.2); color:#ef4444; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.filterMenuItems = function() {
  const query = document.getElementById('searchMenuInput')?.value.trim().toLowerCase() || '';
  const tbody = document.getElementById('menuItemsTableBody');
  if (!tbody) return;

  const filtered = allMenu.filter(m => 
    m.item_name.toLowerCase().includes(query) || 
    (m.category && m.category.toLowerCase().includes(query)) ||
    (m.station_name && m.station_name.toLowerCase().includes(query))
  );

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:25px;">لا توجد نتائج مطابقة للبحث.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(m => `
    <tr>
      <td style="font-weight:700; color:#f8fafc;">${m.item_name}</td>
      <td><span class="badge" style="background:#1e293b; color:#38bdf8; padding:3px 8px; border-radius:4px; font-size:12px;">${m.category || 'عام'}</span></td>
      <td style="font-weight:700; color:#00ff88;">${Number(m.price).toLocaleString()} د.ع</td>
      <td>🍳 ${m.station_name || 'غير محدد'}</td>
      <td>
        ${m.recipe_id 
          ? `<span style="color:#10b981; font-weight:600;"><i class="fa-solid fa-link"></i> ${m.recipe_name || 'مرتبط بوصفة'}</span>` 
          : '<span style="color:#64748b; font-size:12px;">غير مرتبط</span>'}
      </td>
      <td>
        <div style="display:flex; gap:8px;">
          <button class="btn-action" onclick="editDish(${m.id})" title="تعديل" style="background:#1e293b; color:#38bdf8; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-action-danger" onclick="deleteDish(${m.id}, '${m.item_name}')" title="حذف" style="background:rgba(239,68,68,0.2); color:#ef4444; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
};

document.getElementById('dishForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('editDishId').value;
  const item_name = document.getElementById('dishNameInput').value.trim();
  const category = document.getElementById('dishCategoryInput').value.trim();
  const price = parseFloat(document.getElementById('dishPriceInput').value);
  const station_id = document.getElementById('dishStationSelect').value;
  const recipe_id = document.getElementById('dishRecipeSelect').value || null;

  if (!item_name || !price || !station_id) {
    alert('يرجى ملء جميع الحقول المطلوبة');
    return;
  }

  const url = editId ? `/api/pos-restaurant/items/${editId}` : '/api/pos-restaurant/items';
  const method = editId ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify({ item_name, category, price, station_id, recipe_id })
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert(`✅ ${result.message}`);
    cancelDishEdit();
    await loadMenuAndStations();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
});

window.editDish = function(id) {
  const dish = allMenu.find(m => m.id === id);
  if (!dish) return;

  document.getElementById('editDishId').value = dish.id;
  document.getElementById('dishNameInput').value = dish.item_name;
  document.getElementById('dishCategoryInput').value = dish.category || '';
  document.getElementById('dishPriceInput').value = dish.price;
  document.getElementById('dishStationSelect').value = dish.station_id || '';
  document.getElementById('dishRecipeSelect').value = dish.recipe_id || '';

  document.getElementById('dishFormTitle').innerText = `✏️ تعديل طبق: ${dish.item_name}`;
  document.getElementById('cancelEditDishBtn').style.display = 'inline-block';
  window.scrollTo({ top: 300, behavior: 'smooth' });
};

window.cancelDishEdit = function() {
  document.getElementById('editDishId').value = '';
  document.getElementById('dishForm').reset();
  document.getElementById('dishFormTitle').innerText = '➕ إضافة طبق جديد للمنيو';
  document.getElementById('cancelEditDishBtn').style.display = 'none';
};

window.deleteDish = async function(id, name) {
  if (!confirm(`هل أنت متأكد من حذف طبق "${name}" من المنيو؟`)) return;

  try {
    const res = await fetch(`/api/pos-restaurant/items/${id}`, {
      method: 'DELETE',
      headers
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم حذف الطبق من قائمة الطعام');
    await loadMenuAndStations();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

// ===============================
// 7) إدارة الملاحظات السريعة (Tab 6)
// ===============================
async function loadQuickNotes() {
  try {
    const res = await fetch('/api/pos-restaurant/quick-notes', { headers });
    const json = await res.json();
    if (json.status === 'success') {
      allNotes = json.data || [];
      renderQuickNotes();
      updateKPIs();
    }
  } catch (err) {
    console.error('❌ خطأ في تحميل الملاحظات السريعة:', err);
  }
}

function renderQuickNotes() {
  const container = document.getElementById('quickNotesChipsGrid');
  if (!container) return;

  if (allNotes.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8; padding:20px;">لا توجد ملاحظات سريعة بعد. أضف ملاحظات من النموذج.</div>';
    return;
  }

  container.innerHTML = allNotes.map(n => `
    <div class="note-chip-card" style="display:inline-flex; align-items:center; gap:8px; background:#1e293b; border:1px solid #334155; padding:6px 14px; border-radius:20px; margin:4px;">
      <span style="font-size:12px; color:#38bdf8;">🏷️ [${n.category || 'عام'}]</span>
      <span style="font-weight:600; color:#f8fafc; font-size:13px;">${n.note_text}</span>
      <button onclick="deleteQuickNote(${n.id})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px; margin-right:4px;" title="حذف">
        <i class="fa-solid fa-times"></i>
      </button>
    </div>
  `).join('');
}

document.getElementById('createNoteForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const note_text = document.getElementById('noteTextInput').value.trim();
  const category = document.getElementById('noteCategorySelect').value;
  if (!note_text) return;

  try {
    const res = await fetch('/api/pos-restaurant/quick-notes', {
      method: 'POST',
      headers,
      body: JSON.stringify({ note_text, category })
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم إضافة الملاحظة السريعة');
    document.getElementById('noteTextInput').value = '';
    await loadQuickNotes();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
});

window.deleteQuickNote = async function(id) {
  if (!confirm('هل تريد حذف هذه الملاحظة السريعة؟')) return;

  try {
    const res = await fetch(`/api/pos-restaurant/quick-notes/${id}`, {
      method: 'DELETE',
      headers
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    await loadQuickNotes();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

// ===============================
// 8) تحديث بطاقات المؤشرات (KPIs)
// ===============================
function updateKPIs() {
  const fCount = document.getElementById('kpiFloorsCount');
  const tCount = document.getElementById('kpiTablesCount');
  const dCount = document.getElementById('kpiDishesCount');
  const nCount = document.getElementById('kpiNotesCount');

  if (fCount) fCount.innerText = allFloors.length;
  if (tCount) tCount.innerText = allTables.length;
  if (dCount) dCount.innerText = allMenu.length;
  if (nCount) nCount.innerText = allNotes.length;
}
