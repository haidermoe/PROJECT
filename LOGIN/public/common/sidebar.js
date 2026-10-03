/* ======================================================
   Sidebar Common Script - مخصص لجميع الأدوار الوظيفية
   Enterprise RBAC Adaptive Sidebar Menu
====================================================== */

function getVisibleSidebarRoot() {
  const withAttr = document.querySelector('aside.sidebar:not([hidden])');
  if (withAttr) return withAttr;
  return document.querySelector('aside.sidebar');
}

// قائمة عناصر القائمة المخصصة لكل دور
const ROLE_MENUS = {
  admin: [
    { title: '🏠 الصفحة الرئيسية', href: '/dashboard/dashboard.html' },
    { title: '👨‍🍳 تحضير الوصفات والباركود', href: '/kitchen-prep.html' },
    { title: '⚖️ جرد ومطابقة السكاشن', href: '/kitchen-audit.html' },
    { title: '📦 المخزن', href: '/inventory.html' },
    { title: '🍳 كروت الوصفات', href: '/recipes.html' },
    { title: '📱 شاشة طلبات الويترية (POS)', href: '/waiter.html' },
    { title: '🏢 الفروع والتحويلات', href: '/branches.html' },
    { title: '💰 شجرة الحسابات والمالية', href: '/accounting.html' },
    { title: '👥 إدارة الموظفين', href: '/employees.html' },
    { title: '🛡️ الصلاحيات والأدوار (RBAC)', href: '/rbac.html' },
    { title: '🔄 سحوبات المواد', href: '/withdrawals.html' },
    { title: '🗑️ الهدر والتالف', href: '/waste.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '⏱️ تقرير ساعات العمل', href: '/work-hours.html' },
    { title: '📅 جداول الدوام', href: '/shifts.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' },
    { title: '⚙️ الإعدادات', href: '/settings.html' }
  ],

  manager: [
    { title: '🏠 الصفحة الرئيسية', href: '/dashboard/dashboard.html' },
    { title: '👨‍🍳 تحضير الوصفات والباركود', href: '/kitchen-prep.html' },
    { title: '⚖️ جرد ومطابقة السكاشن', href: '/kitchen-audit.html' },
    { title: '📦 المخزن', href: '/inventory.html' },
    { title: '🍳 كروت الوصفات', href: '/recipes.html' },
    { title: '📱 شاشة طلبات الويترية (POS)', href: '/waiter.html' },
    { title: '🏢 الفروع والتحويلات', href: '/branches.html' },
    { title: '💰 شجرة الحسابات والمالية', href: '/accounting.html' },
    { title: '👥 إدارة الموظفين', href: '/employees.html' },
    { title: '🔄 سحوبات المواد', href: '/withdrawals.html' },
    { title: '🗑️ الهدر والتالف', href: '/waste.html' },
    { title: '📅 جداول الدوام', href: '/shifts.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  accountant: [
    { title: '💰 شجرة الحسابات والمالية', href: '/accounting.html' },
    { title: '📦 تكاليف وحركات المخزن', href: '/inventory.html' },
    { title: '🔄 تقرير السحوبات', href: '/withdrawals.html' },
    { title: '🗑️ تقرير الهدر والتالف', href: '/waste.html' },
    { title: '🏢 الفروع والمناقلات', href: '/branches.html' },
    { title: '💵 مسير الرواتب', href: '/payroll.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '⏱️ تقرير ساعات العمل', href: '/work-hours.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  cashier: [
    { title: '📱 شاشة الصالة والطلبات (POS)', href: '/waiter.html' },
    { title: '💰 شاشة اليومية والمدفوعات', href: '/accounting.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  hall_manager: [
    { title: '📱 شاشة الطاولات والطلبات (POS)', href: '/waiter.html' },
    { title: '💰 مبيعات اليومية', href: '/accounting.html' },
    { title: '👥 موظفي الصالة والويترية', href: '/employees.html' },
    { title: '📅 جداول دوام الصالة', href: '/shifts.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  kitchen_manager: [
    { title: '👨‍🍳 تحضير الوصفات والباركود', href: '/kitchen-prep.html' },
    { title: '⚖️ جرد ومطابقة السكاشن', href: '/kitchen-audit.html' },
    { title: '🍳 كروت الوصفات', href: '/recipes.html' },
    { title: '📦 المخزن', href: '/inventory.html' },
    { title: '🔄 سحوبات المطبخ', href: '/withdrawals.html' },
    { title: '🗑️ الهدر والتالف', href: '/waste.html' },
    { title: '📱 شاشة طلبات المطبخ', href: '/waiter.html' },
    { title: '📅 جداول دوام المطبخ', href: '/shifts.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  station_chef: [
    { title: '👨‍🍳 تحضير الوصفات والباركود للسكشن', href: '/kitchen-prep.html' },
    { title: '⚖️ جرد ومطابقة السكشن', href: '/kitchen-audit.html' },
    { title: '🍳 كروت الوصفات', href: '/recipes.html' },
    { title: '🔄 سحوبات السكشن', href: '/withdrawals.html' },
    { title: '🗑️ الهدر والتالف', href: '/waste.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  waiter: [
    { title: '📱 شاشة طلبات الويترية (POS)', href: '/waiter.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  inventory_keeper: [
    { title: '📦 المخزن والأرصدة', href: '/inventory.html' },
    { title: '🔄 سحوبات وصرف المواد', href: '/withdrawals.html' },
    { title: '🏢 تحويلات الفروع والمخازن', href: '/branches.html' },
    { title: '🗑️ الهدر والتالف', href: '/waste.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  hr: [
    { title: '🏠 لوحة الموارد البشرية', href: '/hr-dashboard.html' },
    { title: '💰 مسير الرواتب', href: '/payroll.html' },
    { title: '📋 سجلات البصمة', href: '/hr-attendance.html' },
    { title: '👥 إدارة الموظفين والحسابات', href: '/employees.html' },
    { title: '📅 جداول الدوام', href: '/shifts.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '⏱️ تقرير ساعات العمل', href: '/work-hours.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  employee: [
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '⏱️ تقرير ساعات العمل', href: '/work-hours.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ]
};

// مرادفات الأدوار لتسهيل الربط
ROLE_MENUS.captain = ROLE_MENUS.waiter;
ROLE_MENUS.hall_captain = ROLE_MENUS.waiter;
ROLE_MENUS.kitchen_employee = ROLE_MENUS.station_chef;
ROLE_MENUS.cleaner = ROLE_MENUS.employee;
ROLE_MENUS.receptionist = ROLE_MENUS.employee;
ROLE_MENUS.garage_employee = ROLE_MENUS.employee;
ROLE_MENUS.garage_manager = ROLE_MENUS.employee;

// أسماء الرتب بالعربية مع الإيموجي المناسب
const ROLE_DISPLAY_NAMES = {
  'admin': '👑 المدير العام (Admin)',
  'manager': '👔 مدير الفرع (Manager)',
  'accountant': '💰 مدير الحسابات والمالية',
  'cashier': '💵 كاشير المطعم (Cashier)',
  'hall_manager': '🏢 مدير الصالة ومسؤول الخدمة',
  'kitchen_manager': '👨‍🍳 مدير المطبخ / الشيف التنفيذي',
  'station_chef': '🍳 شيف سكشن / مسؤول خط الطهي',
  'kitchen_employee': '👨‍🍳 موظف مطبخ',
  'waiter': '🍽️ ويتر / كابتن صالة',
  'captain': '👔 كابتن صالة',
  'hall_captain': '👔 كابتن صالة',
  'inventory_keeper': '📦 أمين المخزن',
  'hr': '👥 مسؤول الموارد البشرية (HR)',
  'employee': '👤 موظف عام',
  'cleaner': '🧹 خدمات ونظافة',
  'receptionist': '📞 موظف استقبال',
  'garage_employee': '🚗 موظف كراج',
  'garage_manager': '🚗 مسؤول كراج'
};

// تهيئة السايدبار المشترك
function initSidebar() {
  const root = getVisibleSidebarRoot();
  if (!root) return;

  const currentPath = window.location.pathname;
  const userData = localStorage.getItem('user');
  let user = null;

  if (userData) {
    try {
      user = JSON.parse(userData);
    } catch (e) {
      console.error('خطأ في قراءة بيانات المستخدم:', e);
    }
  }

  // 1) تحديث اسم المستخدم والرتبة في رأس السايدبار
  const usernameElement = root.querySelector('.user-box .username');
  if (usernameElement && user) {
    const roleTitle = ROLE_DISPLAY_NAMES[user.role] || user.role;
    usernameElement.innerHTML = `
      <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">${user.username}</div>
      <div style="font-size: 0.75rem; color: #00ff88; margin-top: 3px; font-weight: 600;">${roleTitle}</div>
    `;
  }

  // 2) تخصيص القائمة ديناميكياً حسب دور المستخدم
  const menuContainer = root.querySelector('.menu');
  if (menuContainer && user) {
    const roleItems = ROLE_MENUS[user.role] || ROLE_MENUS.employee;
    
    let menuHtml = roleItems.map(item => {
      return `<a class="menu-item" href="${item.href}">${item.title}</a>`;
    }).join('\n');

    // زر تسجيل الخروج الثابت دائماً
    menuHtml += '\n<a class="menu-item logout" id="logoutBtn">🚪 تسجيل الخروج</a>';
    menuContainer.innerHTML = menuHtml;

    // تمييز العنصر النشط (Active Link) بدقة
    menuContainer.querySelectorAll('.menu-item').forEach(item => {
      const href = item.getAttribute('href');
      if (href) {
        const cleanHref = href.split('?')[0];
        if (currentPath === cleanHref || 
            (cleanHref.endsWith('.html') && currentPath.endsWith(cleanHref)) ||
            (cleanHref === '/dashboard/dashboard.html' && (currentPath === '/' || currentPath.includes('/dashboard')))) {
          item.classList.add('active');
        }
      }
    });

    // ربط حدث تسجيل الخروج
    const logoutBtn = menuContainer.querySelector('.logout');
    if (logoutBtn) {
      logoutBtn.onclick = (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_permissions');
        window.location.href = '/index.html';
      };
    }

    // 3) إضافة محول الفروع (Global Branch Switcher) للإدارات العليا
    const managerialRoles = ['admin', 'manager', 'accountant', 'kitchen_manager', 'inventory_keeper'];
    if (managerialRoles.includes(user.role)) {
      let existingSwitcher = root.querySelector('.sidebar-branch-switcher');
      if (!existingSwitcher) {
        const switcherDiv = document.createElement('div');
        switcherDiv.className = 'sidebar-branch-switcher';
        switcherDiv.style.cssText = 'padding: 10px 12px; margin: 8px 12px 14px; background: #090d16; border: 1px solid #1e293b; border-radius: 8px; font-size: 0.82rem;';
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
  }
}

window.initSidebar = initSidebar;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar);
} else {
  initSidebar();
}
