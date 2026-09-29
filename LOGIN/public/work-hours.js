/**
 * ======================================================
 * Work Hours Management – JavaScript (للمدير)
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
      if (regularEmployeeRoles.includes(user.role)) {
        window.location.replace("/attendance.html");
        return;
      }
      
      if (user.role !== 'admin' && user.role !== 'hr') {
        alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة (مدير عام أو موارد بشرية)');
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
  initializeWorkHours();
});

// تهيئة صفحة ساعات العمل
function initializeWorkHours() {
  // تحميل قائمة الموظفين
  loadEmployeesList();
  
  // تحميل البيانات
  loadWorkHours();
  
  // تحميل أحدث البصمات
  loadRecentAttendance();
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
// تحميل قائمة الموظفين
// ---------------------------------------------
async function loadEmployeesList() {
  try {
    const res = await API("GET", "/auth/users");
    
    if (res.status === "success" && res.users) {
      const select = document.getElementById("filterEmployee");
      if (select) {
        select.innerHTML = '<option value="">الكل</option>';
        res.users.forEach(user => {
          const option = document.createElement("option");
          option.value = user.id;
          option.textContent = user.full_name || user.username;
          select.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل قائمة الموظفين:", error);
  }
}

// ---------------------------------------------
// تحميل ساعات العمل
// ---------------------------------------------
async function loadWorkHours() {
  try {
    const startDate = document.getElementById("filterStartDate")?.value || "";
    const endDate = document.getElementById("filterEndDate")?.value || "";
    const userId = document.getElementById("filterEmployee")?.value || "";

    let endpoint = "/api/attendance/work-hours-stats";
    const params = [];
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    if (params.length > 0) endpoint += "?" + params.join("&");

    const res = await API("GET", endpoint);

    const tbody = document.querySelector("#workHoursTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (res.status === "success" && res.data && res.data.length > 0) {
      let stats = res.data;
      
      // فلترة حسب الموظف
      if (userId) {
        stats = stats.filter(stat => stat.user_id == userId);
      }

      // حساب الإجماليات
      let totalHours = 0;
      let totalEmployees = stats.length;
      let totalDays = 0;

      stats.forEach(stat => {
        totalHours += stat.total_hours || 0;
        totalDays += stat.total_records || 0;
      });

      const avgHours = totalDays > 0 ? (totalHours / totalDays).toFixed(2) : 0;

      document.getElementById("totalEmployees").textContent = totalEmployees;
      document.getElementById("totalHours").textContent = totalHours.toFixed(2);
      document.getElementById("avgHours").textContent = avgHours;

      // عرض البيانات
      stats.forEach((stat) => {
        const row = document.createElement("tr");

        const firstCheckIn = stat.first_check_in 
          ? new Date(stat.first_check_in).toLocaleDateString('ar-EG') 
          : '—';
        const lastCheckOut = stat.last_check_out 
          ? new Date(stat.last_check_out).toLocaleDateString('ar-EG') 
          : '—';

        row.innerHTML = `
          <td>${stat.full_name || stat.username || 'غير معروف'}</td>
          <td>${stat.role || '—'}</td>
          <td>${stat.total_records || 0}</td>
          <td><strong>${(stat.total_hours || 0).toFixed(2)}</strong> ساعة</td>
          <td>${(stat.avg_hours_per_day || 0).toFixed(2)} ساعة</td>
          <td>${firstCheckIn}</td>
          <td>${lastCheckOut}</td>
        `;

        tbody.appendChild(row);
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>لا توجد بيانات</td></tr>";
      document.getElementById("totalEmployees").textContent = "0";
      document.getElementById("totalHours").textContent = "0";
      document.getElementById("avgHours").textContent = "0";
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل ساعات العمل:", error);
    const tbody = document.querySelector("#workHoursTable tbody");
    if (tbody) {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>حدث خطأ في تحميل البيانات</td></tr>";
    }
  }
}

// ---------------------------------------------
// تحميل أحدث البصمات
// ---------------------------------------------
async function loadRecentAttendance() {
  try {
    const res = await API("GET", "/api/attendance/all-records?limit=10");

    const list = document.getElementById("recentAttendance");
    if (!list) return;

    list.innerHTML = "";

    if (res.status === "success" && res.data && res.data.length > 0) {
      res.data.forEach((record) => {
        const li = document.createElement("li");
        const checkInTime = record.check_in_time 
          ? new Date(record.check_in_time).toLocaleString('ar-EG') 
          : '—';
        const employeeName = record.full_name || record.username || 'غير معروف';
        const status = record.status === 'checked_in' ? '✅ دخول' : '🚪 خروج';
        
        li.textContent = `${employeeName} - ${status} - ${checkInTime}`;
        list.appendChild(li);
      });
    } else {
      list.innerHTML = "<li>لا توجد بصمات حديثة</li>";
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل أحدث البصمات:", error);
  }
}

// ---------------------------------------------
// تطبيق الفلاتر
// ---------------------------------------------
function applyFilters() {
  loadWorkHours();
  loadRecentAttendance();
}

// ---------------------------------------------
// مسح الفلاتر
// ---------------------------------------------
function clearFilters() {
  document.getElementById("filterStartDate").value = "";
  document.getElementById("filterEndDate").value = "";
  document.getElementById("filterEmployee").value = "";
  loadWorkHours();
  loadRecentAttendance();
}

