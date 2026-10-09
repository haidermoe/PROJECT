/* ======================================================
   Sidebar Common Script - مخصص لجميع الأدوار الوظيفية
   Enterprise RBAC Adaptive Sidebar Menu
====================================================== */

function getVisibleSidebarRoot() {
  const withAttr = document.querySelector('aside.sidebar:not([hidden])');
  if (withAttr) return withAttr;
  return document.querySelector('aside.sidebar');
}

function injectSidebarStyles() {
  if (document.getElementById('dynamic-sidebar-styles')) return;
  const style = document.createElement('style');
  style.id = 'dynamic-sidebar-styles';
  style.innerHTML = `
    .sidebar {
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 9999;
    }
    .hamburger-btn {
      background: rgba(0, 255, 136, 0.1);
      border: 1px solid rgba(0, 255, 136, 0.3);
      color: #00ff88;
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 1.2rem;
      cursor: pointer;
      transition: all 0.3s;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .hamburger-btn:hover {
      background: rgba(0, 255, 136, 0.2);
    }
    
    .layout {
      grid-template-columns: 1fr !important;
    }
    .layout:has(.panel) {
      grid-template-columns: 1fr 300px !important;
    }
    .sidebar {
      position: fixed;
      top: 85px;
      bottom: 0;
      right: -260px;
      height: 100vh;
      width: 260px;
      transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: none;
      z-index: 9999;
      background: #11141a;
      border-left: 1px solid rgba(255,255,255,0.05);
    }
    .sidebar.slide-open {
      right: 0;
      box-shadow: -10px 0 30px rgba(0,0,0,0.8) !important;
    }
    .menu-item {
      text-decoration: none !important;
      display: flex;
      align-items: center;
      gap: 10px;
    }
  `;
  document.head.appendChild(style);
}

// قائمة عناصر القائمة المخصصة لكل دور
const ROLE_MENUS = {
  admin: [
    { title: '🏠 الصفحة الرئيسية (Hub)', href: '/dashboard/dashboard.html' },
    { title: '📈 لوحة التحليلات الكلاسيكية', href: '/dashboard/classic-dashboard.html' },
    { title: '📊 تحليلات المدير (Insights)', href: '/manager-insights.html' },
    { title: '👨‍🍳 تحضير الوصفات والباركود', href: '/kitchen-prep.html' },
    { title: '⚖️ جرد ومطابقة السكاشن', href: '/kitchen-audit.html' },
    { title: '📦 المخزن', href: '/inventory.html' },
    { title: '🍳 كروت الوصفات', href: '/recipes.html' },
    { title: '📱 شاشة طلبات الويترية (POS)', href: '/waiter.html' },
    { title: '🏢 إدارة الصالات والمنيو', href: '/floor-management.html' },
    { title: '🏢 الفروع والتحويلات', href: '/branches.html' },
    { title: '🛍️ المشتريات والموردين (P2P)', href: '/purchases.html' },
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
    { title: '🗺️ خريطة النظام والفلوجارت', href: '/system-flowchart.html' },
    { title: '⚙️ الإعدادات', href: '/settings.html' }
  ],

  manager: [
    { title: '🏠 الصفحة الرئيسية (Hub)', href: '/dashboard/dashboard.html' },
    { title: '📊 تحليلات المدير (Insights)', href: '/manager-insights.html' },
    { title: '👨‍🍳 تحضير الوصفات والباركود', href: '/kitchen-prep.html' },
    { title: '⚖️ جرد ومطابقة السكاشن', href: '/kitchen-audit.html' },
    { title: '📦 المخزن', href: '/inventory.html' },
    { title: '🍳 كروت الوصفات', href: '/recipes.html' },
    { title: '📱 شاشة طلبات الويترية (POS)', href: '/waiter.html' },
    { title: '🏢 إدارة الصالات والمنيو', href: '/floor-management.html' },
    { title: '🏢 الفروع والتحويلات', href: '/branches.html' },
    { title: '🛍️ المشتريات والموردين', href: '/purchases.html' },
    { title: '💰 شجرة الحسابات والمالية', href: '/accounting.html' },
    { title: '👥 إدارة الموظفين', href: '/employees.html' },
    { title: '🔄 سحوبات المواد', href: '/withdrawals.html' },
    { title: '🗑️ الهدر والتالف', href: '/waste.html' },
    { title: '📅 جداول الدوام', href: '/shifts.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🗺️ خريطة النظام والفلوجارت', href: '/system-flowchart.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  accountant: [
    { title: '💰 شجرة الحسابات والمالية', href: '/accounting.html' },
    { title: '🛍️ فواتير المشتريات والموردين', href: '/purchases.html' },
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
    { title: '🏢 إدارة الصالات والمنيو', href: '/floor-management.html' },
    { title: '💰 شاشة اليومية والمدفوعات', href: '/accounting.html' },
    { title: '⏰ البصمة والحضور', href: '/attendance.html' },
    { title: '📅 طلبات الإجازات', href: '/leaves.html' },
    { title: '🔔 الإشعارات', href: '/notifications.html' }
  ],

  hall_manager: [
    { title: '📱 شاشة الطاولات والطلبات (POS)', href: '/waiter.html' },
    { title: '🏢 إدارة الصالات والمنيو', href: '/floor-management.html' },
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
    { title: '🛍️ فواتير واستلام المشتريات', href: '/purchases.html' },
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
  injectSidebarStyles();
  
  let root = getVisibleSidebarRoot();
  if (!root) return;

  // Inject Mobile Menu Button if missing
  let mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (!mobileMenuBtn) {
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      mobileMenuBtn = document.createElement('button');
      mobileMenuBtn.id = 'mobileMenuBtn';
      mobileMenuBtn.className = 'hamburger-btn';
      mobileMenuBtn.innerHTML = '☰';
      mobileMenuBtn.style.cssText = 'background: rgba(0, 255, 136, 0.1); border: 1px solid rgba(0, 255, 136, 0.3); color: #00ff88; border-radius: 8px; padding: 4px 12px; font-size: 1.5rem; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; margin-left: 15px; z-index: 10000;';
      
      const topbarUserBox = document.createElement('div');
      topbarUserBox.className = 'user-box';
      topbarUserBox.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-left: 20px;';
      topbarUserBox.innerHTML = `
          <img src="/chef_pic1.jpg" class="avatar" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #00ff88; object-fit: cover;">
          <div class="username" id="topbarUsername" style="font-weight: 600; color: #fff; font-size: 0.95rem;">جاري التحميل...</div>
      `;

      topbar.insertBefore(topbarUserBox, topbar.firstChild);
      topbar.insertBefore(mobileMenuBtn, topbar.firstChild);
    }
  }

  // Inject Quick Logout Button in Topbar
  let quickLogoutBtn = document.getElementById('quickLogoutBtn');
  if (!quickLogoutBtn) {
    const topbar = document.querySelector('.topbar');
    if (topbar) {
      let topIcons = topbar.querySelector('.top-icons');
      if (!topIcons) {
        topIcons = document.createElement('div');
        topIcons.className = 'top-icons';
        topIcons.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-right: auto;';
        topbar.appendChild(topIcons);
      } else {
        topIcons.style.marginRight = 'auto';
      }
      
      quickLogoutBtn = document.createElement('button');
      quickLogoutBtn.id = 'quickLogoutBtn';
      quickLogoutBtn.innerHTML = 'تسجيل الخروج <i class="fa-solid fa-arrow-right-from-bracket" style="margin-right:5px;"></i>';
      quickLogoutBtn.style.cssText = 'background: rgba(255, 107, 122, 0.1); border: 1px solid rgba(255, 107, 122, 0.3); color: #ff6b7a; border-radius: 8px; padding: 8px 12px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; font-family: inherit;';
      
      quickLogoutBtn.addEventListener('mouseenter', () => {
        quickLogoutBtn.style.background = 'rgba(255, 107, 122, 0.2)';
      });
      quickLogoutBtn.addEventListener('mouseleave', () => {
        quickLogoutBtn.style.background = 'rgba(255, 107, 122, 0.1)';
      });
      
      quickLogoutBtn.onclick = (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('user_permissions');
        window.location.href = '/index.html';
      };
      
      topIcons.appendChild(quickLogoutBtn);
    }
  }

  // Sliding Sidebar Toggle Logic
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      root.classList.toggle('slide-open');
    });
  }

  // Close sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (root.classList.contains('slide-open')) {
      if (!root.contains(e.target) && (!mobileMenuBtn || !mobileMenuBtn.contains(e.target))) {
        root.classList.remove('slide-open');
      }
    }
  });

  // Inject HTML structure if empty
  if (root.innerHTML.trim() === '') {
    root.innerHTML = `
      <div class="user-box" style="padding: 18px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 12px;">
        <img src="/chef_pic1.jpg" class="avatar" alt="Avatar" style="width: 44px; height: 44px; border-radius: 50%; border: 2px solid #00ff88; object-fit: cover;">
        <div class="username" style="line-height: 1.3;">
          <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">المستخدم</div>
          <div style="font-size: 0.75rem; color: #00ff88; font-weight: 600;">موظف</div>
        </div>
      </div>
      <div class="menu" style="padding: 10px 0; overflow-y: auto; max-height: calc(100vh - 120px);">
          <!-- Links will be injected here -->
      </div>
    `;
  }

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

  // 1) تحديث اسم المستخدم والرتبة في رأس السايدبار والتوب بار
  const usernameElement = root.querySelector('.user-box .username');
  if (usernameElement && user) {
    const roleTitle = ROLE_DISPLAY_NAMES[user.role] || user.role;
    usernameElement.innerHTML = `
      <div style="font-weight: 700; font-size: 0.95rem; color: #f8fafc;">${user.username}</div>
      <div style="font-size: 0.75rem; color: #00ff88; margin-top: 3px; font-weight: 600;">${roleTitle}</div>
    `;
  }

  const topbarUsername = document.getElementById('topbarUsername');
  if (topbarUsername && user) {
    const roleTitle = ROLE_DISPLAY_NAMES[user.role] || user.role;
    topbarUsername.innerHTML = `${user.username} <span style="font-size:0.75rem; color:#00ff88; margin-right:6px;">(${roleTitle})</span>`;
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
