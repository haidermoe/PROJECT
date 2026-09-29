/**
 * ======================================================
 * Floor Management & 2D Designer JS - Odoo POS Restaurant
 * ======================================================
 */

const token = localStorage.getItem('token');
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

let allFloors = [];
let currentFloorId = null;
let currentFloorTables = [];
let isDesignerMode = false;
let activeMainTab = 'map';

document.addEventListener('DOMContentLoaded', async () => {
  await loadFloorsAndTables();
  await loadAnalytics();
});

// ===============================
// 1) تحميل الصالات والطاولات
// ===============================
async function loadFloorsAndTables() {
  try {
    const res = await fetch('/api/pos-restaurant/floors-and-tables', { headers });
    const json = await res.json();
    if (json.status === 'success') {
      allFloors = json.data.floors;
      renderFloorsTabs();

      if (!currentFloorId && allFloors.length > 0) {
        currentFloorId = allFloors[0].id;
      }
      selectFloor(currentFloorId);
    }
  } catch (err) {
    console.error('Error loading floors:', err);
  }
}

function renderFloorsTabs() {
  const container = document.getElementById('floorsTabsBar');
  if (!container) return;

  container.innerHTML = allFloors.map(f => `
    <button class="floor-tab-pill ${f.id === currentFloorId ? 'active' : ''}" onclick="selectFloor(${f.id})">
      <span>🏢 ${f.name}</span>
      <small style="opacity:0.75;">(${f.tables.length} طاولات)</small>
    </button>
  `).join('');

  // ملء قائمة الصالات في Modal إضافة طاولة
  const sel = document.getElementById('newTableFloorSelect');
  if (sel) {
    sel.innerHTML = allFloors.map(f => `<option value="${f.id}" ${f.id === currentFloorId ? 'selected' : ''}>${f.name}</option>`).join('');
  }
}

function selectFloor(floorId) {
  currentFloorId = floorId;
  renderFloorsTabs();

  const floor = allFloors.find(f => f.id === floorId);
  currentFloorTables = floor ? floor.tables : [];
  renderFloorCanvas(currentFloorTables);
}

// ===============================
// 2) رسم الصالة 2D مع الكراسي والأشكال
// ===============================
function renderFloorCanvas(tables) {
  const canvas = document.getElementById('floorCanvas');
  if (!canvas) return;

  canvas.innerHTML = '';
  canvas.classList.toggle('designer-active', isDesignerMode);

  if (!tables.length) {
    canvas.innerHTML = `
      <div style="position:absolute; top:40%; left:35%; text-align:center; color:#64748b;">
        <i class="fa-solid fa-chair" style="font-size:3rem; margin-bottom:10px;"></i>
        <div>لا توجد طاولات في هذه الصالة حالياً.</div>
        <button class="btn-sm btn-primary" onclick="openNewTableModal()" style="margin-top:10px;">
          ➕ أضف أول طاولة
        </button>
      </div>
    `;
    return;
  }

  tables.forEach(t => {
    const el = document.createElement('div');
    el.className = `visual-table shape-${t.shape || 'square'} status-${t.status || 'available'}`;
    el.id = `table-el-${t.id}`;
    el.dataset.id = t.id;

    const width = parseInt(t.width) || 120;
    const height = parseInt(t.height) || 120;
    const posX = parseInt(t.position_x) || 50;
    const posY = parseInt(t.position_y) || 50;
    const seats = parseInt(t.seats) || 4;

    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;

    // الحالة
    let statusText = 'متاحة';
    let statusClass = 'available';
    if (t.status === 'occupied') {
      const mins = t.duration_minutes || 0;
      statusText = `مشغولة (${mins} د)`;
      statusClass = 'occupied';
    } else if (t.status === 'billed') {
      statusText = 'طلب الحساب';
      statusClass = 'billed';
    }

    el.innerHTML = `
      <div class="vt-number">${t.table_number}</div>
      <div class="vt-seats"><i class="fa-solid fa-chair"></i> ${seats} مقاعد</div>
      <div class="vt-status-info ${statusClass}">${statusText}</div>
    `;

    // رسم الكراسي حول الطاولة
    renderTableChairs(el, seats, width, height, t.shape);

    // ربط الأحداث
    if (isDesignerMode) {
      enableDrag(el);
      el.addEventListener('click', (e) => {
        if (!el.dataset.dragged) {
          openEditTableModal(t);
        }
      });
    } else {
      el.addEventListener('click', () => {
        // الانتقال المباشر لشاشة الويتر والطلب
        window.location.href = `/waiter.html`;
      });
    }

    canvas.appendChild(el);
  });
}

// دالة توزيع الكراسي هندسياً حول الطاولة
function renderTableChairs(tableEl, seatsCount, width, height, shape) {
  const chairSize = 14;
  const offset = 9; // مسافة الكرسي خارج الطاولة

  if (shape === 'round') {
    // توزيع زاوي دائري متساوي
    for (let i = 0; i < seatsCount; i++) {
      const angle = (i * (2 * Math.PI / seatsCount)) - (Math.PI / 2);
      const radiusX = (width / 2) + offset;
      const radiusY = (height / 2) + offset;
      const cx = (width / 2) + radiusX * Math.cos(angle) - (chairSize / 2);
      const cy = (height / 2) + radiusY * Math.sin(angle) - (chairSize / 2);

      const chair = document.createElement('div');
      chair.className = 'vt-chair';
      chair.style.left = `${cx}px`;
      chair.style.top = `${cy}px`;
      tableEl.appendChild(chair);
    }
  } else {
    // توزيع الكراسي على الحواف الأربعة (أعلى، أسفل، يمين، يسار)
    const perSide = Math.ceil(seatsCount / 4);
    let chairsPlaced = 0;

    // أعلى وأسفل
    const topBottomCount = Math.min(Math.ceil(seatsCount / 2), Math.max(1, Math.floor(seatsCount * (width / (width + height)))));
    const sideCount = seatsCount - topBottomCount;

    const topCount = Math.ceil(topBottomCount / 2);
    const bottomCount = topBottomCount - topCount;
    const leftCount = Math.ceil(sideCount / 2);
    const rightCount = sideCount - leftCount;

    // كراسي الأعلى
    for (let i = 0; i < topCount; i++) {
      const step = width / (topCount + 1);
      addChair(tableEl, (step * (i + 1)) - (chairSize / 2), -offset - (chairSize / 2));
    }
    // كراسي الأسفل
    for (let i = 0; i < bottomCount; i++) {
      const step = width / (bottomCount + 1);
      addChair(tableEl, (step * (i + 1)) - (chairSize / 2), height + offset - (chairSize / 2));
    }
    // كراسي اليسار
    for (let i = 0; i < leftCount; i++) {
      const step = height / (leftCount + 1);
      addChair(tableEl, -offset - (chairSize / 2), (step * (i + 1)) - (chairSize / 2));
    }
    // كراسي اليمين
    for (let i = 0; i < rightCount; i++) {
      const step = height / (rightCount + 1);
      addChair(tableEl, width + offset - (chairSize / 2), (step * (i + 1)) - (chairSize / 2));
    }
  }
}

function addChair(tableEl, left, top) {
  const chair = document.createElement('div');
  chair.className = 'vt-chair';
  chair.style.left = `${left}px`;
  chair.style.top = `${top}px`;
  tableEl.appendChild(chair);
}

// ===============================
// 3) تفعيل السحب والإفلات (Drag & Drop)
// ===============================
function enableDrag(el) {
  let isDragging = false;
  let startX, startY;
  let initialLeft, initialTop;
  let hasMoved = false;

  el.onmousedown = (e) => {
    e.preventDefault();
    isDragging = true;
    hasMoved = false;
    delete el.dataset.dragged;

    startX = e.clientX;
    startY = e.clientY;
    initialLeft = parseInt(el.style.left) || 0;
    initialTop = parseInt(el.style.top) || 0;

    el.classList.add('dragging');

    document.onmousemove = (me) => {
      if (!isDragging) return;
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
        el.dataset.dragged = 'true';
      }

      // Snap to 10px grid
      let newLeft = Math.max(0, initialLeft + dx);
      let newTop = Math.max(0, initialTop + dy);
      newLeft = Math.round(newLeft / 10) * 10;
      newTop = Math.round(newTop / 10) * 10;

      el.style.left = `${newLeft}px`;
      el.style.top = `${newTop}px`;

      // تحديث مصفوفة الذاكرة
      const tableId = parseInt(el.dataset.id);
      const table = currentFloorTables.find(t => t.id === tableId);
      if (table) {
        table.position_x = newLeft;
        table.position_y = newTop;
      }
    };

    document.onmouseup = () => {
      isDragging = false;
      el.classList.remove('dragging');
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };
}

// ===============================
// 4) وضع التصميم وحفظ المخطط
// ===============================
function toggleDesignerMode() {
  isDesignerMode = !isDesignerMode;
  const btn = document.getElementById('btnToggleDesigner');
  const saveBtn = document.getElementById('btnSaveLayout');
  const banner = document.getElementById('designerBanner');

  if (isDesignerMode) {
    btn.innerHTML = '<i class="fa-solid fa-check"></i> إنهاء التصميم';
    btn.style.background = '#f59e0b';
    saveBtn.style.display = 'inline-flex';
    banner.style.display = 'flex';
  } else {
    btn.innerHTML = '<i class="fa-solid fa-pen-ruler"></i> وضع تصميم المخطط';
    btn.style.background = '';
    saveBtn.style.display = 'none';
    banner.style.display = 'none';
  }

  renderFloorCanvas(currentFloorTables);
}

async function saveCurrentFloorLayout() {
  if (!currentFloorId) return;
  try {
    const payload = currentFloorTables.map(t => ({
      id: t.id,
      table_number: t.table_number,
      seats: t.seats,
      shape: t.shape,
      position_x: t.position_x,
      position_y: t.position_y,
      width: t.width,
      height: t.height
    }));

    const res = await fetch(`/api/pos-restaurant/floors/${currentFloorId}/layout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ tables: payload })
    });
    const json = await res.json();
    alert(json.message);
  } catch (err) {
    alert('حدث خطأ في حفظ المخطط');
  }
}

// ===============================
// 5) إضافة وتعديل وحذف الطاولات
// ===============================
function openNewTableModal() {
  document.getElementById('newTableNumberInput').value = '';
  document.getElementById('newTableSeatsInput').value = '4';
  document.getElementById('newTableShapeSelect').value = 'square';
  openModal('modalNewTable');
}

async function submitCreateTable() {
  const floor_id = document.getElementById('newTableFloorSelect').value;
  const table_number = document.getElementById('newTableNumberInput').value;
  const seats = document.getElementById('newTableSeatsInput').value;
  const shape = document.getElementById('newTableShapeSelect').value;

  if (!table_number.trim()) return alert('رقم الطاولة مطلوب');

  try {
    const res = await fetch('/api/pos-restaurant/tables', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        floor_id,
        table_number,
        seats,
        shape,
        position_x: 60,
        position_y: 60,
        width: shape === 'rectangle' ? 160 : 120,
        height: 120
      })
    });
    const json = await res.json();
    alert(json.message);
    if (json.status === 'success') {
      closeModal('modalNewTable');
      await loadFloorsAndTables();
      await loadAnalytics();
    }
  } catch (err) {
    alert('حدث خطأ في إضافة الطاولة');
  }
}

function openEditTableModal(table) {
  document.getElementById('editTableId').value = table.id;
  document.getElementById('editTableNumber').value = table.table_number;
  document.getElementById('editTableSeats').value = table.seats;
  document.getElementById('editTableShape').value = table.shape || 'square';
  document.getElementById('editTableWidth').value = table.width || 120;
  document.getElementById('editTableHeight').value = table.height || 120;
  openModal('modalEditTable');
}

async function submitUpdateTable() {
  const id = document.getElementById('editTableId').value;
  const table_number = document.getElementById('editTableNumber').value;
  const seats = document.getElementById('editTableSeats').value;
  const shape = document.getElementById('editTableShape').value;
  const width = document.getElementById('editTableWidth').value;
  const height = document.getElementById('editTableHeight').value;

  try {
    const res = await fetch(`/api/pos-restaurant/tables/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ table_number, seats, shape, width, height })
    });
    const json = await res.json();
    alert(json.message);
    if (json.status === 'success') {
      closeModal('modalEditTable');
      await loadFloorsAndTables();
      await loadAnalytics();
    }
  } catch (err) {
    alert('حدث خطأ في تعديل الطاولة');
  }
}

async function submitDeleteTable() {
  const id = document.getElementById('editTableId').value;
  if (!confirm('هل أنت متأكد من حذف هذه الطاولة من الصالة نهائياً؟')) return;

  try {
    const res = await fetch(`/api/pos-restaurant/tables/${id}`, {
      method: 'DELETE',
      headers
    });
    const json = await res.json();
    alert(json.message);
    if (json.status === 'success') {
      closeModal('modalEditTable');
      await loadFloorsAndTables();
      await loadAnalytics();
    }
  } catch (err) {
    alert('حدث خطأ في حذف الطاولة');
  }
}

// ===============================
// 6) محرك تحليلات دوران الطاولات والإشغال (Analytics)
// ===============================
async function loadAnalytics() {
  try {
    const res = await fetch('/api/pos-restaurant/analytics?days=7', { headers });
    const json = await res.json();
    if (json.status === 'success') {
      const { kpis, tables } = json.data;

      // KPIs
      document.getElementById('kpiTurnoverRate').textContent = `${kpis.table_turnover_rate} دورة/طاولة`;
      document.getElementById('kpiAvgDuration').textContent = `${kpis.avg_seating_duration} دقيقة`;
      document.getElementById('kpiOccupancyRate').textContent = `${kpis.live_occupancy_rate}%`;
      document.getElementById('kpiAvgGuests').textContent = `${kpis.avg_guests_per_table} ضيف/جلسة`;

      // Table Breakdown
      const tbody = document.getElementById('analyticsTableBody');
      if (!tbody) return;

      if (!tables.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8;">لا توجد بيانات متاحة حالياً</td></tr>';
        return;
      }

      tbody.innerHTML = tables.map(t => `
        <tr>
          <td style="font-weight:bold; color:#f8fafc;">${t.table_number}</td>
          <td>${t.floor_name}</td>
          <td>${t.seats} كراسي</td>
          <td><span style="font-size:0.85rem;">${t.shape === 'round' ? '🟢 دائرية' : (t.shape === 'rectangle' ? '▭ مستطيلة' : '🟦 مربعة')}</span></td>
          <td style="font-weight:bold; color:#3b82f6;">${t.turnover_count} مرات</td>
          <td>${Math.round(t.avg_duration)} دقيقة</td>
          <td>${Math.round(t.avg_guests * 10) / 10} ضيف</td>
          <td style="font-weight:bold; color:#10b981;">${Number(t.total_revenue || 0).toLocaleString('en-US')} د.ع</td>
          <td>
            <span class="status-badge ${t.status === 'occupied' ? 'badge-draft' : (t.status === 'billed' ? 'badge-draft' : 'badge-posted')}" style="${t.status === 'occupied' ? 'background:#ef4444; color:#fff;' : (t.status === 'billed' ? 'background:#f59e0b; color:#fff;' : '')}">
              ${t.status === 'occupied' ? 'مشغولة' : (t.status === 'billed' ? 'طلب الحساب' : 'متاحة')}
            </span>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

// ===============================
// 7) تبديل التبويبات الرئيسية
// ===============================
function switchMainTab(tab) {
  activeMainTab = tab;
  document.getElementById('tabBtnMap').classList.toggle('active', tab === 'map');
  document.getElementById('tabBtnAnalytics').classList.toggle('active', tab === 'analytics');

  document.getElementById('secMap').classList.toggle('active', tab === 'map');
  document.getElementById('secAnalytics').classList.toggle('active', tab === 'analytics');

  if (tab === 'analytics') {
    loadAnalytics();
  }
}

// Helpers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}
