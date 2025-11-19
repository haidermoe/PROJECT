/**
 * ======================================================
 * Leaves Management – JavaScript
 * ======================================================
 */

let isAdmin = false;

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
      isAdmin = user.role === 'admin';
      if (isAdmin) {
        document.getElementById('adminSection').style.display = 'block';
      }
    } catch (e) {
      console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
    }
  }

  // ✅ التوكن صحيح - تهيئة الصفحة
  initializeLeaves();
});

// تهيئة صفحة الإجازات
function initializeLeaves() {
  // تحميل الرصيد
  loadLeaveBalance();
  
  // تحميل طلباتي
  loadMyLeaves();
  
  // تحميل جميع الطلبات (للمدير)
  if (isAdmin) {
    loadAllLeaves();
  }

  // حساب عدد الأيام عند تغيير التواريخ
  document.getElementById('startDate')?.addEventListener('change', calculateDays);
  document.getElementById('endDate')?.addEventListener('change', calculateDays);
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
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ API Error:', res.status, errorText);
      return { status: "error", message: `خطأ ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("❌ خطأ في API:", error);
    return { status: "error", message: error.message };
  }
}

// ---------------------------------------------
// تحميل رصيد الإجازات
// ---------------------------------------------
async function loadLeaveBalance() {
  try {
    const res = await API("GET", "/api/leaves/balance");

    if (res.status === "success" && res.data) {
      const { annual, sick } = res.data;

      document.getElementById("annualAvailable").textContent = annual.available.toFixed(1);
      document.getElementById("annualTotal").textContent = annual.total;
      document.getElementById("sickAvailable").textContent = sick.available.toFixed(1);
      document.getElementById("sickTotal").textContent = sick.total;

      // تحديث شريط التقدم
      const annualPercent = (annual.available / annual.total) * 100;
      const sickPercent = (sick.available / sick.total) * 100;

      document.getElementById("annualProgress").style.width = `${annualPercent}%`;
      document.getElementById("sickProgress").style.width = `${sickPercent}%`;
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل الرصيد:", error);
  }
}

// ---------------------------------------------
// تحميل طلباتي
// ---------------------------------------------
async function loadMyLeaves() {
  try {
    const status = document.getElementById("filterStatus")?.value || "";
    let endpoint = "/api/leaves/my-leaves";
    if (status) endpoint += `?status=${status}`;

    const res = await API("GET", endpoint);

    const tbody = document.querySelector("#leavesTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (res.status === "success" && res.data && res.data.length > 0) {
      res.data.forEach((leave) => {
        const row = document.createElement("tr");

        const typeNames = {
          'annual': 'سنوية',
          'sick': 'مرضية',
          'mourning': 'حداد',
          'weekly': 'أسبوعية'
        };

        const statusNames = {
          'pending': 'قيد الانتظار',
          'approved': 'موافق عليها',
          'rejected': 'مرفوضة'
        };

        const startDate = new Date(leave.start_date).toLocaleDateString('ar-EG');
        const endDate = new Date(leave.end_date).toLocaleDateString('ar-EG');

        row.innerHTML = `
          <td>${typeNames[leave.leave_type] || leave.leave_type}</td>
          <td>${startDate}</td>
          <td>${endDate}</td>
          <td>${leave.total_days} يوم</td>
          <td>${leave.reason || '—'}</td>
          <td><span class="status-badge ${leave.status}">${statusNames[leave.status] || leave.status}</span></td>
          <td>${leave.status === 'pending' ? '<button class="btn-action btn-reject" onclick="cancelLeave(' + leave.id + ')">إلغاء</button>' : '—'}</td>
        `;

        tbody.appendChild(row);
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>لا توجد طلبات</td></tr>";
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل طلباتي:", error);
    const tbody = document.querySelector("#leavesTable tbody");
    if (tbody) {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>حدث خطأ في تحميل البيانات</td></tr>";
    }
  }
}

// ---------------------------------------------
// تحميل جميع الطلبات (للمدير)
// ---------------------------------------------
async function loadAllLeaves() {
  try {
    const status = document.getElementById("filterStatus")?.value || "";
    const leaveType = document.getElementById("filterLeaveType")?.value || "";

    let endpoint = "/api/leaves/all-leaves?";
    const params = [];
    if (status) params.push(`status=${status}`);
    if (leaveType) params.push(`leave_type=${leaveType}`);
    if (params.length > 0) endpoint += params.join('&');

    const res = await API("GET", endpoint);

    const tbody = document.querySelector("#allLeavesTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (res.status === "success" && res.data && res.data.length > 0) {
      res.data.forEach((leave) => {
        const row = document.createElement("tr");

        const typeNames = {
          'annual': 'سنوية',
          'sick': 'مرضية',
          'mourning': 'حداد',
          'weekly': 'أسبوعية'
        };

        const statusNames = {
          'pending': 'قيد الانتظار',
          'approved': 'موافق عليها',
          'rejected': 'مرفوضة'
        };

        const startDate = new Date(leave.start_date).toLocaleDateString('ar-EG');
        const endDate = new Date(leave.end_date).toLocaleDateString('ar-EG');
        const employeeName = leave.user?.full_name || leave.user?.username || 'غير معروف';

        row.innerHTML = `
          <td>${employeeName}</td>
          <td>${typeNames[leave.leave_type] || leave.leave_type}</td>
          <td>${startDate}</td>
          <td>${endDate}</td>
          <td>${leave.total_days} يوم</td>
          <td>${leave.reason || '—'}</td>
          <td><span class="status-badge ${leave.status}">${statusNames[leave.status] || leave.status}</span></td>
          <td>
            ${leave.status === 'pending' 
              ? `<button class="btn-action btn-approve" onclick="approveLeave(${leave.id})">✅ موافقة</button>
                 <button class="btn-action btn-reject" onclick="rejectLeave(${leave.id})">❌ رفض</button>`
              : '—'}
          </td>
        `;

        tbody.appendChild(row);
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>لا توجد طلبات</td></tr>";
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل جميع الطلبات:", error);
    const tbody = document.querySelector("#allLeavesTable tbody");
    if (tbody) {
      tbody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>حدث خطأ في تحميل البيانات</td></tr>";
    }
  }
}

// ---------------------------------------------
// فتح نافذة طلب إجازة
// ---------------------------------------------
function openRequestModal() {
  const modal = document.getElementById("requestModal");
  if (modal) {
    modal.classList.add("active");
    // تعيين تاريخ اليوم كحد أدنى
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("startDate").min = today;
    document.getElementById("endDate").min = today;
  }
}

// ---------------------------------------------
// إغلاق نافذة طلب إجازة
// ---------------------------------------------
function closeRequestModal() {
  const modal = document.getElementById("requestModal");
  if (modal) {
    modal.classList.remove("active");
    // مسح الحقول
    document.getElementById("leaveType").value = "";
    document.getElementById("startDate").value = "";
    document.getElementById("endDate").value = "";
    document.getElementById("totalDays").value = "";
    document.getElementById("leaveReason").value = "";
  }
}

// ---------------------------------------------
// حساب عدد الأيام
// ---------------------------------------------
function calculateDays() {
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      alert("⚠️ تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
      document.getElementById("endDate").value = "";
      document.getElementById("totalDays").value = "";
      return;
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 لتضمين اليوم الأول والأخير

    document.getElementById("totalDays").value = `${diffDays} يوم`;
  }
}

// ---------------------------------------------
// إرسال طلب إجازة
// ---------------------------------------------
async function submitLeaveRequest() {
  try {
    const leaveType = document.getElementById("leaveType").value;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    const reason = document.getElementById("leaveReason").value.trim();

    if (!leaveType || !startDate || !endDate) {
      alert("⚠️ يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const res = await API("POST", "/api/leaves/request", {
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason: reason || null
    });

    if (res.status === "success") {
      alert("✅ تم إرسال طلب الإجازة بنجاح!");
      closeRequestModal();
      loadLeaveBalance();
      loadMyLeaves();
      if (isAdmin) {
        loadAllLeaves();
      }
    } else {
      alert("❌ خطأ: " + (res.message || "حدث خطأ أثناء إرسال الطلب"));
    }
  } catch (error) {
    console.error("❌ خطأ في إرسال طلب الإجازة:", error);
    alert("❌ حدث خطأ: " + error.message);
  }
}

// ---------------------------------------------
// الموافقة على طلب إجازة (للمدير)
// ---------------------------------------------
async function approveLeave(id) {
  if (!confirm("هل أنت متأكد من الموافقة على هذا الطلب؟")) {
    return;
  }

  try {
    const res = await API("POST", `/api/leaves/approve/${id}`, {});

    if (res.status === "success") {
      alert("✅ تم الموافقة على طلب الإجازة");
      loadAllLeaves();
      loadMyLeaves();
    } else {
      alert("❌ خطأ: " + (res.message || "حدث خطأ أثناء الموافقة"));
    }
  } catch (error) {
    console.error("❌ خطأ في الموافقة:", error);
    alert("❌ حدث خطأ: " + error.message);
  }
}

// ---------------------------------------------
// رفض طلب إجازة (للمدير)
// ---------------------------------------------
async function rejectLeave(id) {
  const reason = prompt("يرجى إدخال سبب الرفض:");
  if (!reason || reason.trim() === "") {
    alert("⚠️ يجب إدخال سبب الرفض");
    return;
  }

  try {
    const res = await API("POST", `/api/leaves/approve/${id}`, {
      rejection_reason: reason
    });

    if (res.status === "success") {
      alert("✅ تم رفض طلب الإجازة");
      loadAllLeaves();
      loadMyLeaves();
    } else {
      alert("❌ خطأ: " + (res.message || "حدث خطأ أثناء الرفض"));
    }
  } catch (error) {
    console.error("❌ خطأ في الرفض:", error);
    alert("❌ حدث خطأ: " + error.message);
  }
}

// ---------------------------------------------
// إلغاء طلب إجازة
// ---------------------------------------------
async function cancelLeave(id) {
  if (!confirm("هل أنت متأكد من إلغاء هذا الطلب؟")) {
    return;
  }

  // يمكن إضافة API endpoint لإلغاء الطلب لاحقاً
  alert("⚠️ ميزة الإلغاء قيد التطوير");
}

// ---------------------------------------------
// تطبيق الفلاتر
// ---------------------------------------------
function applyFilters() {
  loadMyLeaves();
  if (isAdmin) {
    loadAllLeaves();
  }
}

// ---------------------------------------------
// مسح الفلاتر
// ---------------------------------------------
function clearFilters() {
  document.getElementById("filterStatus").value = "";
  document.getElementById("filterLeaveType").value = "";
  loadMyLeaves();
  if (isAdmin) {
    loadAllLeaves();
  }
}

