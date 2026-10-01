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
      } else if (href === '/branches.html' && currentPath.includes('/branches')) {
        item.classList.add('active');
      } else if (href === '/accounting.html' && currentPath.includes('/accounting')) {
        item.classList.add('active');
      } else if (href === '/kitchen-prep.html' && currentPath.includes('/kitchen-prep')) {
        item.classList.add('active');
      } else if (href === '/kitchen-audit.html' && currentPath.includes('/kitchen-audit')) {
        item.classList.add('active');
      } else if (href === '/rbac.html' && currentPath.includes('/rbac')) {
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

      // إظهار/إخفاء رابط الإعدادات و RBAC بناءً على الرتبة
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          const rbacLink = root.querySelector('.menu-item[href="/rbac.html"]');
          if (rbacLink) {
            rbacLink.style.display = (user.role === 'admin') ? 'flex' : 'none';
          }

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
        } else if (['waiter', 'captain', 'hall_captain'].includes(user.role)) {
          menuContainer.innerHTML = `
            <a class="menu-item" href="/waiter.html">📱 شاشة طلبات الويترية (POS)</a>
            <a class="menu-item" href="/attendance.html">⏰ البصمة</a>
            <a class="menu-item" href="/leaves.html">📅 الإجازات</a>
            <a class="menu-item" href="/notifications.html">🔔 الإشعارات</a>
            <a class="menu-item logout" id="logoutBtn">تسجيل الخروج</a>
          `;
        } else if (['employee', 'cleaner', 'hall_manager', 'receptionist', 'garage_employee', 'garage_manager'].includes(user.role)) {
          menuContainer.innerHTML = `
            <a class="menu-item" href="/attendance.html">⏰ البصمة</a>
            <a class="menu-item" href="/leaves.html">📅 الإجازات</a>
            <a class="menu-item" href="/notifications.html">🔔 الإشعارات</a>
            <a class="menu-item logout" id="logoutBtn">تسجيل الخروج</a>
          `;
        } else if (user.role === 'kitchen_manager') {
          menuContainer.innerHTML = `
            <a class="menu-item" href="/kitchen-prep.html">👨‍🍳 تحضير الوصفات والباركود</a>
            <a class="menu-item" href="/kitchen-audit.html">⚖️ جرد ومطابقة السكاشن</a>
            <a class="menu-item" href="/recipes.html">🍳 كروت الوصفات</a>
            <a class="menu-item" href="/inventory.html">📦 المخزن</a>
            <a class="menu-item" href="/withdrawals.html">🔄 سحوبات</a>
            <a class="menu-item" href="/waste.html">🗑️ الهدر والتالف</a>
            <a class="menu-item" href="/waiter.html">📱 شاشة طلبات الويترية</a>
            <a class="menu-item" href="/shifts.html">📅 جداول الدوام</a>
            <a class="menu-item" href="/attendance.html">⏰ البصمة</a>
            <a class="menu-item" href="/leaves.html">📅 الإجازات</a>
            <a class="menu-item" href="/notifications.html">🔔 الإشعارات</a>
            <a class="menu-item logout" id="logoutBtn">تسجيل الخروج</a>
          `;
        }

        // Re-attach active class correctly after re-rendering
        if (['hr', 'kitchen_employee', 'kitchen_manager', 'waiter', 'captain', 'cleaner', 'hall_manager', 'hall_captain', 'receptionist', 'garage_employee', 'garage_manager'].includes(user.role)) {
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
      
      // Global Branch Switcher في السايدبار للمدراء
      if (['admin', 'manager', 'kitchen_manager'].includes(user.role)) {
        let existingSwitcher = root.querySelector('.sidebar-branch-switcher');
        if (!existingSwitcher && menuContainer) {
          const switcherDiv = document.createElement('div');
          switcherDiv.className = 'sidebar-branch-switcher';
          switcherDiv.style.cssText = 'padding: 10px 12px; margin: 8px 12px 14px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; font-size: 0.82rem;';
          switcherDiv.innerHTML = `
            <div style="color: #94a3b8; margin-bottom: 6px; font-weight:600; display:flex; justify-content:space-between; align-items:center;">
              <span>🏢 نطاق الفرع:</span>
              <a href="/branches.html" style="color:#38bdf8; text-decoration:none; font-size:0.75rem;">إدارة الفروع</a>
            </div>
            <select id="globalSidebarBranchSelect" style="width:100%; background:#1e293b; color:#f8fafc; border:1px solid #475569; border-radius:6px; padding:6px 8px; font-size:0.82rem; outline:none; cursor:pointer;">
              <option value="all">🌐 كل الفروع (موحد)</option>
            </select>
          `;
          menuContainer.insertBefore(switcherDiv, menuContainer.firstChild);

          const token = localStorage.getItem('token');
          if (token) {
            fetch('/api/branches', { headers: { 'Authorization': `Bearer ${token}` } })
              .then(res => res.json())
              .then(res => {
                if (res.status === 'success' && res.data) {
                  const sel = switcherDiv.querySelector('#globalSidebarBranchSelect');
                  if (sel) {
                    sel.innerHTML = '<option value="all">🌐 كل الفروع (موحد)</option>' +
                      res.data.map(b => `<option value="${b.id}">🏢 ${b.name}</option>`).join('');
                    sel.value = localStorage.getItem('selected_branch_id') || 'all';
                    sel.onchange = () => {
                      localStorage.setItem('selected_branch_id', sel.value);
                      window.location.reload();
                    };
                  }
                }
              }).catch(e => console.warn('لم يتم جلب الفروع للسايدبار:', e.message));
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

