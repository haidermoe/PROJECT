/* ======================
   حماية تسجيل الدخول - يجب أن يكون أول شيء
====================== */
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

      if (user.role === 'hr') {
        window.location.replace("/hr-dashboard.html");
        return;
      }
    } catch (e) {
      console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
    }
  }

  // ✅ التوكن صحيح - تهيئة الصفحة
  initializeDashboard();
});

// التحقق من أن المستخدم admin لعرض الإشعارات
function shouldLoadNotifications() {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      return user.role === 'admin';
    } catch (e) {
      return false;
    }
  }
  return false;
}

/* ======================
   تهيئة لوحة التحكم (تعمل فقط بعد التحقق من التوكن)
====================== */
function initializeDashboard() {
  // ملاحظة: تسجيل الخروج يتم إدارته من sidebar.js المشترك

  // تحميل بيانات الداشبورد
  loadDashboardData();
  
  // تفعيل التحديث التلقائي لسعر الدولار
  startUsdRateUpdates();
  
  // تفعيل التحديث التلقائي لقائمة الموظفين
  startEmployeesUpdates();
  
  // تحميل الإشعارات (فقط للمدير العام)
  if (shouldLoadNotifications()) {
    console.log('✅ shouldLoadNotifications: true - سيتم تحميل الإشعارات');
    // تأخير بسيط لضمان تحميل DOM
    setTimeout(() => {
      loadNotifications();
      startNotificationsUpdates();
    }, 500);
  } else {
    console.log('ℹ️ shouldLoadNotifications: false - المستخدم ليس admin');
    // إخفاء قسم الإشعارات إذا لم يكن admin
    const panel = document.querySelector('.panel');
    if (panel) {
      const panelHeader = panel.querySelector('.panel-header');
      if (panelHeader) {
        panelHeader.style.display = 'none';
      }
      const notificationsContainer = document.getElementById("notificationsContainer");
      if (notificationsContainer) {
        notificationsContainer.style.display = 'none';
      }
      const panelActions = panel.querySelector('.panel-actions');
      if (panelActions) {
        panelActions.style.display = 'none';
      }
    }
  }
}

// API Helper
async function API(method, endpoint, body = null) {
  const token = localStorage.getItem("token");
  
  if (!token) {
    console.error("❌ لا يوجد توكن");
    return { status: "error", message: "لا يوجد توكن" };
  }
  
  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  };
  if (body) config.body = JSON.stringify(body);

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
    return { status: "error", message: error.message || "خطأ في الاتصال بالسيرفر" };
  }
}

// تحميل بيانات الداشبورد
async function loadDashboardData() {
  try {
    // تحميل KPIs
    await loadKPIs();
    
    // تحميل الرسوم البيانية
    await loadCharts();
    
    // ملاحظة: سعر الدولار والموظفين يتم تحديثهما تلقائياً عبر startUsdRateUpdates() و startEmployeesUpdates()
  } catch (error) {
    console.error("خطأ في تحميل بيانات الداشبورد:", error);
  }
}

// تحميل سعر الدولار من البورصة العراقية
async function loadUsdRate() {
  try {
    const usdRes = await API("GET", "/api/dashboard/usd-rate");
    if (usdRes.status === "success" && usdRes.data) {
      const usdValueEl = document.getElementById("usdValue");
      const usdUpdateTimeEl = document.getElementById("usdUpdateTime");
      
      if (usdValueEl) {
        usdValueEl.textContent = usdRes.data.rate + " د.ع";
      }
      
      if (usdUpdateTimeEl) {
        const updateTime = new Date(usdRes.data.timestamp);
        const timeStr = updateTime.toLocaleTimeString('ar-EG', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });
        usdUpdateTimeEl.textContent = `(${timeStr})`;
      }
      
      console.log("✅ تم تحديث سعر الدولار:", usdRes.data.rate);
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل سعر الدولار:", error);
    const usdValueEl = document.getElementById("usdValue");
    if (usdValueEl) {
      usdValueEl.textContent = "—";
    }
  }
}

// تحميل KPIs
async function loadKPIs() {
  try {
    // مواد قليلة
    const lowStockRes = await API("GET", "/api/dashboard/low-stock");
    if (lowStockRes.status === "success") {
      document.getElementById("lowStockCount").textContent = lowStockRes.data.length || 0;
    }

    // عدد الموظفين
    const empRes = await API("GET", "/api/dashboard/employee-count");
    if (empRes.status === "success") {
      document.getElementById("employeeCount").textContent = empRes.data.count || 0;
    }

    // آخر عملية سحب
    const lastOutRes = await API("GET", "/api/dashboard/last-out");
    if (lastOutRes.status === "success" && lastOutRes.data) {
      const date = new Date(lastOutRes.data.created_at);
      document.getElementById("lastTransaction").textContent = 
        date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    }

    // الكميات المنتجة اليوم (سيتم إضافتها لاحقاً)
    document.getElementById("productionToday").textContent = "0";
  } catch (error) {
    console.error("خطأ في تحميل KPIs:", error);
  }
}

// تحميل الرسوم البيانية
async function loadCharts() {
  try {
    // الهدر اليومي
    const wasteRes = await API("GET", "/api/dashboard/daily-waste");
    if (wasteRes.status === "success") {
      const ctx = document.getElementById("wasteChart");
      if (ctx) {
        new Chart(ctx.getContext("2d"), {
          type: "bar",
          data: {
            labels: ["اليوم"],
            datasets: [{
              label: "الهدر",
              data: [wasteRes.data.length || 0],
              backgroundColor: "rgba(255, 107, 122, 0.5)"
            }]
          }
        });
      }
    }

    // الإنتاج الشهري (سيتم إضافته لاحقاً)
    const prodCtx = document.getElementById("productionChart");
    if (prodCtx) {
      new Chart(prodCtx.getContext("2d"), {
        type: "line",
        data: {
          labels: ["الأسبوع 1", "الأسبوع 2", "الأسبوع 3", "الأسبوع 4"],
          datasets: [{
            label: "الإنتاج",
            data: [0, 0, 0, 0],
            borderColor: "#00ff88"
          }]
        }
      });
    }
  } catch (error) {
    console.error("خطأ في تحميل الرسوم:", error);
  }
}

// تحميل قائمة الموظفين
async function loadEmployees() {
  try {
    console.log('📥 جاري تحميل قائمة الموظفين...');
    const tbody = document.getElementById("employeeTable");
    if (!tbody) {
      console.error('❌ لم يتم العثور على جدول الموظفين');
      return;
    }
    
    const res = await API("GET", "/api/dashboard/employees");
    
    console.log('📥 استجابة API للموظفين:', res);
    
    if (!res) {
      throw new Error('لا توجد استجابة من السيرفر');
    }
    
    if (res.status === "error") {
      throw new Error(res.message || 'خطأ في جلب قائمة الموظفين');
    }
    
    if (res.status === "success") {
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        tbody.innerHTML = "";
        
        res.data.forEach((employee, index) => {
          const row = document.createElement("tr");
          
          // اسم الموظف
          const nameCell = document.createElement("td");
          nameCell.textContent = employee.full_name || employee.username;
          
          // الدور
          const roleCell = document.createElement("td");
          roleCell.textContent = employee.role;
          
          // مرات الدخول (مؤقتاً - سيتم إضافتها لاحقاً)
          const loginCountCell = document.createElement("td");
          loginCountCell.textContent = "—";
          
          // آخر دخول (مؤقتاً - سيتم إضافتها لاحقاً)
          const lastLoginCell = document.createElement("td");
          if (employee.created_at) {
            const date = new Date(employee.created_at);
            lastLoginCell.textContent = date.toLocaleDateString('ar-EG', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
          } else {
            lastLoginCell.textContent = "—";
          }
          
          row.appendChild(nameCell);
          row.appendChild(roleCell);
          row.appendChild(loginCountCell);
          row.appendChild(lastLoginCell);
          
          tbody.appendChild(row);
        });
        
        console.log('✅ تم تحميل', res.data.length, 'موظف');
      } else {
        tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:#707789;'>لا توجد موظفين نشطين</td></tr>";
        console.log('⚠️ لا توجد موظفين للعرض');
      }
    } else {
      throw new Error('استجابة غير متوقعة من السيرفر');
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل الموظفين:", error);
    console.error("❌ تفاصيل الخطأ:", error.message);
    const tbody = document.getElementById("employeeTable");
    if (tbody) {
      const errorMsg = error.message || 'خطأ في تحميل البيانات';
      tbody.innerHTML = `<tr><td colspan='4' style='text-align:center; color:#ff6b7a;'>⚠️ ${errorMsg}</td></tr>`;
    }
  }
}

// تحديث سعر الدولار كل دقيقة (60000 مللي ثانية)
let usdRateInterval = null;

function startUsdRateUpdates() {
  // تحديث فوري عند التحميل
  loadUsdRate();
  
  // تحديث كل دقيقة
  if (usdRateInterval) {
    clearInterval(usdRateInterval);
  }
  
  usdRateInterval = setInterval(() => {
    loadUsdRate();
  }, 60000); // 60 ثانية = 60000 مللي ثانية
  
  console.log("✅ تم تفعيل التحديث التلقائي لسعر الدولار (كل دقيقة)");
}

// تحديث قائمة الموظفين كل 30 ثانية (30000 مللي ثانية)
let employeesInterval = null;

function startEmployeesUpdates() {
  // تحديث فوري عند التحميل
  loadEmployees();
  
  // تحديث كل 30 ثانية
  if (employeesInterval) {
    clearInterval(employeesInterval);
  }
  
  employeesInterval = setInterval(() => {
    console.log('🔄 تحديث قائمة الموظفين...');
    loadEmployees();
  }, 30000); // 30 ثانية = 30000 مللي ثانية
  
  console.log("✅ تم تفعيل التحديث التلقائي لقائمة الموظفين (كل 30 ثانية)");
}

// ===============================
// تحميل الإشعارات
// ===============================
async function loadNotifications() {
  try {
    const container = document.getElementById("notificationsContainer");
    if (!container) {
      console.warn("⚠️ notificationsContainer غير موجود");
      return;
    }

    console.log('🔵 جاري تحميل الإشعارات...');
    const res = await API("GET", "/api/notifications?unread_only=true&limit=5");
    
    console.log('📥 استجابة API للإشعارات:', res);
    
    if (!res) {
      throw new Error('لا توجد استجابة من السيرفر');
    }
    
    if (res.status === "error") {
      console.error('❌ خطأ من API:', res.message);
      container.innerHTML = `<div class="empty-notifications">⚠️ ${res.message || 'حدث خطأ في تحميل الإشعارات'}</div>`;
      updateNotificationCount(0);
      return;
    }
    
    if (res.status === "success" && res.data) {
      if (Array.isArray(res.data) && res.data.length > 0) {
        container.innerHTML = "";
        
        res.data.forEach(notification => {
          const item = createNotificationItem(notification);
          container.appendChild(item);
        });
        
        // تحديث العداد
        updateNotificationCount(res.data.length);
        console.log('✅ تم تحميل', res.data.length, 'إشعار');
      } else {
        container.innerHTML = '<div class="empty-notifications">لا توجد إشعارات جديدة</div>';
        updateNotificationCount(0);
        console.log('ℹ️ لا توجد إشعارات جديدة');
      }
    } else {
      console.warn('⚠️ استجابة غير متوقعة:', res);
      container.innerHTML = '<div class="empty-notifications">لا توجد إشعارات جديدة</div>';
      updateNotificationCount(0);
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل الإشعارات:", error);
    console.error("❌ تفاصيل الخطأ:", error.message);
    console.error("❌ Stack:", error.stack);
    const container = document.getElementById("notificationsContainer");
    if (container) {
      container.innerHTML = `<div class="empty-notifications">❌ حدث خطأ: ${error.message || 'خطأ غير معروف'}</div>`;
    }
    updateNotificationCount(0);
  }
}

// إنشاء عنصر إشعار
function createNotificationItem(notification) {
  const item = document.createElement("div");
  item.className = "notification-item-dashboard";
  item.style.cssText = `
    padding: 10px;
    margin-bottom: 8px;
    background: rgba(0, 255, 136, 0.08);
    border: 1px solid rgba(0, 255, 136, 0.2);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  `;
  
  item.onmouseover = () => {
    item.style.background = 'rgba(0, 255, 136, 0.12)';
  };
  item.onmouseout = () => {
    item.style.background = 'rgba(0, 255, 136, 0.08)';
  };
  item.onclick = () => {
    window.location.href = '/notifications.html';
  };
  
  const typeNames = {
    'waste_request': '🗑️ طلب هدر',
    'leave_request': '📅 طلب إجازة'
  };
  
  const typeName = typeNames[notification.type] || notification.type;
  const date = new Date(notification.created_at);
  const dateStr = date.toLocaleString('ar-EG', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  item.innerHTML = `
    <div style="font-size: 0.85rem; font-weight: 600; color: #00ff88; margin-bottom: 4px;">
      ${notification.title}
    </div>
    <div style="font-size: 0.75rem; color: #c6cad3; margin-bottom: 4px; line-height: 1.4;">
      ${notification.message || ''}
    </div>
    <div style="font-size: 0.7rem; color: #9ba3b5; display: flex; justify-content: space-between; align-items: center;">
      <span>${typeName}</span>
      <span>${dateStr}</span>
    </div>
  `;
  
  return item;
}

// تحديث عداد الإشعارات
function updateNotificationCount(count) {
  const badge = document.getElementById("notificationCount");
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

// تحديد الكل كمقروء
async function markAllNotificationsRead() {
  try {
    const res = await API("GET", '/api/notifications?unread_only=true');
    
    if (res.status === "success" && res.data && res.data.length > 0) {
      const promises = res.data.map(notification => 
        API("PATCH", `/api/notifications/${notification.id}/read`)
      );
      
      await Promise.all(promises);
      loadNotifications();
    } else {
      alert("لا توجد إشعارات غير مقروءة");
    }
  } catch (error) {
    console.error("❌ خطأ في تحديد الكل كمقروء:", error);
    alert("❌ حدث خطأ في الاتصال بالسيرفر");
  }
}

// تحديث الإشعارات كل 30 ثانية
let notificationsInterval = null;

function startNotificationsUpdates() {
  // تحديث فوري عند التحميل
  loadNotifications();
  
  // تحديث كل 30 ثانية
  if (notificationsInterval) {
    clearInterval(notificationsInterval);
  }
  
  notificationsInterval = setInterval(() => {
    loadNotifications();
  }, 30000);
  
  console.log("✅ تم تفعيل التحديث التلقائي للإشعارات (كل 30 ثانية)");
}

// إيقاف التحديث عند إغلاق الصفحة
window.addEventListener('beforeunload', () => {
  if (usdRateInterval) {
    clearInterval(usdRateInterval);
  }
  if (employeesInterval) {
    clearInterval(employeesInterval);
  }
  if (notificationsInterval) {
    clearInterval(notificationsInterval);
  }
});
