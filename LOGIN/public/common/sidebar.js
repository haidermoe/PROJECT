/* ======================================================
   Sidebar Common Script - يعمل في جميع الصفحات
====================================================== */

function getVisibleSidebarRoot() {
  const withAttr = document.querySelector('aside.sidebar:not([hidden])');
  if (withAttr) return withAttr;
  return document.querySelector('aside.sidebar');
}

// تهيئة السايدبار المشترك
function initSidebar() {
  const root = getVisibleSidebarRoot();
  if (!root) return;

  const currentPath = window.location.pathname;
  const menuItems = root.querySelectorAll('.menu-item');
  
  menuItems.forEach(item => {
    // إزالة active من جميع العناصر
    item.classList.remove('active');
    
    // إضافة active للعنصر المطابق للصفحة الحالية
    const href = item.getAttribute('href');
    if (href) {
      // مطابقة دقيقة للصفحة
      if (currentPath === href || currentPath.endsWith(href)) {
        item.classList.add('active');
      } else if (href === '/dashboard/dashboard.html' && currentPath.includes('/dashboard')) {
        item.classList.add('active');
      } else if (href === '/inventory.html' && currentPath.includes('/inventory')) {
        item.classList.add('active');
      } else if (href === '/recipes.html' && currentPath.includes('/recipes')) {
        item.classList.add('active');
      } else if (href === '/employees.html' && currentPath.includes('/employees')) {
        item.classList.add('active');
      } else if (href === '/settings.html' && (currentPath === '/settings.html' || currentPath.includes('/settings'))) {
        item.classList.add('active');
      } else if (href === '/shifts.html' && (currentPath === '/shifts.html' || currentPath.includes('/shifts'))) {
        item.classList.add('active');
      }
    }
  });

  const logoutBtn = root.querySelector('.menu-item.logout');
  if (logoutBtn) {
    logoutBtn.onclick = (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/index.html';
    };
  }

      // إظهار/إخفاء رابط الإعدادات وجداول الدوام بناءً على الرتبة
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          const settingsLink = root.querySelector('.menu-item[href="/settings.html"]');
          if (settingsLink) {
            if (user.role === 'admin') {
              settingsLink.style.display = 'block';
            } else {
              settingsLink.style.display = 'none';
            }
          }
          
          const shiftsLink = root.querySelector('.menu-item[href="/shifts.html"]');
          if (shiftsLink) {
            const adminRoles = ['admin', 'manager', 'kitchen_manager', 'hr'];
            if (adminRoles.includes(user.role)) {
              shiftsLink.style.display = 'block';
            } else {
              shiftsLink.style.display = 'none';
            }
          }
      
      const usernameElement = root.querySelector('.user-box .username');
      
      // أسماء الرتب بالعربية
      const roleNames = {
        'admin': '👑 مدير عام',
        'hr': '👥 موارد بشرية',
        'manager': '👔 مدير',
        'kitchen_manager': '👨‍🍳 مدير مطبخ',
        'kitchen_employee': '👨‍🍳 موظف مطبخ',
        'employee': '👤 موظف',
        'waiter': '🍽️ ويتر',
        'captain': '👔 كابتن',
        'cleaner': '🧹 عامل نظافة',
        'hall_manager': '🏢 مسؤول صالة',
        'hall_captain': '👔 كابتن صالة',
        'receptionist': '📞 موظف استقبال',
        'garage_employee': '🚗 موظف كراج',
        'garage_manager': '🚗 مسؤول كراج'
      };
      
      if (usernameElement && user.username) {
        // عرض اسم المستخدم والرتبة
        const roleDisplay = roleNames[user.role] || user.role;
        usernameElement.innerHTML = `
          <div style="font-weight: 600;">${user.username}</div>
          <div style="font-size: 0.75rem; color: #00ff88; margin-top: 2px;">${roleDisplay}</div>
        `;
      }

      // بناء القائمة ديناميكياً بناءً على الرتبة لضمان عدم ظهور صفحات غير مصرح بها
      const menuContainer = root.querySelector('.menu');
      
      if (menuContainer) {
        if (user.role === 'hr') {
          menuContainer.innerHTML = `
            <a class="menu-item" href="/hr-dashboard.html">🏠 الصفحة الرئيسية</a>
            <a class="menu-item" href="/payroll.html">💰 الرواتب</a>
            <a class="menu-item" href="/hr-attendance.html">📋 البصمات وساعات العمل</a>
            <a class="menu-item" href="/attendance.html">⏰ البصمة</a>
            <a class="menu-item" href="/leaves.html">📅 الإجازات</a>
            <a class="menu-item" href="/shifts.html">📅 جداول الدوام</a>
            <a class="menu-item" href="/employees.html">👥 إدارة الحسابات</a>
            <a class="menu-item" href="/work-hours.html">⏱️ تقرير ساعات العمل</a>
            <a class="menu-item" href="/notifications.html">🔔 الإشعارات</a>
            <a class="menu-item logout" id="logoutBtn">تسجيل الخروج</a>
          `;
        } else if (user.role === 'kitchen_employee') {
          menuContainer.innerHTML = `
            <a class="menu-item" href="/inventory.html">📦 المخزن</a>
            <a class="menu-item" href="/withdrawals.html">🔄 سحوبات</a>
            <a class="menu-item" href="/attendance.html">⏰ البصمة</a>
            <a class="menu-item" href="/leaves.html">📅 الإجازات</a>
            <a class="menu-item logout" id="logoutBtn">تسجيل الخروج</a>
          `;
        } else if (['employee', 'waiter', 'captain', 'cleaner', 'hall_manager', 'hall_captain', 'receptionist', 'garage_employee', 'garage_manager'].includes(user.role)) {
          menuContainer.innerHTML = `
            <a class="menu-item" href="/attendance.html">⏰ البصمة</a>
            <a class="menu-item" href="/leaves.html">📅 الإجازات</a>
            <a class="menu-item" href="/notifications.html">🔔 الإشعارات</a>
            <a class="menu-item logout" id="logoutBtn">تسجيل الخروج</a>
          `;
        } else if (user.role === 'kitchen_manager') {
          // Add specific menu adjustments for kitchen_manager if needed
          // For now, let kitchen managers use the default menu, but hide specific entries
          const restrictedPages = ['/dashboard/dashboard.html', '/employees.html', '/settings.html', '/payroll.html', '/hr-dashboard.html', '/hr-attendance.html'];
          restrictedPages.forEach(page => {
            const links = menuContainer.querySelectorAll(`a[href="${page}"]`);
            links.forEach(link => link.style.display = 'none');
          });
        }

        // Re-attach active class correctly after re-rendering
        if (user.role === 'hr' || user.role === 'kitchen_employee' || ['employee', 'waiter', 'captain', 'cleaner', 'hall_manager', 'hall_captain', 'receptionist', 'garage_employee', 'garage_manager'].includes(user.role)) {
          const currentPath = window.location.pathname;
          menuContainer.querySelectorAll('.menu-item').forEach(item => {
             const href = item.getAttribute('href');
             if (href && (currentPath === href || currentPath.endsWith(href))) {
                 item.classList.add('active');
             }
          });

          // Re-attach logout handler
          const logoutBtnRe = menuContainer.querySelector('.logout');
          if (logoutBtnRe) {
            logoutBtnRe.onclick = (e) => {
              e.preventDefault();
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/index.html';
            };
          }
        }
      }
      
      // طباعة معلومات المستخدم في Console للمساعدة في التشخيص
      console.log('👤 معلومات المستخدم الحالي:', {
        username: user.username,
        role: user.role,
        roleName: roleNames[user.role] || user.role,
        isAdmin: user.role === 'admin'
      });
      
    } catch (e) {
      console.error('خطأ في قراءة بيانات المستخدم:', e);
    }
  }
}

window.initSidebar = initSidebar;

// تشغيل تهيئة السايدبار عند تحميل الصفحة
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar);
} else {
  initSidebar();
}

