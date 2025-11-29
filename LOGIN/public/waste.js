/**
 * ======================================================
 * Waste Management – JavaScript
 * ======================================================
 */

// التحقق من التوكن عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async function() {
  // التأكد من أن requireAuth متاحة
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة! تأكد من تحميل auth-check.js');
    window.location.replace("/index.html?error=login_required");
    return;
  }

  // استخدام دالة التحقق الموحدة
  const authValid = await requireAuth();
  
  if (!authValid) {
    return;
  }

  // التحقق من الصلاحيات
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      const userRole = user.role;

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
      
      // الموظفون العاديون يوجهون إلى البصمة
      if (regularEmployeeRoles.includes(userRole)) {
        window.location.replace("/attendance.html");
        return;
      }
      
      // فقط مدير المطبخ والمدير العام يمكنهم الوصول
      if (userRole !== 'kitchen_manager' && userRole !== 'admin' && userRole !== 'manager') {
        alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
        window.location.href = "/dashboard/dashboard.html";
        return;
      }
    } catch (e) {
      console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
      window.location.href = "/index.html?error=login_required";
      return;
    }
  }

  // ✅ التوكن صحيح والصلاحيات كافية - تهيئة الصفحة
  initializeWaste();
});

// تهيئة صفحة الهدر
function initializeWaste() {
  // إعداد event listeners
  setupListeners();
  
  // تحميل البيانات
  loadWastePage();
  
  // تعيين تاريخ اليوم كافتراضي
  const wasteDateInput = document.getElementById("wasteDate");
  if (wasteDateInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    wasteDateInput.value = now.toISOString().slice(0, 16);
  }
}

// ---------------------------------------------
// API Helper
// ---------------------------------------------
async function API(method, endpoint, body = null) {
  const token = localStorage.getItem("token");
  
  if (!token) {
    console.error("❌ لا يوجد توكن");
    alert("جلسة منتهية. يرجى تسجيل الدخول مرة أخرى");
    window.location.href = "/index.html";
    return { status: "error", message: "لا يوجد توكن" };
  }

  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  };
  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(endpoint, config);
    
    // التحقق من نوع المحتوى
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      console.error('❌ API Error: Response is not JSON:', res.status, text.substring(0, 200));
      return { status: "error", message: `خطأ ${res.status}: استجابة غير صحيحة من السيرفر` };
    }
    
    const data = await res.json();
    
    if (!res.ok) {
      console.error('❌ API Error:', res.status, data);
      return { status: "error", message: data.message || `خطأ ${res.status}: ${res.statusText}` };
    }
    
    return data;
  } catch (error) {
    console.error("❌ خطأ في API:", error);
    return { status: "error", message: error.message || "خطأ في الاتصال بالسيرفر" };
  }
}

// ---------------------------------------------
// إعداد Event Listeners
// ---------------------------------------------
function setupListeners() {
  // زر إضافة هدر
  const addWasteBtn = document.getElementById("addWasteBtn");
  if (addWasteBtn) {
    addWasteBtn.addEventListener("click", () => {
      openAddWasteModal();
    });
  }

  // زر إلغاء
  const cancelWaste = document.getElementById("cancelWaste");
  if (cancelWaste) {
    cancelWaste.addEventListener("click", () => {
      const modal = document.getElementById("addWasteModal");
      if (modal) {
        modal.classList.remove("active");
        clearWasteForm();
      }
    });
  }

  // إغلاق modal عند النقر خارجها
  const addWasteModal = document.getElementById("addWasteModal");
  if (addWasteModal) {
    addWasteModal.addEventListener("click", (e) => {
      if (e.target === addWasteModal) {
        addWasteModal.classList.remove("active");
      }
    });
  }
}

// ---------------------------------------------
// تحميل صفحة الهدر
// ---------------------------------------------
async function loadWastePage() {
  await Promise.all([
    loadKPIs(),
    loadTable(),
    loadRecentWaste()
  ]);
}

// ---------------------------------------------
// KPI Cards
// ---------------------------------------------
async function loadKPIs() {
  try {
    const res = await API("GET", "/api/waste/stats");
    
    if (res.status === "success" && res.data) {
      document.getElementById("kpiTotalRecords").textContent = res.data.total_records || 0;
      document.getElementById("kpiTotalQuantity").textContent = (res.data.total_quantity || 0).toFixed(2);
      document.getElementById("kpiPending").textContent = res.data.pending_count || 0;
      document.getElementById("kpiApproved").textContent = res.data.approved_count || 0;
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل KPIs:", error);
  }
}

// ---------------------------------------------
// جدول الهدر
// ---------------------------------------------
async function loadTable() {
  try {
    const startDate = document.getElementById("filterStartDate")?.value || "";
    const endDate = document.getElementById("filterEndDate")?.value || "";
    const status = document.getElementById("filterStatus")?.value || "";
    const wasteType = document.getElementById("filterWasteType")?.value || "";

    let endpoint = "/api/waste?limit=100";
    if (startDate) endpoint += `&start_date=${startDate}`;
    if (endDate) endpoint += `&end_date=${endDate}`;
    if (status) endpoint += `&status=${status}`;
    if (wasteType) endpoint += `&waste_type=${wasteType}`;

    const res = await API("GET", endpoint);

    const tbody = document.querySelector("#wasteTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (res.status === "success" && res.data && res.data.length > 0) {
      const user = getCurrentUser();
      const isAdmin = user && user.role === 'admin';

      res.data.forEach((waste) => {
        const row = document.createElement("tr");

        const wasteTypeNames = {
          'spoilage': 'تلف',
          'expired': 'منتهي الصلاحية',
          'damaged': 'تالف',
          'overproduction': 'إنتاج زائد',
          'other': 'أخرى'
        };

        const statusNames = {
          'pending': '<span class="status-pending">⏳ في انتظار الموافقة</span>',
          'approved': '<span class="status-approved">✅ موافق عليها</span>',
          'rejected': '<span class="status-rejected">❌ مرفوضة</span>',
          'cancelled': '<span class="status-cancelled">🚫 ملغاة</span>'
        };

        const wasteDate = waste.waste_date 
          ? new Date(waste.waste_date) 
          : null;
        const dateStr = wasteDate ? wasteDate.toLocaleString('ar-EG') : '—';

        let actionButtons = '';
        const currentUserId = user?.id;
        const isOwner = waste.recorded_by === currentUserId;
        
        // زر الإلغاء للمستخدم نفسه إذا كان الطلب pending
        if (isOwner && waste.status === 'pending') {
          actionButtons = `
            <button class="btn-mini cancel" onclick="cancelWaste(${waste.id})" title="إلغاء">🚫</button>
          `;
        }
        
        // أزرار الموافقة/الرفض للمدير العام
        if (isAdmin && waste.status === 'pending') {
          actionButtons += `
            <button class="btn-mini approve" onclick="approveWaste(${waste.id}, 'approve')" title="موافقة">✅</button>
            <button class="btn-mini reject" onclick="approveWaste(${waste.id}, 'reject')" title="رفض">❌</button>
          `;
        }

        row.innerHTML = `
          <td>${waste.item_name || '—'}</td>
          <td>${waste.quantity || '—'} ${waste.unit || ''}</td>
          <td>${wasteTypeNames[waste.waste_type] || waste.waste_type || '—'}</td>
          <td>${waste.reason || '—'}</td>
          <td>${dateStr}</td>
          <td>${waste.recorded_by_name || 'غير معروف'}</td>
          <td>${statusNames[waste.status] || '—'}</td>
          <td style="text-align:center;">${actionButtons}</td>
        `;

        tbody.appendChild(row);
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>لا توجد سجلات هدر</td></tr>";
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل سجلات الهدر:", error);
    const tbody = document.querySelector("#wasteTable tbody");
    if (tbody) {
      tbody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>حدث خطأ في تحميل البيانات</td></tr>";
    }
  }
}

// ---------------------------------------------
// آخر السجلات
// ---------------------------------------------
async function loadRecentWaste() {
  try {
    const res = await API("GET", "/api/waste?limit=5");

    const list = document.getElementById("recentWaste");
    if (!list) return;

    list.innerHTML = "";

    if (res.status === "success" && res.data && res.data.length > 0) {
      res.data.forEach((waste) => {
        const li = document.createElement("li");
        const date = waste.waste_date 
          ? new Date(waste.waste_date).toLocaleDateString('ar-EG') 
          : '—';
        li.textContent = `${waste.item_name || '—'} - ${waste.quantity} ${waste.unit || ''} - ${date}`;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = "<li>لا توجد سجلات حديثة</li>";
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل آخر السجلات:", error);
  }
}

// ---------------------------------------------
// فتح modal إضافة هدر
// ---------------------------------------------
function openAddWasteModal() {
  const modal = document.getElementById("addWasteModal");
  if (modal) {
    modal.classList.add("active");
    
    // التركيز على حقل الاسم
    setTimeout(() => {
      const nameInput = document.getElementById("wasteItemName");
      if (nameInput) {
        nameInput.focus();
      }
    }, 100);
  }
}

// ---------------------------------------------
// معالجة إضافة هدر
// ---------------------------------------------
async function handleAddWaste() {
  try {
    const itemName = document.getElementById("wasteItemName").value.trim();
    const quantity = document.getElementById("wasteQuantity").value.trim();
    const unit = document.getElementById("wasteUnit").value.trim();
    const wasteType = document.getElementById("wasteType").value;
    const reason = document.getElementById("wasteReason").value.trim();
    const wasteDate = document.getElementById("wasteDate").value;
    const notes = document.getElementById("wasteNotes").value.trim();

    // التحقق من الحقول المطلوبة
    if (!itemName || !quantity || !wasteType || !reason || !wasteDate) {
      alert("⚠️ يرجى إدخال جميع الحقول المطلوبة");
      return;
    }

    // تعطيل الزر أثناء المعالجة
    const saveBtn = document.getElementById("saveWaste");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "⏳ جاري التسجيل...";
    }

    console.log("📤 إرسال طلب تسجيل الهدر");

    const res = await API("POST", "/api/waste", {
      item_name: itemName,
      quantity: parseFloat(quantity),
      unit: unit || null,
      waste_type: wasteType,
      reason: reason,
      waste_date: wasteDate,
      notes: notes || null
    });

    console.log("📥 استجابة السيرفر:", res);

    if (res.status === "success") {
      // إغلاق modal
      const modal = document.getElementById("addWasteModal");
      if (modal) {
        modal.classList.remove("active");
      }

      // مسح الحقول
      clearWasteForm();

      alert("✅ تم تسجيل الهدر بنجاح وتم إرساله للمدير العام للموافقة!");

      // إعادة تحميل البيانات
      await loadWastePage();
    } else {
      const errorMsg = res.message || "حدث خطأ أثناء تسجيل الهدر";
      console.error("❌ خطأ من السيرفر:", errorMsg);
      alert("❌ خطأ: " + errorMsg);
      
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "✅ تسجيل الهدر";
      }
    }
  } catch (error) {
    console.error("❌ خطأ في تسجيل الهدر:", error);
    alert("❌ حدث خطأ في الاتصال بالسيرفر: " + error.message);
    
    const saveBtn = document.getElementById("saveWaste");
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "✅ تسجيل الهدر";
    }
  }
}

// ---------------------------------------------
// الموافقة/رفض الهدر (المدير العام فقط)
// ---------------------------------------------
// ---------------------------------------------
// إلغاء طلب هدر
// ---------------------------------------------
async function cancelWaste(id) {
  if (!confirm("هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إرسال إشعار للمدير العام.")) {
    return;
  }

  try {
    console.log('🔵 cancelWaste: محاولة إلغاء السجل:', id);
    const endpoint = `/api/waste/${id}/cancel`;
    console.log('🔵 cancelWaste: Endpoint:', endpoint);
    const res = await API("POST", endpoint, {});

    console.log('📥 cancelWaste: استجابة API:', res);

    if (res && res.status === "success") {
      alert("✅ تم إلغاء طلب الهدر بنجاح");
      loadTable();
    } else {
      const errorMsg = res?.message || "حدث خطأ أثناء الإلغاء";
      console.error("❌ cancelWaste: خطأ من API:", errorMsg);
      alert("❌ خطأ: " + errorMsg);
    }
  } catch (error) {
    console.error("❌ خطأ في الإلغاء:", error);
    console.error("❌ تفاصيل الخطأ:", error.message);
    alert("❌ حدث خطأ في الاتصال بالسيرفر: " + (error.message || "خطأ غير معروف"));
  }
}

// ---------------------------------------------
// الموافقة/رفض الهدر (للمدير)
// ---------------------------------------------
async function approveWaste(id, action) {
  try {
    if (!confirm(action === 'approve' ? 'هل أنت متأكد من الموافقة على هذا الهدر؟' : 'هل أنت متأكد من رفض هذا الهدر؟')) {
      return;
    }

    const res = await API("PUT", `/api/waste/${id}/approve`, { action });

    if (res.status === "success") {
      alert(action === 'approve' ? "✅ تم الموافقة على الهدر" : "✅ تم رفض الهدر");
      await loadWastePage();
    } else {
      alert("❌ خطأ: " + (res.message || "حدث خطأ"));
    }
  } catch (error) {
    console.error("❌ خطأ في الموافقة/الرفض:", error);
    alert("❌ حدث خطأ: " + error.message);
  }
}

// ---------------------------------------------
// مسح نموذج الهدر
// ---------------------------------------------
function clearWasteForm() {
  document.getElementById("wasteItemName").value = "";
  document.getElementById("wasteQuantity").value = "";
  document.getElementById("wasteUnit").value = "";
  document.getElementById("wasteType").value = "";
  document.getElementById("wasteReason").value = "";
  document.getElementById("wasteNotes").value = "";
  
  // تعيين تاريخ اليوم
  const wasteDateInput = document.getElementById("wasteDate");
  if (wasteDateInput) {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    wasteDateInput.value = now.toISOString().slice(0, 16);
  }
}

// ---------------------------------------------
// تطبيق الفلاتر
// ---------------------------------------------
function applyFilters() {
  loadTable();
  loadKPIs();
}

// ---------------------------------------------
// مسح الفلاتر
// ---------------------------------------------
function clearFilters() {
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  document.getElementById("filterStatus").value = "";
  document.getElementById("filterWasteType").value = "";
  loadTable();
  loadKPIs();
}

// ---------------------------------------------
// دالة مساعدة لجلب المستخدم الحالي
// ---------------------------------------------
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

