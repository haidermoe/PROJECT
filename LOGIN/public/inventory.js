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
  
  if (itemName) itemName.value = "";
  if (itemUnit) itemUnit.value = "";
  if (itemQty) itemQty.value = "";
  if (itemMin) itemMin.value = "";
}

// معالجة إضافة مادة
async function handleAddItem() {
  const name = document.getElementById("itemName")?.value.trim();
  const unit = document.getElementById("itemUnit")?.value.trim();
  const qty = Number(document.getElementById("itemQty")?.value);
  const min = Number(document.getElementById("itemMin")?.value);

  if (!name || !unit || !qty || !min) {
    alert("يرجى ملء جميع الحقول");
    return;
  }

  try {
    const res = await API("POST", "/api/inventory/add", {
      name,
      unit,
      quantity: qty,
      min_qty: min
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

    // الموظف: فقط أزرار السحب والإيداع
    const actionButtons = isEmployee
      ? `
        <button class="btn-mini plus" onclick="openDeposit(${item.id})">➕</button>
        <button class="btn-mini minus" onclick="openWithdraw(${item.id})">➖</button>
      `
      : `
        <button class="btn-mini edit" onclick="openEdit(${item.id})">✏</button>
        <button class="btn-mini plus" onclick="openDeposit(${item.id})">➕</button>
        <button class="btn-mini minus" onclick="openWithdraw(${item.id})">➖</button>
        <button class="btn-mini delete" onclick="deleteItem(${item.id})">🗑</button>
      `;

    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.unit}</td>
      <td>${item.quantity}</td>
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

// تعديل مادة
async function openEdit(id) {
  try {
    const res = await API("GET", "/api/inventory/items");
    const item = res.data.find(i => i.id === id);
    
    if (!item) {
      alert("المادة غير موجودة");
      return;
    }

    const name = prompt("اسم المادة:", item.name);
    if (!name) return;

    const unit = prompt("الوحدة:", item.unit);
    if (!unit) return;

    const quantity = prompt("الكمية:", item.quantity);
    if (!quantity || isNaN(quantity)) {
      alert("الكمية يجب أن تكون رقماً");
      return;
    }

    const editRes = await API("PUT", `/api/inventory/edit/${id}`, {
    name,
    unit,
      quantity: parseFloat(quantity)
    });

    if (editRes.status === "success") {
      loadInventoryPage();
    } else {
      alert(editRes.message || "حدث خطأ أثناء التعديل");
    }
  } catch (error) {
    console.error("خطأ في التعديل:", error);
    alert("حدث خطأ في الاتصال بالسيرفر");
  }
}

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
