/* ======================================================
   HR Dashboard JavaScript
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
  initializeHRDashboard();
});

// تهيئة صفحة HR
function initializeHRDashboard() {
  loadKPIs();
  loadEmployees();
  setupSearch();
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
// تحميل KPIs
// ---------------------------------------------
async function loadKPIs() {
  try {
    const res = await API("GET", "/api/dashboard/employees");
    
    if (res.status === "success" && res.data) {
      const users = res.data;
      const total = users.length;
      const active = users.filter(u => u.is_active === 1 || u.is_active === true).length;
      
      document.getElementById("kpiTotalUsers").textContent = total;
      document.getElementById("kpiActiveUsers").textContent = active;
      
      // جلب عدد الموظفين في العمل اليوم (سيتم إضافته لاحقاً)
      document.getElementById("kpiTodayActive").textContent = "—";
      
      // جلب عدد الإجازات المعلقة (سيتم إضافته لاحقاً)
      document.getElementById("kpiPendingLeaves").textContent = "—";
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل KPIs:", error);
  }
}

// ---------------------------------------------
// تحميل الموظفين
// ---------------------------------------------
async function loadEmployees() {
  try {
    const res = await API("GET", "/api/dashboard/employees");
    const tbody = document.getElementById("employeesTableBody");
    
    if (!tbody) return;
    
    if (res.status === "success" && res.data) {
      const users = res.data;
      
      if (users.length === 0) {
        tbody.innerHTML = "<tr><td colspan='5' class='loading-row'>لا توجد موظفين مسجلين</td></tr>";
        return;
      }
      
      const roleNames = {
        'admin': '👑 مدير عام',
        'manager': '👔 مدير',
        'kitchen_manager': '👨‍🍳 مدير مطبخ',
        'kitchen_employee': '👨‍🍳 موظف مطبخ',
        'employee': '👤 موظف',
        'hr': '👥 موظف موارد بشرية',
        'waiter': '🍽️ ويتر',
        'captain': '👔 كابتن',
        'cleaner': '🧹 عامل نظافة',
        'hall_manager': '🏢 مسؤول صالة',
        'hall_captain': '👔 كابتن صالة',
        'receptionist': '📞 موظف استقبال',
        'garage_employee': '🚗 موظف كراج',
        'garage_manager': '🚗 مسؤول كراج'
      };
      
      tbody.innerHTML = "";
      
      users.forEach(user => {
        const row = document.createElement("tr");
        const status = (user.is_active === 1 || user.is_active === true)
          ? `<span style="color:#00ff88;">✔ نشط</span>`
          : `<span style="color:#ff6b7a;">✗ معطل</span>`;
        
        const date = user.created_at ? new Date(user.created_at) : new Date();
        const dateStr = date.toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
        
        row.innerHTML = `
          <td>${user.full_name || user.username || '—'}</td>
          <td>${user.username || '—'}</td>
          <td>${roleNames[user.role] || user.role || '—'}</td>
          <td>${status}</td>
          <td>${dateStr}</td>
        `;
        
        tbody.appendChild(row);
      });
    } else {
      tbody.innerHTML = `<tr><td colspan='5' class='loading-row'>⚠️ ${res.message || 'خطأ في تحميل البيانات'}</td></tr>`;
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل الموظفين:", error);
    const tbody = document.getElementById("employeesTableBody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan='5' class='loading-row'>⚠️ خطأ في تحميل البيانات</td></tr>`;
    }
  }
}

// ---------------------------------------------
// البحث
// ---------------------------------------------
function setupSearch() {
  const searchInput = document.getElementById("searchInput");
  if (!searchInput) return;
  
  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll("#employeesTableBody tr");
    
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? "" : "none";
    });
  });
}

