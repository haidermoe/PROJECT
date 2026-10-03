/**
 * ======================================================
 * Waiter App Logic - نظام طلبات الويترية المتجاوب
 * متصل بمحرك طباعة المطبخ وقواعد البيانات
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

// عناصر الصفحة
const waiterNameEl = document.getElementById('waiterName');
if (waiterNameEl && currentUser) {
  waiterNameEl.textContent = currentUser.username || 'ويتر';
}

let allFloors = [];
let allMenu = [];
let selectedFloorId = null;
let currentTable = null;
let currentCart = [];
let editingNoteItemIndex = null;

// ===============================
// 1) تحميل الصالات والطاولات
// ===============================
async function loadFloorsAndTables() {
  try {
    const res = await fetch('/api/pos-restaurant/floors-and-tables', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    allFloors = result.data.floors;
    renderFloorTabs();
    if (!selectedFloorId && allFloors.length > 0) {
      selectedFloorId = allFloors[0].id;
    }
    renderTables();
  } catch (err) {
    console.error('فشل جلب الصالات:', err);
  }
}

function renderFloorTabs() {
  const container = document.getElementById('floorsBar');
  if (!container) return;

  container.innerHTML = allFloors.map(floor => `
    <button class="floor-tab ${floor.id === selectedFloorId ? 'active' : ''}" onclick="selectFloor(${floor.id})">
      🏛️ ${floor.name} (${floor.tables?.length || 0})
    </button>
  `).join('');
}

window.selectFloor = function(floorId) {
  selectedFloorId = floorId;
  renderFloorTabs();
  renderTables();
};

function renderTables() {
  const grid = document.getElementById('tablesGrid');
  if (!grid) return;

  const currentFloor = allFloors.find(f => f.id === selectedFloorId) || allFloors[0];
  if (!currentFloor || !currentFloor.tables || currentFloor.tables.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 40px;">لا توجد طاولات مضافة في هذه الصالة بعد</div>';
    return;
  }

  grid.innerHTML = currentFloor.tables.map(table => {
    const isOccupied = table.status === 'occupied' || !!table.current_order_id;
    const statusText = isOccupied ? '🔴 مشغولة' : '🟢 شاغرة';
    const amountHtml = isOccupied && table.order_total ? `<div class="table-amount">${parseFloat(table.order_total).toLocaleString()} د.ع</div>` : '';
    const waiterHtml = isOccupied && table.waiter_name ? `<div style="font-size:0.75rem; color:#94a3b8;">${table.waiter_name}</div>` : '';

    return `
      <div class="table-card ${isOccupied ? 'occupied' : 'available'}" onclick="openTableOrder(${table.id})">
        <span class="table-badge">${statusText}</span>
        <div class="table-number">${table.table_number}</div>
        <div class="table-seats">👥 سعة: ${table.seats} مقاعد</div>
        ${amountHtml}
        ${waiterHtml}
      </div>
    `;
  }).join('');
}

// ===============================
// 2) تحميل قائمة الطعام
// ===============================
async function loadMenu() {
  try {
    const res = await fetch('/api/pos-restaurant/menu', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    allMenu = result.data;
    renderCategories();
    renderMenuItems();
  } catch (err) {
    console.error('فشل جلب قائمة الطعام:', err);
  }
}

let selectedCategory = 'all';
let searchKeyword = '';

function renderCategories() {
  const bar = document.getElementById('categoriesBar');
  if (!bar) return;

  const categories = Array.from(new Set(allMenu.map(m => m.category || m.station_name || 'عام'))).filter(Boolean);
  bar.innerHTML = `
    <button class="cat-btn ${selectedCategory === 'all' ? 'active' : ''}" onclick="filterCategory('all')">🌟 الكل (${allMenu.length})</button>
    ${categories.map(cat => {
      const count = allMenu.filter(m => (m.category || m.station_name || 'عام') === cat).length;
      return `<button class="cat-btn ${selectedCategory === cat ? 'active' : ''}" onclick="filterCategory('${cat}')">${cat} (${count})</button>`;
    }).join('')}
  `;
}

window.filterCategory = function(cat) {
  selectedCategory = cat;
  renderCategories();
  renderMenuItems();
};

window.onSearchMenu = function(val) {
  searchKeyword = (val || '').trim().toLowerCase();
  renderMenuItems();
};

function renderMenuItems() {
  const grid = document.getElementById('menuGrid');
  if (!grid) return;

  let filtered = selectedCategory === 'all' 
    ? allMenu 
    : allMenu.filter(m => (m.category || m.station_name || 'عام') === selectedCategory);

  if (searchKeyword) {
    filtered = filtered.filter(m => 
      (m.item_name || '').toLowerCase().includes(searchKeyword) ||
      (m.category || '').toLowerCase().includes(searchKeyword) ||
      (m.station_name || '').toLowerCase().includes(searchKeyword)
    );
  }

  const countBadge = document.getElementById('menuCountBadge');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} صنف متوفر`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 40px; font-size:1.05rem;">❌ لا توجد أصناف مطابقة للبحث أو للقسم المختار</div>';
    return;
  }

  grid.innerHTML = filtered.map(item => `
    <div class="menu-card" onclick="addToCart(${item.id})">
      <div class="item-cat-badge">${item.category || 'عام'}</div>
      <div class="item-title">${item.item_name}</div>
      <div class="item-station">📍 ${item.station_name || 'المطبخ'}</div>
      <div class="item-price-tag">
        <span class="price-val">${parseFloat(item.price || 0).toLocaleString()}</span>
        <span class="price-curr">د.ع</span>
      </div>
    </div>
  `).join('');
}

// ===============================
// 3) فتح الطاولة وتسجيل الطلب
// ===============================
window.openTableOrder = async function(tableId) {
  let foundTable = null;
  for (const f of allFloors) {
    const t = f.tables?.find(x => x.id === tableId);
    if (t) { foundTable = t; break; }
  }
  if (!foundTable) return;

  currentTable = foundTable;
  currentCart = [];

  // إذا كانت الطاولة مشغولة، جلب طلبها النشط
  if (currentTable.status === 'occupied' || currentTable.current_order_id) {
    try {
      const res = await fetch(`/api/pos-restaurant/tables/${tableId}/order`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.data && result.data.items) {
        currentCart = result.data.items.map(it => ({
          itemId: it.item_id,
          name: it.item_name,
          price: parseFloat(it.unit_price || 0),
          quantity: parseFloat(it.quantity || 1),
          notes: it.notes || '',
          station_name: ''
        }));
        currentTable.activeOrderId = result.data.id;
      }
    } catch (e) {
      console.error('خطأ في جلب طلب الطاولة:', e);
    }
  }

  document.getElementById('cartTableTitle').textContent = `🍽️ ${currentTable.table_number} (${currentTable.floor_name || ''})`;
  renderCart();

  // إظهار شاشة الطلب وإخفاء شبكة الطاولات
  document.getElementById('tablesSection').style.display = 'none';
  document.getElementById('orderView').classList.add('active');
};

window.backToTables = function() {
  document.getElementById('orderView').classList.remove('active');
  document.getElementById('tablesSection').style.display = 'block';
  currentTable = null;
  currentCart = [];
  loadFloorsAndTables(); // تحديث ألوان الطاولات
};

// ===============================
// 4) سلة الطلبات (Cart Operations)
// ===============================
window.addToCart = function(itemId) {
  const item = allMenu.find(m => m.id === itemId);
  if (!item) return;

  const existing = currentCart.find(c => c.itemId === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    currentCart.push({
      itemId: item.id,
      name: item.item_name,
      price: parseFloat(item.price || 0),
      quantity: 1,
      notes: '',
      station_name: item.station_name || ''
    });
  }
  renderCart();
};

window.changeQty = function(index, delta) {
  if (!currentCart[index]) return;
  currentCart[index].quantity += delta;
  if (currentCart[index].quantity <= 0) {
    currentCart.splice(index, 1);
  }
  renderCart();
};

const QUICK_KITCHEN_NOTES = [
  '🧅 بدون بصل',
  '🍅 بدون طماطم',
  '🥒 بدون مخلل',
  '🥪 بدون مايونيز',
  '🥫 صوص خارجي',
  '🌶️ شطة زيادة / حار',
  '🚫 بدون شطة / بارد',
  '🧀 جبن إضافي',
  '🔥 مستوي جيداً (Well Done)',
  '🥩 استواء متوسط (Medium)',
  '🍞 خبز محمص إضافي',
  '🧂 بدون ملح',
  '🥡 سفري / علبة خارجية',
  '⚠️ حساسية طعام'
];

let activeItemNotesList = [];

window.openNoteModal = function(index) {
  editingNoteItemIndex = index;
  const item = currentCart[index];
  if (!item) return;

  const itemTitleEl = document.getElementById('noteModalItemTitle');
  if (itemTitleEl) {
    itemTitleEl.textContent = `📝 ملاحظات: ${item.name}`;
  }

  // تفكيك الملاحظات الحالية إن وجدت
  if (item.notes && item.notes.trim()) {
    activeItemNotesList = item.notes
      .split(/[،|,|\n]+/)
      .map(s => s.trim())
      .filter(Boolean);
  } else {
    activeItemNotesList = [];
  }

  const customInput = document.getElementById('customNoteInput');
  if (customInput) customInput.value = '';

  renderActiveNotesTags();
  renderQuickChips();

  document.getElementById('noteModal').classList.add('active');
};

function renderActiveNotesTags() {
  const container = document.getElementById('activeNotesTags');
  if (!container) return;

  if (activeItemNotesList.length === 0) {
    container.innerHTML = '<span class="empty-notes-hint">لا توجد ملاحظات مضافة بعد. اختر من الخيارات السريعة أدناه أو اكتب ملاحظة مخصصة.</span>';
    return;
  }

  container.innerHTML = activeItemNotesList.map((note, idx) => `
    <span class="active-tag">
      ${note}
      <button type="button" class="remove-tag-btn" onclick="removeNoteByIndex(${idx})" title="حذف">✕</button>
    </span>
  `).join('');
}

function renderQuickChips() {
  const container = document.getElementById('quickChipsGrid');
  if (!container) return;

  container.innerHTML = QUICK_KITCHEN_NOTES.map(chip => {
    const isSelected = activeItemNotesList.includes(chip);
    return `
      <button type="button" class="quick-chip-btn ${isSelected ? 'selected' : ''}" onclick="toggleQuickChip('${chip}')">
        ${chip}
      </button>
    `;
  }).join('');
}

window.toggleQuickChip = function(chipText) {
  const idx = activeItemNotesList.indexOf(chipText);
  if (idx >= 0) {
    activeItemNotesList.splice(idx, 1);
  } else {
    activeItemNotesList.push(chipText);
  }
  renderActiveNotesTags();
  renderQuickChips();
};

window.removeNoteByIndex = function(idx) {
  if (idx >= 0 && idx < activeItemNotesList.length) {
    activeItemNotesList.splice(idx, 1);
    renderActiveNotesTags();
    renderQuickChips();
  }
};

window.addCustomNote = function() {
  const input = document.getElementById('customNoteInput');
  if (!input) return;
  const val = input.value.trim();
  if (val) {
    if (!activeItemNotesList.includes(val)) {
      activeItemNotesList.push(val);
      renderActiveNotesTags();
      renderQuickChips();
    }
    input.value = '';
    input.focus();
  }
};

window.clearAllItemNotes = function() {
  activeItemNotesList = [];
  renderActiveNotesTags();
  renderQuickChips();
};

window.closeNoteModal = function() {
  document.getElementById('noteModal').classList.remove('active');
  editingNoteItemIndex = null;
  activeItemNotesList = [];
};

window.saveItemNotes = function() {
  if (editingNoteItemIndex !== null && currentCart[editingNoteItemIndex]) {
    currentCart[editingNoteItemIndex].notes = activeItemNotesList.join('، ');
  }
  closeNoteModal();
  renderCart();
};

window.saveItemNote = window.saveItemNotes; // توافقية

function renderCart() {
  const container = document.getElementById('cartItems');
  if (!container) return;

  if (currentCart.length === 0) {
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; padding:30px;">السلة فارغة. اضغط على أي صنف لإضافته.</div>';
    document.getElementById('cartTotalVal').textContent = '0 د.ع';
    return;
  }

  let total = 0;
  container.innerHTML = currentCart.map((it, idx) => {
    const itemTotal = it.price * it.quantity;
    total += itemTotal;
    const notesArray = it.notes ? it.notes.split(/[،|,|\n]+/).map(n => n.trim()).filter(Boolean) : [];

    return `
      <div class="cart-row">
        <div class="cart-row-details">
          <div class="cart-row-title">${it.name}</div>
          <div class="cart-row-price">${it.price.toLocaleString()} × ${it.quantity} = ${itemTotal.toLocaleString()} د.ع</div>
          ${notesArray.length > 0 ? `
            <div class="cart-notes-badges">
              ${notesArray.map(n => `<span class="cart-single-badge">📝 ${n}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="cart-row-actions">
          <button class="btn-note ${notesArray.length > 0 ? 'has-notes' : ''}" onclick="openNoteModal(${idx})" title="إضافة / تعديل ملاحظات">${notesArray.length > 0 ? '✏️ (' + notesArray.length + ')' : '✏️'}</button>
          <button class="btn-qty" onclick="changeQty(${idx}, -1)">-</button>
          <span class="cart-qty">${it.quantity}</span>
          <button class="btn-qty" onclick="changeQty(${idx}, 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('cartTotalVal').textContent = `${total.toLocaleString()} د.ع`;
}

// ===============================
// 5) إرسال الطلب للمطبخ (طباعة POS Routing)
// ===============================
window.sendOrderToKitchen = async function() {
  if (!currentTable) return;
  if (currentCart.length === 0) {
    alert('يرجى اختيار أصناف أولاً قبل إرسال الطلب!');
    return;
  }

  const btn = document.getElementById('btnSendOrder');
  btn.disabled = true;
  btn.textContent = '⏳ جاري الإرسال لطابعات المطبخ...';

  try {
    const payload = {
      tableId: currentTable.id,
      floorId: currentTable.floor_id,
      tableNo: currentTable.table_number,
      guestCount: currentTable.seats || 2,
      items: currentCart.map(it => ({
        itemId: it.itemId,
        itemName: it.name,
        quantity: it.quantity,
        unitPrice: it.price,
        notes: it.notes
      }))
    };

    const res = await fetch('/api/pos-restaurant/order/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert(`✅ ${result.message}`);
    backToTables();
  } catch (err) {
    alert(`❌ حدث خطأ: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 إرسال إلى المطبخ وطباعة الكبونات';
  }
};

// ===============================
// 6) تحصيل الحساب وإخلاء الطاولة وتوليد القيد المحاسبي
// ===============================
window.payAndReleaseTable = async function() {
  if (!currentTable) return;
  const orderId = currentTable.activeOrderId || currentTable.current_order_id;
  if (!orderId) {
    alert('لا يوجد طلب نشط لهذه الطاولة لتحصيله!');
    return;
  }

  const method = confirm('هل الدفع نقداً (كاش)؟\nاضغط OK للكاش، أو Cancel للدفع بالبطاقة الإلكترونية (POS Card)') ? 'cash' : 'card';

  try {
    const res = await fetch('/api/pos-restaurant/order/pay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        orderId,
        tableId: currentTable.id,
        paymentMethod: method
      })
    });

    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert(`✅ ${result.message}`);
    backToTables();
  } catch (err) {
    alert(`❌ فشل إنهاء الحساب: ${err.message}`);
  }
};

// تسجيل الخروج
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
});

// بدء التحميل
loadFloorsAndTables();
loadMenu();
