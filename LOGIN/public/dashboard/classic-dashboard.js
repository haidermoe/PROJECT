/* ======================
   حماية تسجيل الدخول - يجب أن يكون أول شيء
====================== */
document.addEventListener('DOMContentLoaded', async function() {
  if (typeof requireAuth === 'undefined') {
    window.location.replace("/index.html?error=login_required");
    return;
  }
  const authValid = await requireAuth();
  if (!authValid) return;

  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      const regularEmployeeRoles = ['employee', 'waiter', 'captain', 'cleaner', 'hall_manager', 'hall_captain', 'receptionist', 'garage_employee', 'garage_manager'];
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
  initializeDashboard();
});

function shouldLoadNotifications() {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      return user.role === 'admin';
    } catch (e) { return false; }
  }
  return false;
}

function initializeDashboard() {
  loadDashboardData();
  startUsdRateUpdates();
  startEmployeesUpdates();
  if (shouldLoadNotifications()) {
    setTimeout(() => {
      loadNotifications();
      startNotificationsUpdates();
    }, 500);
  } else {
    const panel = document.querySelector('.panel');
    if (panel) panel.style.display = 'none';
  }
}

async function API(method, endpoint, body = null) {
  const token = localStorage.getItem("token");
  if (!token) return { status: "error", message: "لا يوجد توكن" };
  const config = { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } };
  if (body) config.body = JSON.stringify(body);
  try {
    const res = await fetch(endpoint, config);
    if (!res.ok) return { status: "error" };
    return await res.json();
  } catch (error) { return { status: "error" }; }
}

async function loadDashboardData() {
  try {
    await loadKPIs();
    await loadCharts();
  } catch (error) { console.error(error); }
}

async function loadUsdRate() {
  try {
    const usdRes = await API("GET", "/api/dashboard/usd-rate");
    if (usdRes.status === "success" && usdRes.data) {
      const usdValueEl = document.getElementById("usdValue");
      const usdUpdateTimeEl = document.getElementById("usdUpdateTime");
      if (usdValueEl) usdValueEl.textContent = usdRes.data.rate + " د.ع";
      if (usdUpdateTimeEl) usdUpdateTimeEl.textContent = `(${new Date(usdRes.data.timestamp).toLocaleTimeString('ar-EG')})`;
    }
  } catch (error) { }
}

async function loadKPIs() {
  try {
    const lowStockRes = await API("GET", "/api/dashboard/low-stock");
    if (lowStockRes.status === "success") {
      const el = document.getElementById("lowStockCount");
      if(el) el.textContent = lowStockRes.data.length || 0;
    }
    const empRes = await API("GET", "/api/dashboard/employee-count");
    if (empRes.status === "success") {
      const el = document.getElementById("employeeCount");
      if(el) el.textContent = empRes.data.count || 0;
    }
    const lastOutRes = await API("GET", "/api/dashboard/last-out");
    if (lastOutRes.status === "success" && lastOutRes.data) {
      const el = document.getElementById("lastTransaction");
      if(el) el.textContent = new Date(lastOutRes.data.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    }
    const pEl = document.getElementById("productionToday");
    if(pEl) pEl.textContent = "0";
  } catch (error) { }
}

async function loadCharts() {
  try {
    const wasteRes = await API("GET", "/api/dashboard/daily-waste");
    if (wasteRes.status === "success") {
      const ctx = document.getElementById("wasteChart");
      if (ctx) {
        new Chart(ctx.getContext("2d"), {
          type: "bar",
          data: { labels: ["اليوم"], datasets: [{ label: "الهدر", data: [wasteRes.data.length || 0], backgroundColor: "rgba(255, 107, 122, 0.5)" }] }
        });
      }
    }
    const prodCtx = document.getElementById("productionChart");
    if (prodCtx) {
      new Chart(prodCtx.getContext("2d"), {
        type: "line",
        data: { labels: ["الأسبوع 1", "الأسبوع 2", "الأسبوع 3", "الأسبوع 4"], datasets: [{ label: "الإنتاج", data: [0, 0, 0, 0], borderColor: "#00ff88" }] }
      });
    }
  } catch (error) { }
}

async function loadEmployees() {
  try {
    const tbody = document.getElementById("employeeTable");
    if (!tbody) return;
    const res = await API("GET", "/api/dashboard/employees");
    if (res.status === "success" && res.data && res.data.length > 0) {
      tbody.innerHTML = "";
      res.data.forEach(employee => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${employee.full_name || employee.username}</td>
          <td>${employee.role}</td>
          <td>—</td>
          <td>${employee.created_at ? new Date(employee.created_at).toLocaleDateString('ar-EG') : "—"}</td>
        `;
        tbody.appendChild(row);
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>لا توجد بيانات</td></tr>";
    }
  } catch (error) { }
}

let usdRateInterval = null, employeesInterval = null, notificationsInterval = null;

function startUsdRateUpdates() {
  loadUsdRate();
  if (usdRateInterval) clearInterval(usdRateInterval);
  usdRateInterval = setInterval(loadUsdRate, 60000);
}

function startEmployeesUpdates() {
  loadEmployees();
  if (employeesInterval) clearInterval(employeesInterval);
  employeesInterval = setInterval(loadEmployees, 30000);
}

async function loadNotifications() {
  try {
    const container = document.getElementById("notificationsContainer");
    if (!container) return;
    const res = await API("GET", "/api/notifications?unread_only=true&limit=5");
    if (res.status === "success" && res.data && res.data.length > 0) {
      container.innerHTML = "";
      res.data.forEach(notification => {
        const item = document.createElement("div");
        item.className = "notification-item-dashboard";
        item.style.cssText = "padding:10px; margin-bottom:8px; background:rgba(0,255,136,0.08); border-radius:8px; cursor:pointer;";
        item.innerHTML = `<div style="color:#00ff88;font-weight:bold;">${notification.title}</div><div style="font-size:0.8em;color:#ccc;">${new Date(notification.created_at).toLocaleTimeString('ar-EG')}</div>`;
        item.onclick = () => window.location.href = '/notifications.html';
        container.appendChild(item);
      });
      updateNotificationCount(res.data.length);
    } else {
      container.innerHTML = '<div class="empty-notifications">لا توجد إشعارات جديدة</div>';
      updateNotificationCount(0);
    }
  } catch (error) { }
}

function updateNotificationCount(count) {
  const badge = document.getElementById("notificationCount");
  if (badge) {
    if (count > 0) { badge.textContent = count; badge.style.display = 'inline-block'; }
    else badge.style.display = 'none';
  }
}

function startNotificationsUpdates() {
  loadNotifications();
  if (notificationsInterval) clearInterval(notificationsInterval);
  notificationsInterval = setInterval(loadNotifications, 30000);
}

window.addEventListener('beforeunload', () => {
  clearInterval(usdRateInterval);
  clearInterval(employeesInterval);
  clearInterval(notificationsInterval);
});
