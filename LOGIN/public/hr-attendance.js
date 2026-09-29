/* ======================================================
   HR Attendance JavaScript
====================================================== */

// التحقق من التوكن عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async function() {
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة! تأكد من تحميل auth-check.js');
    window.location.replace("/index.html?error=login_required");
    return;
  }

  const authValid = await requireAuth();
  
  if (!authValid) {
    return;
  }

  // التحقق من الصلاحيات - فقط HR يمكنه الوصول
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user.role !== 'hr') {
        alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
        window.location.href = "/attendance.html";
        return;
      }
    } catch (e) {
      console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
      window.location.href = "/index.html?error=login_required";
      return;
    }
  }

  // تهيئة الصفحة
  initializeHRAttendance();
});

// تهيئة صفحة البصمات
function initializeHRAttendance() {
  loadEmployees();
  setDefaultDates();
  loadAttendance();
}

// تعيين التواريخ الافتراضية (هذا الشهر)
function setDefaultDates() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  document.getElementById('startDate').value = firstDay.toISOString().split('T')[0];
  document.getElementById('endDate').value = lastDay.toISOString().split('T')[0];
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
async function loadEmployees() {
  try {
    const res = await API("GET", "/api/dashboard/employees");
    const select = document.getElementById("employeeFilter");
    
    if (!select) return;
    
    if (res.status === "success" && res.data) {
      res.data.forEach(employee => {
        const option = document.createElement("option");
        option.value = employee.id;
        option.textContent = employee.full_name || employee.username;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل الموظفين:", error);
  }
}

// ---------------------------------------------
// تحميل سجلات البصمة
// ---------------------------------------------
async function loadAttendance() {
  try {
    const employeeId = document.getElementById("employeeFilter").value;
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    
    let endpoint = "/api/attendance/all?";
    const params = [];
    
    if (employeeId) {
      params.push(`user_id=${employeeId}`);
    }
    if (startDate) {
      params.push(`start_date=${startDate}`);
    }
    if (endDate) {
      params.push(`end_date=${endDate}`);
    }
    
    endpoint += params.join("&");
    
    const res = await API("GET", endpoint);
    const tbody = document.getElementById("attendanceTableBody");
    
    if (!tbody) return;
    
    if (res.status === "success" && res.data) {
      const records = res.data;
      
      if (records.length === 0) {
        tbody.innerHTML = "<tr><td colspan='6' class='loading-row'>لا توجد سجلات</td></tr>";
        calculateSummary([]);
        return;
      }
      
      tbody.innerHTML = "";
      
      let totalHours = 0;
      let workDaysCount = 0;
      
      records.forEach(record => {
        const row = document.createElement("tr");
        
        const checkIn = record.check_in_time ? new Date(record.check_in_time) : null;
        const checkOut = record.check_out_time ? new Date(record.check_out_time) : null;
        
        const checkInTime = checkIn ? checkIn.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—';
        const checkOutTime = checkOut ? checkOut.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—';
        const date = checkIn ? checkIn.toLocaleDateString('ar-EG') : '—';
        
        const hours = record.work_hours ? parseFloat(record.work_hours).toFixed(2) : '—';
        if (record.work_hours) {
          totalHours += parseFloat(record.work_hours);
          workDaysCount++;
        }
        
        const status = record.status === 'checked_out' 
          ? '<span style="color:#00ff88;">✔ مكتمل</span>'
          : '<span style="color:#ffa500;">⏳ في العمل</span>';
        
        row.innerHTML = `
          <td>${record.full_name || record.username || '—'}</td>
          <td>${date}</td>
          <td>${checkInTime}</td>
          <td>${checkOutTime}</td>
          <td>${hours} ساعة</td>
          <td>${status}</td>
        `;
        
        tbody.appendChild(row);
      });
      
      calculateSummary(records);
      loadEmployeeHoursSummary(records);
    } else {
      tbody.innerHTML = `<tr><td colspan='6' class='loading-row'>⚠️ ${res.message || 'خطأ في تحميل البيانات'}</td></tr>`;
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل البصمات:", error);
    const tbody = document.getElementById("attendanceTableBody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan='6' class='loading-row'>⚠️ خطأ في تحميل البيانات</td></tr>`;
    }
  }
}

// حساب الملخص
function calculateSummary(records) {
  let totalHours = 0;
  let workDaysCount = 0;
  
  records.forEach(record => {
    if (record.work_hours) {
      totalHours += parseFloat(record.work_hours);
      workDaysCount++;
    }
  });
  
  const avgHours = workDaysCount > 0 ? (totalHours / workDaysCount).toFixed(2) : 0;
  
  document.getElementById("totalHoursMonth").textContent = totalHours.toFixed(2) + " ساعة";
  document.getElementById("avgHoursDay").textContent = avgHours + " ساعة";
  document.getElementById("workDays").textContent = workDaysCount + " يوم";
}

// تحميل ملخص ساعات العمل لكل موظف
function loadEmployeeHoursSummary(records) {
  const employeeHours = {};
  
  records.forEach(record => {
    const employeeId = record.user_id;
    const employeeName = record.full_name || record.username || 'غير معروف';
    
    if (!employeeHours[employeeId]) {
      employeeHours[employeeId] = {
        name: employeeName,
        totalHours: 0
      };
    }
    
    if (record.work_hours) {
      employeeHours[employeeId].totalHours += parseFloat(record.work_hours);
    }
  });
  
  const container = document.getElementById("employeeHoursList");
  if (!container) return;
  
  if (Object.keys(employeeHours).length === 0) {
    container.innerHTML = "<div class='loading-row'>لا توجد بيانات</div>";
    return;
  }
  
  container.innerHTML = "";
  
  Object.values(employeeHours)
    .sort((a, b) => b.totalHours - a.totalHours)
    .forEach(emp => {
      const item = document.createElement("div");
      item.className = "employee-hours-item";
      item.innerHTML = `
        <div class="employee-name">${emp.name}</div>
        <div class="hours-value">${emp.totalHours.toFixed(2)} ساعة</div>
      `;
      container.appendChild(item);
    });
}



