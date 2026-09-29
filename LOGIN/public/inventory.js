/* ======================================================
   Inventory Dashboard – Full Logic (Westig System)
====================================================== */

// ---------------------------------------------
// 1) حماية الصفحة - التحقق من التوكن
// ---------------------------------------------
// الانتظار حتى يتم تحميل auth-check.js
document.addEventListener('DOMContentLoaded', async function() {
  // التأكد من أن requireAuth متاحة
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة! تأكد من تحميل auth-check.js');
    // إعادة توجيه لتسجيل الدخول
    window.location.replace("/index.html?error=login_required");
    return;
  }

  // استخدام دالة التحقق الموحدة
  const authValid = await requireAuth();
  
  if (!authValid) {
    // تم إعادة التوجيه تلقائياً في requireAuth
    return;
  }

  // التحقق من الصلاحيات - الموظفون العاديون يوجهون إلى البصمة
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      const regularEmployeeRoles = [
        'employee',
        'waiter',
        'captain',
        'cleaner',
        'hall_manager',
        'hall_captain',
        'receptionist',
        'garage_employee',
        'garage_manager'
      ];
      
      if (regularEmployeeRoles.includes(user.role)) {
        window.location.replace("/attendance.html");
        return;
      }
    } catch (e) {
      console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
    }
  }

  // ✅ التوكن صحيح - تهيئة الصفحة
  initializeInventory();
});

// تهيئة صفحة المخزن
function initializeInventory() {
  // تطبيق الصلاحيات
  applyInventoryPermissions();
  
  // إعداد event listeners للمودال
  setupModalListeners();
  
  // تحميل البيانات
  loadInventoryPage();
}

// تطبيق الصلاحيات على صفحة المخزن
function applyInventoryPermissions() {
  const user = getCurrentUser();
  if (!user) return;

  // الموظف: إخفاء زر إضافة مادة
  if (user.role === 'employee') {
    const addBtn = document.getElementById('addItemBtn');
    if (addBtn) addBtn.style.display = 'none';
  }
}

// إعداد event listeners للمودال
function setupModalListeners() {
  // زر إضافة مادة
  const addItemBtn = document.getElementById("addItemBtn");
  if (addItemBtn) {
    addItemBtn.addEventListener("click", () => {
      const modal = document.getElementById("addModal");
      if (modal) {
        modal.classList.add("active");
      }
    });
  }

  // زر إلغاء
  const cancelAdd = document.getElementById("cancelAdd");
  if (cancelAdd) {
    cancelAdd.addEventListener("click", () => {
      const modal = document.getElementById("addModal");
      if (modal) {
        modal.classList.remove("active");
        // مسح الحقول
        clearModalFields();
      }
    });
  }

  // زر حفظ
  const saveAdd = document.getElementById("saveAdd");
  if (saveAdd) {
    saveAdd.addEventListener("click", async () => {
      await handleAddItem();
    });
  }

  // إغلاق المودال عند النقر خارجها
  const modal = document.getElementById("addModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        clearModalFields();
      }
    });
  }
}

// مسح حقول المودال
function clearModalFields() {
  const itemName = document.getElementById("itemName");
  const itemUnit = document.getElementById("itemUnit");
  const itemQty = document.getElementById("itemQty");
  const itemMin = document.getElementById("itemMin");
  const itemType = document.getElementById("itemMaterialType");
  const itemRec = document.getElementById("itemRecipeId");
  const recGroup = document.getElementById("recipeSelectGroup");
  
  if (itemName) itemName.value = "";
  if (itemUnit) itemUnit.value = "";
  if (itemQty) itemQty.value = "";
  if (itemMin) itemMin.value = "";
  if (itemType) itemType.value = "raw";
  if (itemRec) itemRec.value = "";
  if (recGroup) recGroup.style.display = "none";
}

let allRecipesCache = [];
async function ensureRecipesLoaded() {
  if (allRecipesCache.length > 0) return allRecipesCache;
  try {
    const res = await API("GET", "/api/recipes");
    if (res.status === "success" && res.data) {
      allRecipesCache = res.data;
    }
  } catch (e) {
    console.warn("تعذر جلب الوصفات:", e);
  }
  return allRecipesCache;
}

window.onAddMaterialTypeChange = async function() {
  const type = document.getElementById("itemMaterialType")?.value;
  const group = document.getElementById("recipeSelectGroup");
  const recSel = document.getElementById("itemRecipeId");
  if (!group || !recSel) return;

  if (type === 'manufactured') {
    group.style.display = "block";
    const recipes = await ensureRecipesLoaded();
    recSel.innerHTML = '<option value="">-- اختر وصفة التحضير (Sub-recipe) --</option>' +
      recipes.map(r => `<option value="${r.id}">📋 ${r.item_name || r.name} (Yield: ${r.yield || 1})</option>`).join('');
  } else {
    group.style.display = "none";
    recSel.value = "";
  }
};

window.onEditMaterialTypeChange = async function() {
  const type = document.getElementById("editItemMaterialType")?.value;
  const group = document.getElementById("editRecipeSelectGroup");
  const recSel = document.getElementById("editItemRecipeId");
  if (!group || !recSel) return;

  if (type === 'manufactured') {
    group.style.display = "block";
    const recipes = await ensureRecipesLoaded();
    const currVal = recSel.value;
    recSel.innerHTML = '<option value="">-- اختر وصفة التحضير (Sub-recipe) --</option>' +
      recipes.map(r => `<option value="${r.id}">📋 ${r.item_name || r.name} (Yield: ${r.yield || 1})</option>`).join('');
    if (currVal) recSel.value = currVal;
  } else {
    group.style.display = "none";
    recSel.value = "";
  }
};

// معالجة إضافة مادة مع التحديد الصريح لنوعها
async function handleAddItem() {
  const name = document.getElementById("itemName")?.value.trim();
  const unit = document.getElementById("itemUnit")?.value.trim();
  const qty = Number(document.getElementById("itemQty")?.value);
  const min = Number(document.getElementById("itemMin")?.value);
  const material_type = document.getElementById("itemMaterialType")?.value || 'raw';
  const recipe_id = document.getElementById("itemRecipeId")?.value || null;

  if (!name || !unit || isNaN(qty) || isNaN(min)) {
    alert("يرجى ملء جميع الحقول المطلوبة بشكل صحيح");
    return;
  }

  try {
    const res = await API("POST", "/api/inventory/add", {
      name,
      unit,
      quantity: qty,
      min_qty: min,
      material_type,
      recipe_id
    });

    if (res.status === "success") {
      const modal = document.getElementById("addModal");
      if (modal) {
        modal.classList.remove("active");
      }
      clearModalFields();
      loadInventoryPage();
    } else {
      alert(res.message || "حدث خطأ أثناء إضافة المادة");
    }
  } catch (error) {
    console.error("خطأ في إضافة المادة:", error);
    alert("حدث خطأ في الاتصال بالسيرفر");
  }
}

// ---------------------------------------------
// 3) API Helper
// ---------------------------------------------
async function API(method, endpoint, body = null) {
  const token = localStorage.getItem("token");
  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(endpoint, config);
  return res.json();
}

// ---------------------------------------------
// 4) تحميل البيانات الأساسية
// ---------------------------------------------
async function loadInventoryPage() {
  loadKPIs();
  loadTable();
  loadAlerts();
  loadChart();
  loadStationStocks();
  loadStationRequests();
}

// ---------------------------------------------
// 5) KPIs
// ---------------------------------------------
async function loadKPIs() {
  const res = await API("GET", "/api/inventory/kpi");

  if (res.status !== "success") return;

  document.getElementById("kpiTotalItems").textContent = res.data.total_items;
  document.getElementById("kpiLowStock").textContent = res.data.low_stock;
  document.getElementById("kpiTodayOps").textContent = res.data.today_ops;
  document.getElementById("kpiWithdraw").textContent = res.data.total_withdraw;
}

// ---------------------------------------------
// 6) جدول المواد
// ---------------------------------------------
async function loadTable() {
  const res = await API("GET", "/api/inventory/items");

  const tbody = document.querySelector("#itemsTable tbody");
  tbody.innerHTML = "";

  const user = getCurrentUser();
  const isEmployee = user && user.role === 'employee';

  res.data.forEach(item => {
    const row = document.createElement("tr");

    const status =
      item.quantity <= item.min_qty
        ? `<span style="color:#ff6b7a">❗ قليل</span>`
        : `<span style="color:#00ff88">✔ جيد</span>`;

    const isManufactured = item.material_type === 'manufactured';
    const typeBadge = isManufactured
      ? `<span style="background:#581c87; color:#d8b4fe; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">🥫 مادة مصنعة / تحضير</span>`
      : `<span style="background:#064e3b; color:#6ee7b7; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">🌾 مادة خام أولية</span>`;

    const recipeInfo = (isManufactured && item.production_recipe_name)
      ? `<div style="color:#c084fc; font-size:0.75rem; margin-top:2px;">📋 وصفة: ${item.production_recipe_name}</div>`
      : '';

    const produceBtn = (isManufactured && item.recipe_id && !isEmployee)
      ? `<button class="btn-mini" onclick="openProduceModal(${item.id})" style="background:#8b5cf6; color:white; font-size:0.78rem; padding:3px 7px; margin-left:3px;" title="تحضير دفعة إنتاجية للمخزن">⚙️ تحضير دفعة</button>`
      : '';

    // أزرار العمليات
    const actionButtons = isEmployee
      ? `
        <button class="btn-mini plus" onclick="openDeposit(${item.id})">➕</button>
        <button class="btn-mini minus" onclick="openWithdraw(${item.id})">➖</button>
      `
      : `
        ${produceBtn}
        <button class="btn-mini edit" onclick="openEdit(${item.id})">✏</button>
        <button class="btn-mini plus" onclick="openDeposit(${item.id})">➕</button>
        <button class="btn-mini minus" onclick="openWithdraw(${item.id})">➖</button>
        <button class="btn-mini delete" onclick="deleteItem(${item.id})">🗑</button>
      `;

    row.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td>${typeBadge}${recipeInfo}</td>
      <td>${item.unit}</td>
      <td style="font-weight:bold; font-size:1.05rem;">${item.quantity.toLocaleString()}</td>
      <td>${status}</td>
      <td style="text-align:center;">
        ${actionButtons}
      </td>
    `;

    tbody.appendChild(row);
  });
}

// دالة مساعدة لجلب المستخدم الحالي
function getCurrentUser() {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------
// 7) تنبيهات اليمين
// ---------------------------------------------
async function loadAlerts() {
  const res = await API("GET", "/api/inventory/low-stock");
  const list = document.getElementById("notifList");

  list.innerHTML = "";

  res.data.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `⚠ مادة منخفضة: ${item.name}`;
    list.appendChild(li);
  });
}

// ---------------------------------------------
// 8) الشارت – 7 أيام
// ---------------------------------------------
async function loadChart() {
  const res = await API("GET", "/api/inventory/chart");

  const ctx = document.getElementById("inventoryChart").getContext("2d");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: res.data.days,
      datasets: [
        {
          label: "سحوبات",
          data: res.data.withdraw,
          borderColor: "#ff6b7a",
          tension: 0.3
        },
        {
          label: "إيداع",
          data: res.data.deposit,
          borderColor: "#00ff88",
          tension: 0.3
        }
      ]
    }
  });
}

// ======================================================
// 9) إضافة مادة - تم نقلها إلى setupModalListeners()
// ======================================================

// ======================================================
// 10) تعديل، حذف، سحب، إيداع
// ======================================================

// تعديل مادة بنافذة مخصصة وتحديد نوعها الصريح
window.openEdit = async function(id) {
  try {
    const res = await API("GET", "/api/inventory/items");
    const item = res.data.find(i => i.id === id);
    
    if (!item) {
      alert("المادة غير موجودة");
      return;
    }

    const modal = document.getElementById("editModal");
    if (!modal) return;

    document.getElementById("editItemId").value = item.id;
    document.getElementById("editItemName").value = item.name;
    document.getElementById("editItemUnit").value = item.unit;
    document.getElementById("editItemQty").value = item.quantity;
    
    const typeSel = document.getElementById("editItemMaterialType");
    if (typeSel) {
      typeSel.value = item.material_type || 'raw';
    }

    const recSel = document.getElementById("editItemRecipeId");
    if (recSel) {
      recSel.value = item.recipe_id || '';
    }

    modal.style.display = "flex";
    await window.onEditMaterialTypeChange();
    if (recSel && item.recipe_id) {
      recSel.value = item.recipe_id;
    }
  } catch (error) {
    console.error("خطأ في فتح نافذة التعديل:", error);
    alert("حدث خطأ في الاتصال بالسيرفر");
  }
};

window.closeEditModal = function() {
  const modal = document.getElementById("editModal");
  if (modal) modal.style.display = "none";
};

window.submitEditModal = async function() {
  const id = document.getElementById("editItemId")?.value;
  const name = document.getElementById("editItemName")?.value.trim();
  const unit = document.getElementById("editItemUnit")?.value.trim();
  const qty = parseFloat(document.getElementById("editItemQty")?.value);
  const material_type = document.getElementById("editItemMaterialType")?.value || 'raw';
  const recipe_id = document.getElementById("editItemRecipeId")?.value || null;

  if (!id || !name || !unit || isNaN(qty)) {
    alert("يرجى ملء جميع الحقول بشكل صحيح");
    return;
  }

  try {
    const editRes = await API("PUT", `/api/inventory/edit/${id}`, {
      name,
      unit,
      quantity: qty,
      material_type,
      recipe_id
    });

    if (editRes.status === "success") {
      alert("✅ " + editRes.message);
      closeEditModal();
      loadInventoryPage();
    } else {
      alert("❌ " + (editRes.message || "حدث خطأ أثناء التعديل"));
    }
  } catch (error) {
    console.error("خطأ في التعديل:", error);
    alert("حدث خطأ في الاتصال بالسيرفر");
  }
};

// تحضير وإنتاج دفعة تشغيلية لمادة مصنعة
window.openProduceModal = async function(id) {
  try {
    const res = await API("GET", "/api/inventory/items");
    const item = res.data.find(i => i.id === id);
    if (!item) return;

    const modal = document.getElementById("produceModal");
    if (!modal) return;

    document.getElementById("produceItemId").value = item.id;
    document.getElementById("produceItemName").textContent = `${item.name} (${item.quantity} ${item.unit} حالياً)`;
    document.getElementById("produceRecipeName").textContent = item.production_recipe_name || 'وصفة تحضيرية مسجلة';
    document.getElementById("produceQty").value = "5";

    modal.style.display = "flex";
  } catch (e) {
    console.error("خطأ في فتح نافذة الإنتاج:", e);
  }
};

window.closeProduceModal = function() {
  const modal = document.getElementById("produceModal");
  if (modal) modal.style.display = "none";
};

window.submitProduceBatch = async function() {
  const ingredientId = document.getElementById("produceItemId")?.value;
  const quantityToProduce = parseFloat(document.getElementById("produceQty")?.value);

  if (!ingredientId || isNaN(quantityToProduce) || quantityToProduce <= 0) {
    alert("يرجى إدخال كمية إنتاج صالحة أكبر من الصفر");
    return;
  }

  try {
    const res = await API("POST", "/api/inventory/produce-batch", {
      ingredientId,
      quantityToProduce
    });

    if (res.status === "success") {
      alert("✅ " + res.message);
      closeProduceModal();
      loadInventoryPage();
    } else {
      alert("❌ " + (res.message || "فشل التحضير"));
    }
  } catch (e) {
    alert("حدث خطأ أثناء الاتصال: " + e.message);
  }
};

// حذف مادة
async function deleteItem(id) {
  if (!confirm("هل أنت متأكد من حذف هذه المادة؟")) return;

  try {
    const res = await API("DELETE", `/api/inventory/delete/${id}`);

  if (res.status === "success") {
    loadInventoryPage();
    } else {
      alert(res.message || "حدث خطأ أثناء الحذف");
    }
  } catch (error) {
    console.error("خطأ في الحذف:", error);
    alert("حدث خطأ في الاتصال بالسيرفر");
  }
}

// سحب كمية
async function openWithdraw(id) {
  try {
    const res = await API("GET", "/api/inventory/items");
    const item = res.data.find(i => i.id === id);
    
    if (!item) {
      alert("المادة غير موجودة");
      return;
    }

    const quantity = prompt(`كمية السحب من "${item.name}" (الكمية الحالية: ${item.quantity} ${item.unit}):`, "");
    if (!quantity || isNaN(quantity) || parseFloat(quantity) <= 0) {
      alert("الكمية يجب أن تكون رقماً أكبر من الصفر");
      return;
    }

    const note = prompt("ملاحظة (اختياري):", "");

    const withdrawRes = await API("POST", `/api/inventory/withdraw/${id}`, {
      quantity: parseFloat(quantity),
      note: note || null
    });

    if (withdrawRes.status === "success") {
      loadInventoryPage();
    } else {
      alert(withdrawRes.message || "حدث خطأ أثناء السحب");
    }
  } catch (error) {
    console.error("خطأ في السحب:", error);
    alert("حدث خطأ في الاتصال بالسيرفر");
  }
}

// إيداع كمية
async function openDeposit(id) {
  try {
    const res = await API("GET", "/api/inventory/items");
    const item = res.data.find(i => i.id === id);
    
    if (!item) {
      alert("المادة غير موجودة");
      return;
    }

    const quantity = prompt(`كمية الإيداع لـ "${item.name}" (الكمية الحالية: ${item.quantity} ${item.unit}):`, "");
    if (!quantity || isNaN(quantity) || parseFloat(quantity) <= 0) {
      alert("الكمية يجب أن تكون رقماً أكبر من الصفر");
      return;
    }

    const note = prompt("ملاحظة (اختياري):", "");

    const depositRes = await API("POST", `/api/inventory/deposit/${id}`, {
      quantity: parseFloat(quantity),
      note: note || null
    });

    if (depositRes.status === "success") {
      loadInventoryPage();
    } else {
      alert(depositRes.message || "حدث خطأ أثناء الإيداع");
    }
  } catch (error) {
    console.error("خطأ في الإيداع:", error);
    alert("حدث خطأ في الاتصال بالسيرفر");
  }
}

// ---------------------------------------------
// 10) إدارة مخزون السكاشن (Station Stocks) والذكاء التشغيلي
// ---------------------------------------------
let allStationsList = [];
let allMainIngredients = [];
let coverageDebounceTimer = null;

async function loadStationStocks() {
  try {
    const res = await API("GET", "/api/inventory/station-stocks");
    const tbody = document.getElementById("stationStockBody");
    if (!tbody) return;

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#94a3b8; padding:20px;">لم يتم صرف عهدة لأي سكشن بعد. استخدم زر "صرف مواد للسكشن" لتحويل العهد التشغيلية.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(row => {
      const stock = parseFloat(row.station_stock) || 0;
      const minQty = parseFloat(row.min_qty) || 2;
      const isLow = stock <= minQty;
      const stockColor = isLow ? '#f87171' : '#10b981';
      const isManufactured = row.material_type === 'manufactured';
      const typeBadge = isManufactured 
        ? `<span style="background:#581c87; color:#c084fc; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-right:4px;">🥫 مصنّع</span>`
        : `<span style="background:#14532d; color:#86efac; font-size:0.75rem; padding:2px 6px; border-radius:4px; margin-right:4px;">🌾 خام</span>`;

      return `
        <tr>
          <td><strong>📍 ${row.station_name} (${row.station_code})</strong></td>
          <td>${typeBadge} <strong>${row.ingredient_name}</strong></td>
          <td style="color:${stockColor}; font-weight:bold; font-size:1.05rem;">
            ${stock.toLocaleString()} ${isLow ? '⚠️ منخفض' : ''}
          </td>
          <td>${row.ingredient_unit}</td>
          <td style="color:#94a3b8;">${parseFloat(row.main_store_stock).toLocaleString()}</td>
          <td style="font-size:0.8rem; color:#94a3b8;">${new Date(row.last_transferred_at).toLocaleString('ar-EG')}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error("خطأ في جلب مخزون السكاشن:", err);
  }
}

// ---------------------------------------------
// 11) إدارة طلبات صرف العهد واعتماد مدير المطبخ
// ---------------------------------------------
async function loadStationRequests() {
  try {
    const tbody = document.getElementById("stationRequestsBody");
    if (!tbody) return;

    const res = await API("GET", "/api/inventory/station-transfer-requests");
    const user = getCurrentUser();
    const canManage = user && (user.role === 'admin' || user.role === 'kitchen_manager' || user.role === 'manager');

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:#94a3b8; padding:20px;">لا توجد أي طلبات صرف عهد معلقة حالياً.</td></tr>';
      return;
    }

    tbody.innerHTML = res.data.map(req => {
      const isManufactured = req.material_type === 'manufactured';
      const typeBadge = isManufactured 
        ? `<span style="background:#3b0764; color:#d8b4fe; font-size:0.75rem; padding:2px 6px; border-radius:4px;">🥫 مصنّع</span>`
        : `<span style="background:#064e3b; color:#6ee7b7; font-size:0.75rem; padding:2px 6px; border-radius:4px;">🌾 خام</span>`;

      let statusBadge = '';
      if (req.status === 'pending') {
        statusBadge = `<span style="background:#854d0e; color:#fde047; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">⏳ بانتظار المدير</span>`;
      } else if (req.status === 'approved') {
        statusBadge = `<span style="background:#14532d; color:#86efac; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">✅ معتمد ومصروف</span>`;
      } else {
        statusBadge = `<span style="background:#7f1d1d; color:#fca5a5; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">❌ مرفوض</span>`;
      }

      let actions = '-';
      if (req.status === 'pending' && canManage) {
        actions = `
          <div style="display:flex; gap:6px; justify-content:center;">
            <button onclick="approveTransferRequest(${req.id})" style="background:#10b981; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.8rem; font-weight:bold;">✅ موافقة وصرف</button>
            <button onclick="rejectTransferRequest(${req.id})" style="background:#ef4444; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:0.8rem;">❌ رفض</button>
          </div>
        `;
      }

      const coverageClean = (req.coverage_summary || 'لا توجد تفاصيل').replace(/\n/g, '<br/>');

      return `
        <tr>
          <td>#${req.id}</td>
          <td><strong>📍 ${req.station_name}</strong></td>
          <td>${req.ingredient_name}</td>
          <td>${typeBadge}</td>
          <td style="font-weight:bold; font-size:1.05rem;">${req.quantity} ${req.ingredient_unit}</td>
          <td style="font-size:0.82rem; color:#cbd5e1; max-width:280px; text-align:right;">${coverageClean}</td>
          <td style="font-size:0.82rem; color:#94a3b8;">${req.requested_by ? 'شيف #' + req.requested_by : 'النظام'}</td>
          <td>${statusBadge}</td>
          <td style="text-align:center;">${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error("خطأ في جلب طلبات التحويل:", err);
  }
}

// ---------------------------------------------
// 12) نافذة طلب وصرف العهدة وحاسبة التغطية المباشرة
// ---------------------------------------------
window.openStationTransferModal = async function() {
  const modal = document.getElementById("transferModal");
  if (!modal) return;

  try {
    const user = getCurrentUser();
    const canDirectTransfer = user && (user.role === 'admin' || user.role === 'kitchen_manager' || user.role === 'manager');
    
    const btnDirect = document.getElementById("btnDirectTransfer");
    if (btnDirect) {
      btnDirect.style.display = canDirectTransfer ? 'inline-block' : 'none';
    }

    const [stationsRes, itemsRes] = await Promise.all([
      API("GET", "/api/pos/stations"),
      API("GET", "/api/inventory/items")
    ]);

    allStationsList = stationsRes.data || [];
    allMainIngredients = itemsRes.data || [];

    const stationSel = document.getElementById("transferStation");
    const ingSel = document.getElementById("transferIngredient");

    stationSel.innerHTML = allStationsList.map(s => `
      <option value="${s.id}">📍 سكشن: ${s.station_name} (${s.station_code})</option>
    `).join('');

    ingSel.innerHTML = allMainIngredients.map(i => {
      const typeLabel = i.material_type === 'manufactured' ? '🥫 [مصنّع]' : '🌾 [خام]';
      return `<option value="${i.id}">${typeLabel} ${i.name} — (المتوفر بالمخزن: ${i.quantity} ${i.unit})</option>`;
    }).join('');

    document.getElementById("transferQty").value = "5";
    document.getElementById("transferNotes").value = "";

    modal.style.display = "flex";
    onTransferInputsChanged();
  } catch (e) {
    alert("تعذر فتح نافذة التحويل: " + e.message);
  }
};

window.closeStationTransferModal = function() {
  const modal = document.getElementById("transferModal");
  if (modal) modal.style.display = "none";
};

// حساب التغطية والإنتاجية المتوقعة فورياً
window.onTransferInputsChanged = function() {
  clearTimeout(coverageDebounceTimer);
  coverageDebounceTimer = setTimeout(async () => {
    const stationId = document.getElementById("transferStation").value;
    const ingredientId = document.getElementById("transferIngredient").value;
    const qtyInput = document.getElementById("transferQty").value;
    const quantity = parseFloat(qtyInput);
    const box = document.getElementById("coveragePreviewBox");

    if (!stationId || !ingredientId || isNaN(quantity) || quantity <= 0) {
      if (box) box.style.display = 'none';
      return;
    }

    try {
      const res = await API("POST", "/api/inventory/station-coverage", {
        stationId,
        ingredientId,
        quantity
      });

      if (res.status === "success" && res.data) {
        const d = res.data;
        box.style.display = 'block';

        const badgeHtml = d.materialType === 'manufactured'
          ? `<span style="background:#7c3aed; color:white; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">🥫 مادة مصنعة / تحضير مسبق (Sub-recipe)</span>`
          : `<span style="background:#059669; color:white; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:0.8rem;">🌾 مادة أولية خام (Raw Material)</span>`;

        let coverageHtml = '';
        if (d.recipesCoverage && d.recipesCoverage.length > 0) {
          coverageHtml = `
            <div style="margin-top:8px; border-top:1px solid #334155; padding-top:8px;">
              <div style="font-weight:bold; color:#38bdf8; margin-bottom:6px;">📊 التغطية الإنتاجية المتوقعة لهذه الكمية (${d.requestedQty} ${d.unit}):</div>
              ${d.recipesCoverage.map(c => `
                <div style="background:#1e293b; padding:6px 10px; border-radius:6px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
                  <span>🍽️ <strong>${c.recipe_name}</strong> <small style="color:#94a3b8;">(يستهلك ${c.required_per_portion} ${c.unit})</small></span>
                  <span style="color:#10b981; font-weight:bold; font-size:1rem;">يكفي [ ${c.portions_possible} وجبة ]</span>
                </div>
              `).join('')}
            </div>
          `;
        } else {
          coverageHtml = `
            <div style="margin-top:8px; border-top:1px solid #334155; padding-top:8px; color:#f59e0b; font-size:0.82rem;">
              ⚠️ تنبيه: لا توجد وصفات منسوبة لهذا السكشن تستهلك هذه المادة حالياً! يرجى مراجعة بطاقات الوصفات (Recipe Cards).
            </div>
          `;
        }

        box.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>${badgeHtml} <strong style="color:white; margin-right:6px;">${d.ingredientName}</strong></div>
            <div style="color:#94a3b8; font-size:0.8rem;">المخزن الرئيسي: <span style="color:#cbd5e1; font-weight:bold;">${d.availableMainStock} ${d.unit}</span></div>
          </div>
          ${coverageHtml}
        `;
      }
    } catch (e) {
      console.warn("خطأ في احتساب التغطية:", e);
    }
  }, 250);
};

// تنفيذ التحويل المباشر الفوري (للمدراء)
window.submitStationTransferDirect = async function() {
  const stationId = document.getElementById("transferStation").value;
  const ingredientId = document.getElementById("transferIngredient").value;
  const quantity = parseFloat(document.getElementById("transferQty").value);
  const notes = document.getElementById("transferNotes").value;

  if (!stationId || !ingredientId || !quantity || quantity <= 0) {
    alert("يرجى اختيار السكشن والمادة وإدخال كمية صحيحة");
    return;
  }

  try {
    const res = await API("POST", "/api/inventory/station-transfer", {
      stationId,
      ingredientId,
      quantity,
      notes
    });

    if (res.status === "success") {
      alert("✅ " + res.message);
      closeStationTransferModal();
      loadStationStocks();
      loadTable();
      loadKPIs();
    } else {
      alert("❌ " + (res.message || "فشل التحويل"));
    }
  } catch (e) {
    alert("حدث خطأ أثناء الاتصال: " + e.message);
  }
};

// رفع طلب لمدير المطبخ للاعتماد
window.submitStationTransferRequest = async function() {
  const stationId = document.getElementById("transferStation").value;
  const ingredientId = document.getElementById("transferIngredient").value;
  const quantity = parseFloat(document.getElementById("transferQty").value);
  const notes = document.getElementById("transferNotes").value;

  if (!stationId || !ingredientId || !quantity || quantity <= 0) {
    alert("يرجى اختيار السكشن والمادة وإدخال كمية صحيحة");
    return;
  }

  try {
    const res = await API("POST", "/api/inventory/station-transfer-request", {
      stationId,
      ingredientId,
      quantity,
      notes
    });

    if (res.status === "success") {
      alert("✅ " + (res.message || "تم إرسال الطلب لمدير المطبخ بنجاح"));
      closeStationTransferModal();
      loadStationStocks();
      loadStationRequests();
    } else {
      alert("❌ " + (res.message || "فشل تقديم الطلب"));
    }
  } catch (e) {
    alert("حدث خطأ أثناء الاتصال: " + e.message);
  }
};

// موافقة مدير المطبخ على الطلب
window.approveTransferRequest = async function(requestId) {
  if (!confirm(`هل أنت متأكد من اعتماد وصرف الطلب #${requestId} وخصمه من المخزن الرئيسي إلى عهدة السكشن؟`)) return;

  try {
    const res = await API("POST", `/api/inventory/station-transfer-requests/${requestId}/approve`);
    if (res.status === "success") {
      alert("✅ " + res.message);
      loadStationStocks();
      loadStationRequests();
      loadTable();
      loadKPIs();
    } else {
      alert("❌ " + (res.message || "فشلت الموافقة"));
    }
  } catch (e) {
    alert("حدث خطأ: " + e.message);
  }
};

// رفض طلب الصرف
window.rejectTransferRequest = async function(requestId) {
  const reason = prompt("يرجى كتابة سبب رفض الطلب:");
  if (reason === null) return; // تم الضغط على Cancel

  try {
    const res = await API("POST", `/api/inventory/station-transfer-requests/${requestId}/reject`, { reason });
    if (res.status === "success") {
      alert("✅ تم رفض الطلب بنجاح");
      loadStationRequests();
    } else {
      alert("❌ " + (res.message || "فشل الرفض"));
    }
  } catch (e) {
    alert("حدث خطأ: " + e.message);
  }
};


