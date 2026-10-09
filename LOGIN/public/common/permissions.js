/* ======================================================
   Permissions Helper - إدارة الصلاحيات المتقدمة (Enterprise RBAC)
   ====================================================== */

let cachedUserPermissions = null;

// جلب الصلاحيات المخزنة أو تحميلها من السيرفر
async function fetchUserPermissions() {
  const token = localStorage.getItem('token');
  if (!token) return new Set();

  try {
    const res = await fetch('/api/rbac/user-permissions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.status === 'success') {
      cachedUserPermissions = new Set(data.data.permissions || []);
      localStorage.setItem('user_permissions', JSON.stringify(data.data.permissions || []));
      return cachedUserPermissions;
    }
  } catch (e) {
    console.warn('لم يتم جلب الصلاحيات من السيرفر:', e.message);
  }

  const saved = localStorage.getItem('user_permissions');
  if (saved) {
    try { cachedUserPermissions = new Set(JSON.parse(saved)); } catch (e) {}
  }
  return cachedUserPermissions || new Set();
}

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
  // فحص صلاحية دقيقة بالكود (Granular Permission Check)
  has(permissionCode) {
    const user = getCurrentUser();
    if (user && user.role === 'admin') return true; // المدير العام يملك كافة الصلاحيات

    if (!cachedUserPermissions) {
      const saved = localStorage.getItem('user_permissions');
      if (saved) {
        try { cachedUserPermissions = new Set(JSON.parse(saved)); } catch (e) {}
      }
    }
    return cachedUserPermissions ? cachedUserPermissions.has(permissionCode) : false;
  },

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

  // الشيف: يمكنه إدارة الوصفات والمطبخ
  isKitchenManager() {
    const user = getCurrentUser();
    return user && user.role === 'kitchen_manager';
  },

  // الويتر
  isWaiter() {
    const user = getCurrentUser();
    return user && ['waiter', 'captain', 'hall_captain'].includes(user.role);
  },

  // الموظف: صلاحيات محدودة
  isEmployee() {
    const user = getCurrentUser();
    return user && user.role === 'employee';
  },

  // موظف المطبخ: يمكنه سحب من المخزن
  isKitchenEmployee() {
    const user = getCurrentUser();
    return user && user.role === 'kitchen_employee';
  },

  isHR() {
    const user = getCurrentUser();
    return user && user.role === 'hr';
  },

  // التحقق من أن المستخدم له صلاحيات كاملة (يرى كل الصفحات)
  hasFullAccess() {
    const user = getCurrentUser();
    if (!user) return false;
    const fullAccessRoles = ['admin', 'manager', 'kitchen_manager'];
    return fullAccessRoles.includes(user.role);
  },

  isRegularEmployee() {
    const user = getCurrentUser();
    if (!user) return false;
    const regularEmployeeRoles = [
      'employee',
      'cleaner',
      'hall_manager',
      'receptionist',
      'garage_employee',
      'garage_manager'
    ];
    return regularEmployeeRoles.includes(user.role);
  },

  // الصلاحيات الوظيفية المعتمدة على RBAC
  canManageUsers() {
    return this.isAdmin() || this.isHR() || this.has('users.manage');
  },

  canManageRBAC() {
    return this.isAdmin() || this.has('rbac.manage');
  },

  canManageRecipes() {
    return this.isAdmin() || this.isKitchenManager() || this.has('recipes.manage');
  },

  canAddInventory() {
    return this.isAdmin() || this.isKitchenManager() || this.has('inventory.write');
  },

  canWithdrawFromInventory() {
    return this.isAdmin() || this.isKitchenManager() || this.isKitchenEmployee() || this.has('inventory.transact');
  },

  canOrderPOS() {
    return this.isAdmin() || this.isWaiter() || this.has('pos.order');
  },

  canAuditKitchen() {
    return this.isAdmin() || this.isKitchenManager() || this.has('kitchen.audit');
  },

  canManageAccounting() {
    return this.isAdmin() || user?.role === 'accountant' || this.has('accounting.read');
  }
};

// إخفاء/إظهار العناصر في الواجهة طبقاً للصلاحيات
async function applyPermissions() {
  const user = getCurrentUser();
  if (!user) return;

  // جلب أحدث الصلاحيات من السيرفر
  await fetchUserPermissions();

  // 1) إخفاء العناصر التي تحمل وسم data-permission إذا كان المستخدم لا يملك الصلاحية
  document.querySelectorAll('[data-permission]').forEach(el => {
    const requiredPerm = el.getAttribute('data-permission');
    if (requiredPerm && !Permissions.has(requiredPerm)) {
      el.style.display = 'none';
    }
  });

  // 2) إخفاء العناصر التي تحمل وسم data-role-min
  document.querySelectorAll('[data-role-admin-only]').forEach(el => {
    if (!Permissions.isAdmin()) {
      el.style.display = 'none';
    }
  });

  // 3) التحقق من صفحات المستخدمين العاديين
  if (Permissions.isRegularEmployee()) {
    const restrictedPages = [
      '/dashboard/dashboard.html',
      '/inventory.html',
      '/recipes.html',
      '/employees.html',
      '/withdrawals.html',
      '/waste.html',
      '/work-hours.html',
      '/add-recipe.html',
      '/accounting.html',
      '/branches.html',
      '/kitchen-prep.html',
      '/kitchen-audit.html',
      '/rbac.html'
    ];

    restrictedPages.forEach(page => {
      document.querySelectorAll(`a[href="${page}"]`).forEach(link => {
        link.style.display = 'none';
      });
    });
  }

  // 4) تقييد رابط إدارة الصلاحيات RBAC للأدمن فقط
  if (!Permissions.isAdmin()) {
    document.querySelectorAll('a[href="/rbac.html"], a[href="/rbac"]').forEach(link => {
      link.style.display = 'none';
    });
  }

  if (!Permissions.canManageUsers()) {
    document.querySelectorAll('a[href="/employees.html"]').forEach(link => {
      link.style.display = 'none';
    });
  }
}

document.addEventListener('DOMContentLoaded', applyPermissions);
window.Permissions = Permissions;
window.applyPermissions = applyPermissions;
