/* ======================================================
   Permissions Helper - إدارة الصلاحيات
====================================================== */

// جلب بيانات المستخدم الحالي
function getCurrentUser() {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      return JSON.parse(userData);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// التحقق من الصلاحيات
const Permissions = {
  // المدير: صلاحيات كاملة
  isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
  },

  // المدير العادي
  isManager() {
    const user = getCurrentUser();
    return user && user.role === 'manager';
  },

  // الشيف: يمكنه إدارة الوصفات
  isKitchenManager() {
    const user = getCurrentUser();
    return user && user.role === 'kitchen_manager';
  },

  // الموظف: صلاحيات محدودة
  isEmployee() {
    const user = getCurrentUser();
    return user && user.role === 'employee';
  },

  // التحقق من أن المستخدم له صلاحيات كاملة (يرى كل الصفحات)
  hasFullAccess() {
    const user = getCurrentUser();
    if (!user) return false;
    const fullAccessRoles = ['admin', 'manager', 'kitchen_manager'];
    return fullAccessRoles.includes(user.role);
  },

  // التحقق من أن المستخدم موظف عادي (يرى فقط البصمة والإجازات)
  isRegularEmployee() {
    const user = getCurrentUser();
    if (!user) return false;
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
    return regularEmployeeRoles.includes(user.role);
  },

  // يمكنه إدارة الموظفين (فقط المدير)
  canManageUsers() {
    return this.isAdmin();
  },

  // يمكنه إضافة/تعديل/حذف الوصفات
  canManageRecipes() {
    return this.isAdmin() || this.isKitchenManager();
  },

  // يمكنه إضافة مواد للمخزن
  canAddInventory() {
    return this.isAdmin() || this.isKitchenManager();
  },

  // يمكنه فقط سحب وإيداع (الموظف)
  canOnlyWithdrawDeposit() {
    return this.isEmployee();
  },

  // يحتاج موافقة لتعديل الوصفات (الشيف)
  needsApprovalForEdit() {
    return this.isKitchenManager();
  }
};

// إخفاء/إظهار العناصر حسب الصلاحيات
function applyPermissions() {
  const user = getCurrentUser();
  if (!user) return;

  // الموظفون العاديون: إخفاء كل الصفحات ما عدا البصمة والإجازات
  if (Permissions.isRegularEmployee()) {
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
    const restrictedMenuItems = document.querySelectorAll('.menu-item');
    restrictedMenuItems.forEach(item => {
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

  // إخفاء رابط الموظفين إذا لم يكن مدير
  if (!Permissions.isAdmin()) {
    const employeeLinks = document.querySelectorAll('a[href="/employees.html"]');
    employeeLinks.forEach(link => {
      link.style.display = 'none';
    });
  }

  // إخفاء زر إضافة مادة للموظفين العاديين
  if (Permissions.isRegularEmployee()) {
    const addButtons = document.querySelectorAll('#addItemBtn');
    addButtons.forEach(btn => {
      if (btn) btn.style.display = 'none';
    });
  }

  // إخفاء أزرار التعديل والحذف في الوصفات للموظفين العاديين
  if (Permissions.isRegularEmployee()) {
    const editButtons = document.querySelectorAll('.btn-mini.edit');
    const deleteButtons = document.querySelectorAll('.btn-mini.delete');
    editButtons.forEach(btn => btn.style.display = 'none');
    deleteButtons.forEach(btn => btn.style.display = 'none');
  }
}

// تطبيق الصلاحيات عند تحميل الصفحة
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyPermissions);
} else {
  applyPermissions();
}

// تصدير للاستخدام في ملفات أخرى
window.Permissions = Permissions;

