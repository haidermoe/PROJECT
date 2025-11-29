/**
 * ======================================================
 * Notifications Management – JavaScript
 * ======================================================
 */

let unreadOnly = false;

// التحقق من التوكن عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async function() {
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة!');
    window.location.replace("/index.html?error=login_required");
    return;
  }

  const authValid = await requireAuth();
  if (!authValid) {
    return;
  }

  // ✅ التوكن صحيح - تهيئة الصفحة
  initializeNotifications();
});

// تهيئة صفحة الإشعارات
function initializeNotifications() {
  loadNotifications();
  loadUnreadCount();
  
  // تحديث الإشعارات كل 30 ثانية
  setInterval(() => {
    loadNotifications();
    loadUnreadCount();
  }, 30000);
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
// تحميل الإشعارات
// ---------------------------------------------
async function loadNotifications() {
  try {
    const endpoint = unreadOnly 
      ? '/api/notifications?unread_only=true'
      : '/api/notifications';
    
    const res = await API("GET", endpoint);
    const list = document.getElementById("notificationsList");
    
    if (!list) return;
    
    list.innerHTML = "";

    if (res.status === "success" && res.data && res.data.length > 0) {
      res.data.forEach(notification => {
        const item = createNotificationItem(notification);
        list.appendChild(item);
      });
    } else {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔔</div>
          <div class="empty-state-text">لا توجد إشعارات ${unreadOnly ? 'غير مقروءة' : ''}</div>
        </div>
      `;
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل الإشعارات:", error);
    const list = document.getElementById("notificationsList");
    if (list) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <div class="empty-state-text">حدث خطأ في تحميل الإشعارات</div>
        </div>
      `;
    }
  }
}

// ---------------------------------------------
// إنشاء عنصر إشعار
// ---------------------------------------------
function createNotificationItem(notification) {
  const item = document.createElement("div");
  item.className = `notification-item ${notification.is_read === 0 ? 'unread' : ''}`;
  
  const typeNames = {
    'waste_request': 'طلب هدر',
    'leave_request': 'طلب إجازة'
  };
  
  const typeClass = notification.type;
  const typeName = typeNames[notification.type] || notification.type;
  
  const date = new Date(notification.created_at);
  const dateStr = date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  item.innerHTML = `
    <div class="notification-content">
      <div class="notification-title">${notification.title}</div>
      <div class="notification-message">${notification.message || ''}</div>
      <div class="notification-meta">
        <span class="notification-type ${typeClass}">${typeName}</span>
        <span>${dateStr}</span>
      </div>
    </div>
    <div class="notification-actions">
      <button class="btn-delete" onclick="deleteNotification(${notification.id})" title="حذف">🗑</button>
    </div>
  `;
  
  return item;
}

// ---------------------------------------------
// حذف إشعار
// ---------------------------------------------
async function deleteNotification(id) {
  if (!confirm("هل أنت متأكد من حذف هذا الإشعار؟")) {
    return;
  }
  
  try {
    const res = await API("DELETE", `/api/notifications/${id}`);
    
    if (res.status === "success") {
      loadNotifications();
      loadUnreadCount();
    } else {
      alert("❌ خطأ: " + (res.message || "حدث خطأ أثناء حذف الإشعار"));
    }
  } catch (error) {
    console.error("❌ خطأ في حذف الإشعار:", error);
    alert("❌ حدث خطأ في الاتصال بالسيرفر");
  }
}

// ---------------------------------------------
// تحديد الكل كمقروء
// ---------------------------------------------
async function markAllAsRead() {
  try {
    const res = await API("GET", '/api/notifications?unread_only=true');
    
    if (res.status === "success" && res.data && res.data.length > 0) {
      const promises = res.data.map(notification => 
        API("PATCH", `/api/notifications/${notification.id}/read`)
      );
      
      await Promise.all(promises);
      loadNotifications();
      loadUnreadCount();
    } else {
      alert("لا توجد إشعارات غير مقروءة");
    }
  } catch (error) {
    console.error("❌ خطأ في تحديد الكل كمقروء:", error);
    alert("❌ حدث خطأ في الاتصال بالسيرفر");
  }
}

// ---------------------------------------------
// تبديل عرض غير المقروءة فقط
// ---------------------------------------------
function toggleUnreadOnly() {
  unreadOnly = !unreadOnly;
  const filterText = document.getElementById("filterText");
  if (filterText) {
    filterText.textContent = unreadOnly ? "عرض الكل" : "عرض غير المقروءة فقط";
  }
  loadNotifications();
}

// ---------------------------------------------
// تحميل عدد الإشعارات غير المقروءة
// ---------------------------------------------
async function loadUnreadCount() {
  try {
    const res = await API("GET", '/api/notifications/unread-count');
    
    if (res.status === "success" && res.data) {
      const badge = document.getElementById("notificationBadge");
      if (badge) {
        if (res.data.count > 0) {
          badge.textContent = res.data.count;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل عدد الإشعارات:", error);
  }
}

