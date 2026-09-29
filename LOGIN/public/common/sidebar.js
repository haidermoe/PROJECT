/* ======================================================
   Sidebar Common Script - يعمل في جميع الصفحات
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
      top: 85px; /* Lowered so it doesn't cover topbar */
      bottom: 0;
      right: -260px;
      height: 100vh;
      width: 260px;
      transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: none;
      z-index: 9999;
      background: #11141a; /* Ensure it has a background so it covers content */
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

// تهيئة السايدبار المشترك
function initSidebar() {
  injectSidebarStyles();
  
  let root = getVisibleSidebarRoot();
  
  // If there's no sidebar element at all, we could theoretically create one,
  // but we assume <aside class="sidebar"></aside> exists.
  if (!root) return;

  // Inject HTML structure if empty
  if (root.innerHTML.trim() === '') {
    root.innerHTML = `
      <div class="menu" style="margin-top: 40px;">
      <div class="menu">
          <!-- Links will be injected here -->
      </div>
    `;
  }

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
      
      // Also inject user-box into Topbar right next to Hamburger menu
      const topbarUserBox = document.createElement('div');
      topbarUserBox.className = 'user-box';
      topbarUserBox.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-left: 20px;';
      topbarUserBox.innerHTML = `
          <img src="/chef_pic1.jpg" class="avatar" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #00ff88; object-fit: cover;">
          <div class="username" id="topbarUsername" style="font-weight: 600; color: #fff; font-size: 0.95rem;">جاري التحميل...</div>
      `;

      // Insert Hamburger first, then UserBox, then title.
      // Since it's RTL and we want them on the far right (start of the topbar flex container)
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
        topIcons.style.marginRight = 'auto'; // ensure it's pushed to the left
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
      } else if (href === '/purchases.html' && (currentPath === '/purchases.html' || currentPath.includes('/purchases'))) {
        item.classList.add('active');
      } else if (href === '/shifts.html' && (currentPath === '/shifts.html' || currentPath.includes('/shifts'))) {
        item.classList.add('active');
      } else if (href === '/manager-insights.html' && currentPath.includes('/manager-insights')) {
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

          // Inject Manager Insights link dynamically
          if (user.role === 'manager' || user.role === 'admin') {
            const menu = root.querySelector('.menu');
            if (menu && !menu.querySelector('a[href="/manager-insights.html"]')) {
              const insightsLink = document.createElement('a');
              insightsLink.className = 'menu-item';
              insightsLink.href = '/manager-insights.html';
              insightsLink.innerHTML = '📊 Manager Insights';
              
              // Find settings or logout to insert before
              const settingsItem = menu.querySelector('a[href="/settings.html"]');
              if (settingsItem) {
                menu.insertBefore(insightsLink, settingsItem);
              } else {
                menu.appendChild(insightsLink);
              }
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
      
      // تحديث بيانات المستخدم في Topbar
      const usernameEl = document.querySelector('#topbarUsername');
      if (usernameEl) {
        const displayName = user.username || 'مدير النظام';
        const roleText = roleNames[user.role] || user.role;
        usernameEl.innerHTML = `
          <div style="font-weight: 600;">${displayName}</div>
          <div style="font-size: 0.75rem; color: #00ff88; margin-top: 2px;">${roleText}</div>
        `;
      }

      // بناء القائمة ديناميكياً بناءً على الرتبة لضمان عدم ظهور صفحات غير مصرح بها
      const menuContainer = root.querySelector('.menu');
      if (menuContainer) {
        // تحديد البوابة النشطة بناءً على مسار الصفحة الحالية
        const currentPath = window.location.pathname.replace(/\\/g, '/');
        let currentPortal = 'kitchen';

        if (currentPath.includes('/waiter.html') || currentPath.includes('/floor-management.html')) {
          currentPortal = 'floor';
        } else if (currentPath.includes('/accounting.html') || currentPath.includes('/purchases.html')) {
          currentPortal = 'finance';
        } else if (
          currentPath.includes('/hr-dashboard.html') || 
          currentPath.includes('/employees.html') || 
          currentPath.includes('/payroll.html') || 
          currentPath.includes('/hr-attendance.html') || 
          currentPath.includes('/shifts.html') || 
          currentPath.includes('/leaves.html') || 
          currentPath.includes('/work-hours.html')
        ) {
          currentPortal = 'hr';
        } else if (currentPath.includes('/settings.html') || currentPath.includes('/notifications.html') || currentPath.includes('/manager-insights.html')) {
          currentPortal = 'settings';
        } else if (currentPath.includes('/dashboard/') || currentPath.includes('/hub.html')) {
          currentPortal = 'hub';
        }

        const isSuperUser = ['admin', 'manager'].includes(user.role);

        // شريط معلومات البوابة الحالية ومبدل التطبيقات للمدير
        const portalMeta = {
          kitchen: { title: '👨‍🍳 بوابة المطبخ والإنتاج', icon: 'fa-utensils', color: '#f59e0b' },
          floor: { title: '🍽️ بوابة الصالة ونقاط البيع', icon: 'fa-chair', color: '#3b82f6' },
          finance: { title: '💰 بوابة المالية والمشتريات', icon: 'fa-calculator', color: '#10b981' },
          hr: { title: '👥 بوابة الموارد البشرية', icon: 'fa-users', color: '#a78bfa' },
          settings: { title: '⚙️ إعدادات النظام والأجهزة', icon: 'fa-cog', color: '#06b6d4' },
          hub: { title: '🎛️ مركز التحكم الرئيسي', icon: 'fa-cubes', color: '#00ff88' }
        };

        const activeMeta = portalMeta[currentPortal] || portalMeta.hub;

        let portalHeaderHtml = '';
        if (isSuperUser) {
          portalHeaderHtml = `
            <div style="padding:10px 14px; margin-bottom:15px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:10px;">
              <div style="font-size:0.75rem; color:#94a3b8; display:flex; justify-content:space-between; align-items:center;">
                <span>القسم النشط:</span>
                <a href="/dashboard/dashboard.html" style="color:#00ff88; text-decoration:none; font-weight:bold; font-size:0.75rem;">
                  🎛️ المبدل العام
                </a>
              </div>
              <div style="font-weight:bold; color:${activeMeta.color}; font-size:0.95rem; margin-top:4px;">
                ${activeMeta.title}
              </div>
            </div>
          `;
        }

        // أزرار التنقل السريع بين الأقسام للمدير في أسفل القائمة
        let quickSwitcherHtml = '';
        if (isSuperUser && currentPortal !== 'hub') {
          quickSwitcherHtml = `
            <div style="margin-top:20px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.08);">
              <div style="font-size:0.75rem; color:#64748b; margin-bottom:8px; font-weight:600;">تنقل سريع بين الأقسام:</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                ${currentPortal !== 'kitchen' ? '<a href="/inventory.html" class="menu-item" style="padding:6px 10px; font-size:0.8rem; background:rgba(255,255,255,0.02);">👨‍🍳 المطبخ</a>' : ''}
                ${currentPortal !== 'floor' ? '<a href="/waiter.html" class="menu-item" style="padding:6px 10px; font-size:0.8rem; background:rgba(255,255,255,0.02);">🍽️ الصالة</a>' : ''}
                ${currentPortal !== 'finance' ? '<a href="/accounting.html" class="menu-item" style="padding:6px 10px; font-size:0.8rem; background:rgba(255,255,255,0.02);">💰 المالية</a>' : ''}
                ${currentPortal !== 'hr' ? '<a href="/hr-dashboard.html" class="menu-item" style="padding:6px 10px; font-size:0.8rem; background:rgba(255,255,255,0.02);">👥 الموظفين</a>' : ''}
              </div>
            </div>
          `;
        }

        // 1) بوابة المطبخ
        if (currentPortal === 'kitchen' || user.role === 'kitchen_manager' || user.role === 'kitchen_employee') {
          menuContainer.innerHTML = `
            ${portalHeaderHtml}
            <a class="menu-item" href="/inventory.html">📦 المخزن والمواد الأولية</a>
            <a class="menu-item" href="/recipes.html">🍲 الوصفات وتكاليف الوجبات</a>
            <a class="menu-item" href="/withdrawals.html">🔄 سحوبات المطبخ</a>
            <a class="menu-item" href="/waste.html">🗑️ تسجيل الهدر والتوالف</a>
            <a class="menu-item" href="/attendance.html">⏰ البصمة الشخصية</a>
            <a class="menu-item" href="/leaves.html">📅 الإجازات</a>
            ${quickSwitcherHtml}
            <a class="menu-item logout" id="logoutBtn" style="margin-top:15px;">🚪 تسجيل الخروج</a>
          `;
        }
        // 2) بوابة الصالة والويترية
        else if (currentPortal === 'floor' || ['waiter', 'captain', 'hall_manager', 'hall_captain'].includes(user.role)) {
          menuContainer.innerHTML = `
            ${portalHeaderHtml}
            <a class="menu-item" href="/floor-management.html">🗺️ مخطط وتحليلات الصالة (2D)</a>
            <a class="menu-item" href="/waiter.html">📱 شاشة طلبات الويترية وإشغال الطاولات</a>
            <a class="menu-item" href="/attendance.html">⏰ البصمة الشخصية</a>
            <a class="menu-item" href="/leaves.html">📅 طلب إجازة</a>
            ${isSuperUser ? '<a class="menu-item" href="/settings.html">🖨️ إعدادات الطابعات والمحطات</a>' : ''}
            ${quickSwitcherHtml}
            <a class="menu-item logout" id="logoutBtn" style="margin-top:15px;">🚪 تسجيل الخروج</a>
          `;
        }
        // 3) بوابة المالية والمحاسبة والمشتريات
        else if (currentPortal === 'finance' || user.role === 'accountant') {
          menuContainer.innerHTML = `
            ${portalHeaderHtml}
            <a class="menu-item" href="/accounting.html">📊 شجرة الحسابات والقيود والتقارير</a>
            <a class="menu-item" href="/purchases.html">🛍️ المشتريات وفواتير الموردين (P2P)</a>
            ${isSuperUser ? '<a class="menu-item" href="/payroll.html">💰 مسيرات الرواتب</a>' : ''}
            <a class="menu-item" href="/attendance.html">⏰ البصمة الشخصية</a>
            ${quickSwitcherHtml}
            <a class="menu-item logout" id="logoutBtn" style="margin-top:15px;">🚪 تسجيل الخروج</a>
          `;
        }
        // 4) بوابة الموارد البشرية
        else if (currentPortal === 'hr' || user.role === 'hr') {
          menuContainer.innerHTML = `
            ${portalHeaderHtml}
            <a class="menu-item" href="/hr-dashboard.html">🏠 لوحة تحكم الموارد البشرية</a>
            <a class="menu-item" href="/employees.html">👥 سجل وحسابات الموظفين</a>
            <a class="menu-item" href="/payroll.html">💰 مسيرات الرواتب والسلف</a>
            <a class="menu-item" href="/hr-attendance.html">📋 تقرير البصمات وساعات العمل</a>
            <a class="menu-item" href="/shifts.html">📅 جداول الورديات والشفتات</a>
            <a class="menu-item" href="/leaves.html">📅 سجل الإجازات والمغادريات</a>
            <a class="menu-item" href="/attendance.html">⏰ البصمة الشخصية</a>
            ${quickSwitcherHtml}
            <a class="menu-item logout" id="logoutBtn" style="margin-top:15px;">🚪 تسجيل الخروج</a>
          `;
        }
        // 5) بوابة الإعدادات
        else if (currentPortal === 'settings') {
          menuContainer.innerHTML = `
            ${portalHeaderHtml}
            <a class="menu-item" href="/settings.html">⚙️ إعدادات النظام وطابعات POS</a>
            <a class="menu-item" href="/notifications.html">🔔 مركز الإشعارات والتنبيهات</a>
            ${isSuperUser ? '<a class="menu-item" href="/manager-insights.html">📊 تحليلات المدير (Insights)</a>' : ''}
            ${quickSwitcherHtml}
            <a class="menu-item logout" id="logoutBtn" style="margin-top:15px;">🚪 تسجيل الخروج</a>
          `;
        }
        // 6) مركز التحكم العام (Hub)
        else {
          menuContainer.innerHTML = `
            <a class="menu-item active" href="/dashboard/dashboard.html" style="background:rgba(0,255,136,0.1); border:1px solid #00ff88;">🗂️ مركز التحكم الرئيسي (Bento)</a>
            <div style="font-size:0.75rem; color:#64748b; margin:15px 0 5px 0; font-weight:bold;">البوابات التشغيلية:</div>
            <a class="menu-item" href="/inventory.html">👨‍🍳 1. إدارة المطبخ والإنتاج</a>
            <a class="menu-item" href="/waiter.html">🍽️ 2. إدارة الصالة ونقاط البيع</a>
            <a class="menu-item" href="/accounting.html">💰 3. المالية والمشتريات</a>
            <a class="menu-item" href="/hr-dashboard.html">👥 4. الموارد البشرية والرواتب</a>
            <div style="font-size:0.75rem; color:#64748b; margin:15px 0 5px 0; font-weight:bold;">النظام:</div>
            <a class="menu-item" href="/settings.html">⚙️ إعدادات النظام والطابعات</a>
            <a class="menu-item logout" id="logoutBtn" style="margin-top:20px;">🚪 تسجيل الخروج</a>
          `;
        }

        // Re-attach active class correctly after re-rendering
        const currentPathForActive = window.location.pathname;
        menuContainer.querySelectorAll('.menu-item').forEach(item => {
            const href = item.getAttribute('href');
            if (href && (currentPathForActive === href || currentPathForActive.endsWith(href))) {
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

