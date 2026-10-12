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
let allWaiters = [];
let allAssignments = [];
let currentFloorId = null;
let isDesignerMode = false;
let draggedItemType = null; // 'table' or 'element'
let draggedItemId = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof requireAuth !== 'undefined') {
    const authValid = await requireAuth();
    if (!authValid) return;
  }

  // ضبط التاريخ الافتراضي اليوم
  const todayStr = new Date().toISOString().slice(0, 10);
  const filterDateInput = document.getElementById('shiftsDateFilter');
  if (filterDateInput) filterDateInput.value = todayStr;
  const assignDateInput = document.getElementById('assignShiftDate');
  if (assignDateInput) assignDateInput.value = todayStr;

  await loadFloorsAndTables();
  await loadWaitersAndAssignments();
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
  const archToolbar = document.getElementById('architecturalToolbar');
  if (tabId === 'map') {
    if (designerBtn) designerBtn.style.display = 'inline-flex';
    if (saveLayoutBtn && isDesignerMode) saveLayoutBtn.style.display = 'inline-flex';
    if (archToolbar && isDesignerMode) archToolbar.style.display = 'flex';
    renderCanvasTables();
  } else {
    if (designerBtn) designerBtn.style.display = 'none';
    if (saveLayoutBtn) saveLayoutBtn.style.display = 'none';
    if (archToolbar) archToolbar.style.display = 'none';
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
// 2.1) مصفوفة تكليف وتوزيع شفتات الويترية على السكاشن (Waiters & Shifts Matrix)
// ===============================
async function loadWaitersAndAssignments() {
  try {
    const dateInput = document.getElementById('shiftsDateFilter');
    const selectedDate = dateInput ? dateInput.value : new Date().toISOString().slice(0, 10);

    // 1. جلب قائمة الويترية المؤهلين
    const resWaiters = await fetch('/api/pos-restaurant/waiters-list', { headers });
    const jsonWaiters = await resWaiters.json();
    if (jsonWaiters.status === 'success') {
      allWaiters = jsonWaiters.data || [];
      populateAssignWaitersDropdown();
    }

    // 2. جلب التكليفات للتاريخ المحدد
    const resAssign = await fetch(`/api/pos-restaurant/waiter-assignments?date=${selectedDate}`, { headers });
    const jsonAssign = await resAssign.json();
    if (jsonAssign.status === 'success') {
      allAssignments = jsonAssign.data || [];
    }

    renderWaitersMatrix();
    updateCurrentFloorWaiterBadge();
  } catch (err) {
    console.error('❌ خطأ في تحميل شفتات وتكليفات الويترية:', err);
  }
}

function populateAssignWaitersDropdown() {
  const waiterSelect = document.getElementById('assignWaiterSelect');
  if (!waiterSelect) return;
  waiterSelect.innerHTML = allWaiters.map(w => `
    <option value="${w.id}" data-name="${w.full_name || w.username}">
      ${w.full_name || w.username} (${w.role === 'hall_manager' ? 'مسؤول صالة' : w.role === 'cashier' ? 'كاشير' : 'كابتن ويتر'})
    </option>
  `).join('');
}

function renderWaitersMatrix() {
  const container = document.getElementById('waiterSectionsMatrix');
  if (!container) return;

  if (allFloors.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8; grid-column:1/-1; text-align:center; padding:30px;">لم يتم إضافة سكاشن بعد.</div>';
    return;
  }

  container.innerHTML = allFloors.map((floor, idx) => {
    // البحث عن التكليف النشط لهذا السكشن
    const assignment = allAssignments.find(a => a.floor_id === floor.id);
    const waiterName = assignment ? assignment.waiter_name : (floor.active_waiter_name || 'غير مكلّف');
    const shiftName = assignment ? assignment.shift_name : (floor.active_shift || 'صباحي');
    const notes = assignment?.notes || 'جاهز للخدمة';
    const isAssigned = Boolean(assignment || floor.active_waiter_name);

    return `
      <div class="waiter-card" style="border-right: 4px solid ${isAssigned ? '#00ff88' : '#ef4444'};">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <div style="font-weight:700; font-size:14px; color:#f8fafc;">
              🏢 ${floor.name}
            </div>
            <span class="section-badge">سكشن #${floor.sequence || (idx + 1)}</span>
          </div>

          <div style="display:flex; align-items:center; gap:10px; margin: 12px 0; background:#0b1322; padding:10px; border-radius:8px;">
            <div style="width:38px; height:38px; border-radius:50%; background:${isAssigned ? 'rgba(0,255,136,0.15)' : 'rgba(239,68,68,0.15)'}; display:flex; align-items:center; justify-content:center; color:${isAssigned ? '#00ff88' : '#ef4444'}; font-size:18px;">
              <i class="fa-solid fa-user-tie"></i>
            </div>
            <div style="flex:1;">
              <div style="font-size:11px; color:#94a3b8;">الويتر المسؤول:</div>
              <div style="font-weight:700; font-size:13px; color:#f8fafc;">${waiterName}</div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:12px;">
            <span style="color:#94a3b8;">الشفت / الدوام:</span>
            <span class="shift-badge">${shiftName}</span>
          </div>

          <div style="font-size:11px; color:#64748b; background:#060d1a; padding:6px 10px; border-radius:6px; margin-bottom:12px;">
            <i class="fa-solid fa-note-sticky"></i> ${notes}
          </div>
        </div>

        <div style="display:flex; gap:8px; border-top:1px solid rgba(255,255,255,0.06); padding-top:10px;">
          <button onclick="openAssignWaiterModal(${floor.id})" style="flex:1; background:#1e293b; color:#00ff88; border:1px solid rgba(0,255,136,0.3); padding:7px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">
            <i class="fa-solid fa-arrows-rotate"></i> تبديل الويتر
          </button>
          <button onclick="selectFloorAndOpenMap(${floor.id})" style="background:#00ff88; color:#030712; border:none; padding:7px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer;" title="عرض المخطط الهندسي">
            <i class="fa-solid fa-map-location-dot"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.selectFloorAndOpenMap = function(floorId) {
  selectFloor(floorId);
  switchTab('map');
};

function updateCurrentFloorWaiterBadge() {
  const currentFloor = allFloors.find(f => f.id === currentFloorId);
  if (!currentFloor) return;

  const assignment = allAssignments.find(a => a.floor_id === currentFloor.id);
  const waiterName = assignment ? assignment.waiter_name : (currentFloor.active_waiter_name || 'غير محدد');
  const shiftName = assignment ? assignment.shift_name : (currentFloor.active_shift || 'صباحي');

  const nameEl = document.getElementById('currentFloorWaiterName');
  const shiftEl = document.getElementById('currentFloorShiftBadge');
  if (nameEl) nameEl.textContent = waiterName;
  if (shiftEl) shiftEl.textContent = shiftName;
}

// نافذة تكليف الويتر
window.openAssignWaiterModal = function(floorId = null) {
  const floorSelect = document.getElementById('assignFloorSelect');
  if (floorSelect) {
    floorSelect.innerHTML = allFloors.map(f => `
      <option value="${f.id}" ${f.id === (floorId || currentFloorId) ? 'selected' : ''}>${f.name}</option>
    `).join('');
  }

  const modal = document.getElementById('modalAssignWaiter');
  if (modal) modal.style.display = 'flex';
};

window.closeAssignWaiterModal = function() {
  const modal = document.getElementById('modalAssignWaiter');
  if (modal) modal.style.display = 'none';
};

window.submitAssignWaiter = async function(e) {
  e.preventDefault();
  const floor_id = parseInt(document.getElementById('assignFloorSelect').value);
  const waiterSelect = document.getElementById('assignWaiterSelect');
  const user_id = parseInt(waiterSelect.value);
  const selectedOpt = waiterSelect.options[waiterSelect.selectedIndex];
  const waiter_name = selectedOpt ? selectedOpt.getAttribute('data-name') : 'ويتر';
  const shift_name = document.getElementById('assignShiftSelect').value;
  const shift_date = document.getElementById('assignShiftDate').value;
  const notes = document.getElementById('assignShiftNotes').value.trim();

  try {
    const res = await fetch('/api/pos-restaurant/assign-waiter', {
      method: 'POST',
      headers,
      body: JSON.stringify({ floor_id, user_id, waiter_name, shift_name, shift_date, notes })
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert(`✅ ${result.message}`);
    closeAssignWaiterModal();
    await loadFloorsAndTables();
    await loadWaitersAndAssignments();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

// ===============================
// 3) المخطط الهندسي المعماري 2D Canvas & استوديو التصميم
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
  updateCurrentFloorWaiterBadge();
  renderCanvasTables();
};

window.toggleDesignerMode = function() {
  isDesignerMode = !isDesignerMode;
  const canvas = document.getElementById('floorCanvas');
  const banner = document.getElementById('designerBanner');
  const btnSave = document.getElementById('btnSaveLayout');
  const btnToggle = document.getElementById('btnToggleDesigner');
  const archToolbar = document.getElementById('architecturalToolbar');

  if (isDesignerMode) {
    canvas?.classList.add('designer-active');
    if (banner) banner.style.display = 'flex';
    if (btnSave) btnSave.style.display = 'inline-flex';
    if (archToolbar) archToolbar.style.display = 'flex';
    if (btnToggle) btnToggle.innerHTML = '<i class="fa-solid fa-check"></i> إنهاء وضع التصميم';
  } else {
    canvas?.classList.remove('designer-active');
    if (banner) banner.style.display = 'none';
    if (btnSave) btnSave.style.display = 'none';
    if (archToolbar) archToolbar.style.display = 'none';
    if (btnToggle) btnToggle.innerHTML = '<i class="fa-solid fa-pen-ruler"></i> وضع تصميم المخطط';
  }
  renderCanvasTables();
};

// توليد الكراسي الهندسية حول الطاولة
function generateTableChairsHtml(shape, width, height, seats, statusColor) {
  const chairs = [];
  const chairSize = 14;
  const halfSize = chairSize / 2;

  if (shape === 'round') {
    // توزيع كراسي محيطية دائرية
    const radius = width / 2;
    const centerX = width / 2;
    const centerY = height / 2;
    const chairDistance = radius + 9;

    for (let i = 0; i < seats; i++) {
      const angle = (i * 2 * Math.PI) / seats - Math.PI / 2;
      const cx = centerX + chairDistance * Math.cos(angle) - halfSize;
      const cy = centerY + chairDistance * Math.sin(angle) - halfSize;
      chairs.push(`
        <div style="position:absolute; left:${Math.round(cx)}px; top:${Math.round(cy)}px; width:${chairSize}px; height:${chairSize}px; border-radius:50%; background:#1e293b; border:2px solid ${statusColor}; box-shadow:0 2px 6px rgba(0,0,0,0.5); pointer-events:none; z-index:2;"></div>
      `);
    }
  } else {
    // طاولة مربعة أو مستطيلة: توزيع الكراسي بالتساوي على الأضلاع
    const topBottomSeats = Math.ceil(seats / 2);
    const leftRightSeats = seats - topBottomSeats;

    // كراسي علوية وسفلية
    const topSeatsCount = Math.ceil(topBottomSeats / 2);
    const bottomSeatsCount = topBottomSeats - topSeatsCount;

    for (let i = 0; i < topSeatsCount; i++) {
      const step = width / (topSeatsCount + 1);
      const cx = step * (i + 1) - halfSize;
      chairs.push(`
        <div style="position:absolute; left:${Math.round(cx)}px; top:-12px; width:${chairSize}px; height:${chairSize}px; border-radius:4px; background:#1e293b; border:2px solid ${statusColor}; pointer-events:none; z-index:2;"></div>
      `);
    }

    for (let i = 0; i < bottomSeatsCount; i++) {
      const step = width / (bottomSeatsCount + 1);
      const cx = step * (i + 1) - halfSize;
      chairs.push(`
        <div style="position:absolute; left:${Math.round(cx)}px; bottom:-12px; width:${chairSize}px; height:${chairSize}px; border-radius:4px; background:#1e293b; border:2px solid ${statusColor}; pointer-events:none; z-index:2;"></div>
      `);
    }

    // كراسي الجوانب (يمين ويسار)
    const rightSeats = Math.ceil(leftRightSeats / 2);
    const leftSeats = leftRightSeats - rightSeats;

    for (let i = 0; i < rightSeats; i++) {
      const step = height / (rightSeats + 1);
      const cy = step * (i + 1) - halfSize;
      chairs.push(`
        <div style="position:absolute; right:-12px; top:${Math.round(cy)}px; width:${chairSize}px; height:${chairSize}px; border-radius:4px; background:#1e293b; border:2px solid ${statusColor}; pointer-events:none; z-index:2;"></div>
      `);
    }

    for (let i = 0; i < leftSeats; i++) {
      const step = height / (leftSeats + 1);
      const cy = step * (i + 1) - halfSize;
      chairs.push(`
        <div style="position:absolute; left:-12px; top:${Math.round(cy)}px; width:${chairSize}px; height:${chairSize}px; border-radius:4px; background:#1e293b; border:2px solid ${statusColor}; pointer-events:none; z-index:2;"></div>
      `);
    }
  }

  return chairs.join('');
}

function renderCanvasTables() {
  const canvas = document.getElementById('floorCanvas');
  if (!canvas) return;

  const currentFloor = allFloors.find(f => f.id === currentFloorId);
  const tables = currentFloor ? (currentFloor.tables || []) : [];
  const elements = currentFloor ? (currentFloor.elements || []) : [];

  let html = '';

  // 1. رسم العناصر المعمارية (جدران، أبواب، كاونترات، محطات خدمة)
  elements.forEach(el => {
    const posX = Math.max(0, parseInt(el.position_x) || 50);
    const posY = Math.max(0, parseInt(el.position_y) || 50);
    const width = Math.max(10, parseInt(el.width) || 100);
    const height = Math.max(10, parseInt(el.height) || 20);
    const rot = parseInt(el.rotation) || 0;
    const type = el.element_type || 'wall';

    let icon = 'fa-border-all';
    if (type === 'door') icon = 'fa-door-open';
    else if (type === 'bar') icon = 'fa-martini-glass-citrus';
    else if (type === 'service_station') icon = 'fa-bell-concierge';
    else if (type === 'cashier') icon = 'fa-cash-register';
    else if (type === 'pillar') icon = 'fa-monument';

    html += `
      <div class="arch-element element-${type}"
           id="velement-${el.id}"
           data-type="element"
           data-id="${el.id}"
           data-x="${posX}"
           data-y="${posY}"
           style="position:absolute; left:${posX}px; top:${posY}px; width:${width}px; height:${height}px; transform:rotate(${rot}deg); cursor:${isDesignerMode ? 'grab' : 'pointer'};"
           draggable="${isDesignerMode}"
           ondragstart="onCanvasItemDragStart(event, 'element', ${el.id})"
           onclick="onVisualElementClick(${el.id})">
        <span style="display:inline-flex; align-items:center; gap:4px; pointer-events:none; padding:2px 6px;">
          <i class="fa-solid ${icon}"></i>
          <span>${el.name || ''}</span>
        </span>
      </div>
    `;
  });

  // 2. رسم الطاولات مع الكراسي الهندسية
  tables.forEach(t => {
    const isOccupied = t.status === 'occupied';
    const isBilled = t.status === 'billed';
    const statusColor = isOccupied ? '#ef4444' : isBilled ? '#f59e0b' : '#00ff88';
    const posX = Math.max(0, parseInt(t.position_x) || 50);
    const posY = Math.max(0, parseInt(t.position_y) || 50);
    const width = Math.max(70, parseInt(t.width) || 110);
    const height = Math.max(70, parseInt(t.height) || 110);
    const shape = t.shape || 'square';
    const borderRadius = shape === 'round' ? '50%' : '14px';
    const seats = Math.max(1, parseInt(t.seats) || 4);

    const chairsHtml = generateTableChairsHtml(shape, width, height, seats, statusColor);

    html += `
      <div class="visual-table ${isDesignerMode ? 'draggable' : ''}" 
           id="vtable-${t.id}"
           data-type="table"
           data-id="${t.id}"
           data-x="${posX}"
           data-y="${posY}"
           style="position:absolute; left:${posX}px; top:${posY}px; width:${width}px; height:${height}px; border-radius:${borderRadius}; background:radial-gradient(circle, #1e293b 0%, #0b1322 100%); border:2px solid ${statusColor}; box-shadow:0 8px 24px rgba(0,0,0,0.6); display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:${isDesignerMode ? 'grab' : 'pointer'}; user-select:none; z-index:10;"
           draggable="${isDesignerMode}"
           ondragstart="onCanvasItemDragStart(event, 'table', ${t.id})"
           onclick="onVisualTableClick(${t.id})">
        
        <!-- الكراسي المعمارية المحيطة -->
        ${chairsHtml}

        <div style="font-weight:800; font-size:1.15rem; color:#f8fafc; pointer-events:none;">${t.table_number}</div>
        <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px; pointer-events:none;">💺 ${seats} مقاعد</div>
        <div style="font-size:0.7rem; color:${statusColor}; font-weight:700; margin-top:4px; pointer-events:none;">
          ${isOccupied ? '🔴 مشغولة' : isBilled ? '🟡 تطلب الحساب' : '🟢 شاغرة'}
        </div>
      </div>
    `;
  });

  canvas.innerHTML = html;

  if (isDesignerMode) {
    canvas.ondragover = onCanvasDragOver;
    canvas.ondrop = onCanvasDrop;
  }
}

// السحب والإفلات للطاولات والعناصر المعمارية
window.onCanvasItemDragStart = function(e, type, id) {
  draggedItemType = type;
  draggedItemId = id;
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
  if (!draggedItemId || !draggedItemType) return;

  const canvas = document.getElementById('floorCanvas');
  const canvasRect = canvas.getBoundingClientRect();
  let newX = e.clientX - canvasRect.left - dragOffsetX;
  let newY = e.clientY - canvasRect.top - dragOffsetY;

  // Snapping to 10px grid
  newX = Math.max(10, Math.round(newX / 10) * 10);
  newY = Math.max(10, Math.round(newY / 10) * 10);

  const currentFloor = allFloors.find(f => f.id === currentFloorId);

  if (draggedItemType === 'table') {
    const el = document.getElementById(`vtable-${draggedItemId}`);
    if (el) {
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
      el.setAttribute('data-x', newX);
      el.setAttribute('data-y', newY);
    }
    if (currentFloor) {
      const tableObj = currentFloor.tables?.find(t => String(t.id) === String(draggedItemId));
      if (tableObj) {
        tableObj.position_x = newX;
        tableObj.position_y = newY;
      }
    }
  } else if (draggedItemType === 'element') {
    const el = document.getElementById(`velement-${draggedItemId}`);
    if (el) {
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
      el.setAttribute('data-x', newX);
      el.setAttribute('data-y', newY);
    }
    if (currentFloor) {
      const elementObj = currentFloor.elements?.find(elem => String(elem.id) === String(draggedItemId));
      if (elementObj) {
        elementObj.position_x = newX;
        elementObj.position_y = newY;
      }
    }
  }

  draggedItemId = null;
  draggedItemType = null;
};

// حفظ المخطط الهندسي المعماري بالكامل
window.saveFloorArchitecturalBlueprint = async function() {
  const currentFloor = allFloors.find(f => f.id === currentFloorId);
  if (!currentFloor) return;

  try {
    const res = await fetch(`/api/pos-restaurant/floors/${currentFloorId}/architectural-blueprint`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tables: currentFloor.tables || [],
        elements: currentFloor.elements || []
      })
    });
    const json = await res.json();
    if (json.status !== 'success') throw new Error(json.message);

    alert('✅ تم حفظ المخطط الهندسي المعماري للصالة بنجاح!');
  } catch (err) {
    alert(`❌ خطأ في حفظ المخطط: ${err.message}`);
  }
};

// إضافة عنصر معماري سريع
window.addArchitecturalElement = function(type) {
  const currentFloor = allFloors.find(f => f.id === currentFloorId);
  if (!currentFloor) return;

  if (!currentFloor.elements) currentFloor.elements = [];

  const defaultNames = {
    wall: 'جدار فاصل',
    door: 'باب / مدخل',
    bar: 'كاونتر البار',
    service_station: 'محطة خدمة ويتر',
    cashier: 'كاشير الصالة',
    pillar: 'عمود ديكوري'
  };

  const defaultSizes = {
    wall: { w: 120, h: 12 },
    door: { w: 80, h: 14 },
    bar: { w: 140, h: 70 },
    service_station: { w: 130, h: 60 },
    cashier: { w: 120, h: 60 },
    pillar: { w: 35, h: 35 }
  };

  const size = defaultSizes[type] || { w: 100, h: 30 };
  const newElement = {
    id: Date.now(), // معرف مؤقت
    floor_id: currentFloorId,
    element_type: type,
    name: defaultNames[type] || 'عنصر معماري',
    position_x: 200,
    position_y: 150,
    width: size.w,
    height: size.h,
    rotation: 0,
    color: '#3b82f6'
  };

  currentFloor.elements.push(newElement);
  renderCanvasTables();
};

window.addNewTableQuick = function(shape = 'square') {
  const currentFloor = allFloors.find(f => f.id === currentFloorId);
  if (!currentFloor) return;

  const currentCount = (currentFloor.tables || []).length + 1;
  const newTable = {
    id: Date.now(),
    floor_id: currentFloorId,
    table_number: `T${currentCount}`,
    seats: shape === 'round' ? 4 : 6,
    shape: shape,
    position_x: 150,
    position_y: 150,
    width: shape === 'round' ? 100 : 140,
    height: shape === 'round' ? 100 : 90,
    status: 'available'
  };

  if (!currentFloor.tables) currentFloor.tables = [];
  currentFloor.tables.push(newTable);
  renderCanvasTables();
};

window.onVisualElementClick = function(elemId) {
  if (isDesignerMode) {
    const currentFloor = allFloors.find(f => f.id === currentFloorId);
    const elem = currentFloor?.elements?.find(e => String(e.id) === String(elemId));
    if (elem) openEditElementModal(elem);
  }
};

function openEditElementModal(elem) {
  document.getElementById('editElementId').value = elem.id;
  document.getElementById('editElementName').value = elem.name || '';
  document.getElementById('editElementWidth').value = elem.width || 100;
  document.getElementById('editElementHeight').value = elem.height || 20;
  document.getElementById('editElementRotation').value = elem.rotation || 0;
  document.getElementById('editElementColor').value = elem.color || '#3b82f6';

  const modal = document.getElementById('modalEditElement');
  if (modal) modal.style.display = 'flex';
}

window.closeEditElementModal = function() {
  const modal = document.getElementById('modalEditElement');
  if (modal) modal.style.display = 'none';
};

window.submitUpdateElementModal = function() {
  const id = document.getElementById('editElementId').value;
  const currentFloor = allFloors.find(f => f.id === currentFloorId);
  const elem = currentFloor?.elements?.find(e => String(e.id) === String(id));
  if (!elem) return;

  elem.name = document.getElementById('editElementName').value.trim();
  elem.width = parseInt(document.getElementById('editElementWidth').value) || 100;
  elem.height = parseInt(document.getElementById('editElementHeight').value) || 20;
  elem.rotation = parseInt(document.getElementById('editElementRotation').value) || 0;
  elem.color = document.getElementById('editElementColor').value;

  closeEditElementModal();
  renderCanvasTables();
};

window.submitDeleteElementFromModal = function() {
  const id = document.getElementById('editElementId').value;
  const currentFloor = allFloors.find(f => f.id === currentFloorId);
  if (currentFloor && currentFloor.elements) {
    currentFloor.elements = currentFloor.elements.filter(e => String(e.id) !== String(id));
  }
  closeEditElementModal();
  renderCanvasTables();
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
