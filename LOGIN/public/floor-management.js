/**
 * ======================================================
 * Floor & Menu Management Logic - نظام إدارة الصالات والمنيو
 * مرتبط آلياً مع كروت الوصفات وسكاشن المطبخ والمخزن
 * ======================================================
 */

const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');
let currentUser = null;

try {
  currentUser = userStr ? JSON.parse(userStr) : null;
} catch (e) {
  currentUser = null;
}

if (!token) {
  alert('يجب تسجيل الدخول أولاً');
  window.location.href = '/index.html';
}

// عناصر الصفحة العامة
if (currentUser && document.getElementById('sidebarUsername')) {
  document.getElementById('sidebarUsername').textContent = currentUser.username || 'مدير الصالة';
}

let allFloors = [];
let allTables = [];
let allMenu = [];
let allStations = [];
let allRecipes = [];
let allNotes = [];

// ===============================
// 1) تبديل التبويبات
// ===============================
window.switchTab = function(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

  const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(tabName));
  if (activeBtn) activeBtn.classList.add('active');

  const pane = document.getElementById(`tab-${tabName}`);
  if (pane) pane.classList.add('active');
};

// ===============================
// 2) جلب جميع البيانات المبدئية
// ===============================
async function loadAllData() {
  await Promise.all([
    loadFloorsAndTables(),
    loadStationsAndRecipes(),
    loadMenu(),
    loadQuickNotes()
  ]);
  updateKPIs();
}

function updateKPIs() {
  document.getElementById('kpiFloorsCount').textContent = allFloors.length;
  document.getElementById('kpiTablesCount').textContent = allTables.length;
  document.getElementById('kpiDishesCount').textContent = allMenu.length;
  document.getElementById('kpiNotesCount').textContent = allNotes.length;
}

// ===============================
// 3) إدارة الصالات والطاولات
// ===============================
async function loadFloorsAndTables() {
  try {
    const res = await fetch('/api/pos-restaurant/floors-and-tables', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    allFloors = result.data.floors || [];
    // استخراج الطاولات المسطحة
    allTables = [];
    allFloors.forEach(f => {
      if (f.tables) {
        f.tables.forEach(t => {
          allTables.push({ ...t, floor_name: f.name });
        });
      }
    });

    renderFloorsList();
    renderTablesFloorSelects();
    renderTablesList();
  } catch (err) {
    console.error('فشل جلب الصالات والطاولات:', err);
  }
}

function renderFloorsList() {
  const container = document.getElementById('floorsGrid');
  if (!container) return;

  if (allFloors.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8; padding:20px; grid-column:1/-1;">لا توجد صالات مضافة بعد. أضف صالة من النموذج جانباً.</div>';
    return;
  }

  container.innerHTML = allFloors.map(f => {
    const tablesCount = f.tables ? f.tables.length : 0;
    return `
      <div class="item-tile">
        <div>
          <div class="item-tile-title">🏢 ${f.name}</div>
          <div class="item-tile-subtitle">ترتيب العرض: #${f.sequence || 1} • عدد الطاولات: ${tablesCount}</div>
        </div>
        <div class="tile-actions">
          <button type="button" class="btn-delete-icon" onclick="deleteFloor(${f.id}, '${f.name}', ${tablesCount})">🗑️ حذف الصالة</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderTablesFloorSelects() {
  const tableFloorSelect = document.getElementById('tableFloorSelect');
  const filterFloorSelect = document.getElementById('filterFloorSelect');

  if (tableFloorSelect) {
    tableFloorSelect.innerHTML = allFloors.map(f => `
      <option value="${f.id}">${f.name}</option>
    `).join('');
  }

  if (filterFloorSelect) {
    const currentVal = filterFloorSelect.value;
    filterFloorSelect.innerHTML = `<option value="all">كل الصالات (${allTables.length} طاولة)</option>` + 
      allFloors.map(f => `
        <option value="${f.id}">${f.name} (${f.tables?.length || 0})</option>
      `).join('');
    filterFloorSelect.value = currentVal || 'all';
  }
}

function renderTablesList() {
  const container = document.getElementById('tablesGrid');
  if (!container) return;

  const filterId = document.getElementById('filterFloorSelect')?.value;
  let filtered = allTables;
  if (filterId && filterId !== 'all') {
    filtered = allTables.filter(t => String(t.floor_id) === String(filterId));
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8; padding:20px; grid-column:1/-1;">لا توجد طاولات تطابق الاختيار.</div>';
    return;
  }

  container.innerHTML = filtered.map(t => {
    const isOccupied = t.status === 'occupied';
    return `
      <div class="item-tile">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span class="item-tile-title">🍽️ ${t.table_number}</span>
            <span class="item-tile-badge ${isOccupied ? 'badge-occupied' : 'badge-available'}">
              ${isOccupied ? '🔴 مشغولة' : '🟢 متاحة'}
            </span>
          </div>
          <div class="item-tile-subtitle">القسم: ${t.floor_name || 'غير محدد'} • السعة: ${t.seats || 4} أشخاص</div>
        </div>
        <div class="tile-actions">
          <button type="button" class="btn-delete-icon" onclick="deleteTable(${t.id}, '${t.table_number}', '${t.status}')">🗑️ حذف</button>
        </div>
      </div>
    `;
  }).join('');
}

// إضافة صالة
document.getElementById('createFloorForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('floorNameInput').value.trim();
  const sequence = parseInt(document.getElementById('floorSeqInput').value) || 1;

  if (!name) return;

  try {
    const res = await fetch('/api/pos-restaurant/floors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, sequence })
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم إنشاء الصالة بنجاح');
    document.getElementById('floorNameInput').value = '';
    await loadFloorsAndTables();
    updateKPIs();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
});

// حذف صالة
window.deleteFloor = async function(id, name, count) {
  if (!confirm(`هل أنت متأكد من حذف الصالة "${name}"؟\nسيتم حذف ${count} طاولات تابعة لها إذا لم تكن مشغولة.`)) return;

  try {
    const res = await fetch(`/api/pos-restaurant/floors/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم حذف الصالة بنجاح');
    await loadFloorsAndTables();
    updateKPIs();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

// إضافة طاولة
document.getElementById('createTableForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const floor_id = document.getElementById('tableFloorSelect').value;
  const table_number = document.getElementById('tableNumberInput').value.trim();
  const seats = parseInt(document.getElementById('tableSeatsInput').value) || 4;

  if (!floor_id || !table_number) return;

  try {
    const res = await fetch('/api/pos-restaurant/tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ floor_id, table_number, seats })
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم إنشاء الطاولة بنجاح');
    document.getElementById('tableNumberInput').value = '';
    await loadFloorsAndTables();
    updateKPIs();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
});

// حذف طاولة
window.deleteTable = async function(id, number, status) {
  if (status === 'occupied') {
    alert('⚠️ لا يمكن حذف هذه الطاولة لأنها مشغولة بزبائن حالياً!');
    return;
  }
  if (!confirm(`هل أنت متأكد من حذف الطاولة "${number}"؟`)) return;

  try {
    const res = await fetch(`/api/pos-restaurant/tables/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم حذف الطاولة بنجاح');
    await loadFloorsAndTables();
    updateKPIs();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

// ===============================
// 4) إدارة قائمة الطعام وربط الوصفات
// ===============================
async function loadStationsAndRecipes() {
  try {
    const res = await fetch('/api/pos-restaurant/stations-and-recipes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status === 'success') {
      allStations = result.data.stations || [];
      allRecipes = result.data.recipes || [];

      // ملء خيارات السكاشن
      const stationSelect = document.getElementById('dishStationSelect');
      if (stationSelect) {
        stationSelect.innerHTML = allStations.map(s => `
          <option value="${s.id}">${s.station_name}</option>
        `).join('');
      }

      // ملء خيارات الوصفات
      const recipeSelect = document.getElementById('dishRecipeSelect');
      if (recipeSelect) {
        recipeSelect.innerHTML = '<option value="">-- بدون ربط (صنف جاهز / بدون تكلفة خامات) --</option>' +
          allRecipes.map(r => `
            <option value="${r.id}">🍳 ${r.name || r.item_name}</option>
          `).join('');
      }
    }
  } catch (err) {
    console.error('فشل جلب السكاشن والوصفات:', err);
  }
}

async function loadMenu() {
  try {
    const res = await fetch('/api/pos-restaurant/menu', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    allMenu = result.data || [];
    renderMenuItems();
  } catch (err) {
    console.error('فشل جلب المنيو:', err);
  }
}

function renderMenuItems(itemsToRender = allMenu) {
  const tbody = document.getElementById('menuItemsTableBody');
  if (!tbody) return;

  if (itemsToRender.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:30px;">لا توجد أطباق تطابق البحث.</td></tr>';
    return;
  }

  tbody.innerHTML = itemsToRender.map(it => {
    return `
      <tr>
        <td style="font-weight:700; color:#fff;">${it.item_name}</td>
        <td><span style="color:#38bdf8;">${it.category || 'عام'}</span></td>
        <td style="font-weight:700; color:var(--neon-green);">${parseFloat(it.price).toLocaleString()} د.ع</td>
        <td><span style="color:#cbd5e1;">📍 ${it.station_name || 'المطبخ الرئيسي'}</span></td>
        <td>
          ${it.recipe_name ? `
            <span class="recipe-tag">
              🍳 ${it.recipe_name}
            </span>
          ` : `
            <span class="no-recipe-tag">غير مربوط</span>
          `}
        </td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn-edit-icon" onclick="editDish(${it.id})">✏️ تعديل</button>
            <button type="button" class="btn-delete-icon" onclick="deleteDish(${it.id}, '${it.item_name}')">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterMenuItems = function() {
  const query = document.getElementById('searchMenuInput')?.value.trim().toLowerCase() || '';
  if (!query) {
    renderMenuItems(allMenu);
    return;
  }
  const filtered = allMenu.filter(m => 
    m.item_name.toLowerCase().includes(query) || 
    (m.category && m.category.toLowerCase().includes(query)) ||
    (m.recipe_name && m.recipe_name.toLowerCase().includes(query))
  );
  renderMenuItems(filtered);
};

// حفظ أو تعديل طبق
document.getElementById('dishForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editDishId').value;
  const item_name = document.getElementById('dishNameInput').value.trim();
  const category = document.getElementById('dishCategoryInput').value.trim();
  const price = document.getElementById('dishPriceInput').value;
  const station_id = document.getElementById('dishStationSelect').value;
  const recipe_id = document.getElementById('dishRecipeSelect').value || null;

  if (!item_name || !price || !station_id) {
    alert('يرجى ملء جميع الحقول الإلزامية');
    return;
  }

  const payload = {
    item_name,
    category,
    price: parseFloat(price),
    station_id: parseInt(station_id),
    recipe_id: recipe_id ? parseInt(recipe_id) : null
  };

  try {
    let res;
    if (id) {
      // تعديل
      res = await fetch(`/api/pos-restaurant/items/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    } else {
      // إضافة جديد
      res = await fetch('/api/pos-restaurant/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    }

    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert(`✅ ${result.message}`);
    cancelDishEdit();
    await loadMenu();
    updateKPIs();
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

  document.getElementById('dishFormTitle').textContent = `✏️ تعديل طبق: ${dish.item_name}`;
  document.getElementById('cancelEditDishBtn').style.display = 'inline-block';
  document.getElementById('dishNameInput').focus();
};

window.cancelDishEdit = function() {
  document.getElementById('editDishId').value = '';
  document.getElementById('dishNameInput').value = '';
  document.getElementById('dishCategoryInput').value = '';
  document.getElementById('dishPriceInput').value = '';
  document.getElementById('dishRecipeSelect').value = '';
  document.getElementById('dishFormTitle').textContent = '➕ إضافة طبق جديد للمنيو';
  document.getElementById('cancelEditDishBtn').style.display = 'none';
};

window.deleteDish = async function(id, name) {
  if (!confirm(`هل أنت متأكد من حذف/إيقاف طبق "${name}" من المنيو؟`)) return;

  try {
    const res = await fetch(`/api/pos-restaurant/items/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert('✅ تم حذف الطبق بنجاح');
    await loadMenu();
    updateKPIs();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

// ===============================
// 5) إدارة الملاحظات السريعة (Quick Notes)
// ===============================
async function loadQuickNotes() {
  try {
    const res = await fetch('/api/pos-restaurant/quick-notes', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    allNotes = result.data || [];
    renderQuickNotesList();
  } catch (err) {
    console.error('فشل جلب الملاحظات:', err);
  }
}

function renderQuickNotesList() {
  const container = document.getElementById('quickNotesChipsGrid');
  if (!container) return;

  if (allNotes.length === 0) {
    container.innerHTML = '<div style="color:#94a3b8; padding:20px;">لا توجد ملاحظات سريعة مسجلة بعد.</div>';
    return;
  }

  container.innerHTML = allNotes.map(n => `
    <div class="note-chip-card">
      <span>${n.note_text}</span>
      <span class="chip-category-badge">${n.category || 'عام'}</span>
      <button type="button" class="chip-remove-btn" onclick="deleteQuickNote(${n.id}, '${n.note_text}')" title="حذف الملاحظة">✕</button>
    </div>
  `).join('');
}

// إضافة ملاحظة سريعة
document.getElementById('createNoteForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const note_text = document.getElementById('noteTextInput').value.trim();
  const category = document.getElementById('noteCategorySelect').value;

  if (!note_text) return;

  try {
    const res = await fetch('/api/pos-restaurant/quick-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ note_text, category })
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    document.getElementById('noteTextInput').value = '';
    await loadQuickNotes();
    updateKPIs();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
});

// حذف ملاحظة سريعة
window.deleteQuickNote = async function(id, text) {
  if (!confirm(`هل أنت متأكد من حذف الملاحظة "${text}"؟`)) return;

  try {
    const res = await fetch(`/api/pos-restaurant/quick-notes/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    await loadQuickNotes();
    updateKPIs();
  } catch (err) {
    alert(`❌ خطأ: ${err.message}`);
  }
};

// تشغيل النظام عند تحميل الصفحة
loadAllData();
