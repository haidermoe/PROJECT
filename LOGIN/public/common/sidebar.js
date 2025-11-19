/* ======================================================
   Sidebar Common Script - يعمل في جميع الصفحات
====================================================== */

// تهيئة السايدبار المشترك
function initSidebar() {
  // تحديد الصفحة النشطة بناءً على URL
  const currentPath = window.location.pathname;
  const menuItems = document.querySelectorAll('.menu-item');
  
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
      }
    }
  });

  // تسجيل الخروج
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/index.html';
    });
  }

  // تحديث اسم المستخدم والرتبة من localStorage
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      const usernameElement = document.querySelector('.user-box .username');
      
      // أسماء الرتب بالعربية
      const roleNames = {
        'admin': '👑 مدير عام',
        'manager': '👔 مدير',
        'kitchen_manager': '👨‍🍳 مدير مطبخ',
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

      // إخفاء رابط الموظفين إذا لم يكن مدير
      if (user.role !== 'admin') {
        const employeeLinks = document.querySelectorAll('a[href="/employees.html"]');
        employeeLinks.forEach(link => {
          link.style.display = 'none';
        });
      }

      // الموظفون العاديون: إخفاء كل الصفحات ما عدا البصمة والإجازات
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
        const restrictedPages = [
          '/dashboard/dashboard.html',
          '/inventory.html',
          '/recipes.html',
          '/employees.html',
          '/withdrawals.html',
          '/waste.html',
          '/work-hours.html',
          '/add-recipe.html'
        ];

        restrictedPages.forEach(page => {
          const links = document.querySelectorAll(`a[href="${page}"]`);
          links.forEach(link => {
            link.style.display = 'none';
          });
        });

        // إخفاء عناصر القائمة الأخرى
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
          const href = item.getAttribute('href');
          if (href) {
            // السماح فقط بالبصمة والإجازات وتسجيل الخروج
            if (href !== '/attendance.html' && href !== '/leaves.html' && !item.classList.contains('logout')) {
              item.style.display = 'none';
            }
          } else if (!item.classList.contains('logout')) {
            // إخفاء عناصر القائمة بدون رابط (مثل "المبيعات", "إدارة المنيو", "الإعدادات")
            item.style.display = 'none';
          }
        });
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

// تشغيل تهيئة السايدبار عند تحميل الصفحة
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSidebar);
} else {
  initSidebar();
}

