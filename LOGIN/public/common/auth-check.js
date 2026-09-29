/**
 * ======================================================
 * Auth Check - التحقق من صحة التوكن في جميع الصفحات
 * ======================================================
 * 
 * هذا الملف يتحقق من صحة التوكن قبل تحميل أي صفحة محمية
 * إذا كان التوكن منتهي أو غير صالح، يتم إعادة التوجيه لتسجيل الدخول
 */

// إخفاء الصفحة فوراً عند تحميل الملف (قبل التحقق)
if (document.body && window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
  document.body.style.display = 'none';
}

/**
 * التحقق من صحة التوكن مع السيرفر
 * @returns {Promise<boolean>} true إذا كان التوكن صالح، false إذا كان منتهي أو غير صالح
 */
async function verifyToken() {
  const token = localStorage.getItem("token");
  
  if (!token) {
    console.log('❌ verifyToken: لا يوجد توكن في localStorage');
    return false;
  }

  console.log('🔵 verifyToken: جاري التحقق من التوكن مع السيرفر...');
  console.log('🔵 verifyToken: طول التوكن:', token.length);

  try {
    const response = await fetch('/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('🔵 verifyToken: استجابة السيرفر:', response.status, response.statusText);

    if (!response.ok) {
      // محاولة قراءة رسالة الخطأ
      try {
        const errorData = await response.json();
        console.log('❌ verifyToken: رسالة الخطأ من السيرفر:', errorData.message);
      } catch {
        console.log('❌ verifyToken: التوكن غير صالح - استجابة السيرفر:', response.status);
      }
      return false;
    }

    const result = await response.json();
    console.log('🔵 verifyToken: بيانات الاستجابة:', result);
    
    if (result.status === 'success' && result.user) {
      console.log('✅ verifyToken: التوكن صالح للمستخدم:', result.user.username, 'الرتبة:', result.user.role);
      // تحديث بيانات المستخدم في localStorage
      localStorage.setItem('user', JSON.stringify(result.user));
      return true;
    }

    console.log('❌ verifyToken: استجابة غير صحيحة من السيرفر:', result);
    return false;
    
  } catch (error) {
    console.error('❌ verifyToken: خطأ في الاتصال بالسيرفر:', error);
    console.error('❌ verifyToken: تفاصيل الخطأ:', error.message);
    // في حالة خطأ الاتصال، نعتبر التوكن غير صالح للأمان
    return false;
  }
}

/**
 * التحقق من التوكن وإعادة التوجيه إذا لزم الأمر
 * يجب استدعاء هذه الدالة في بداية كل صفحة محمية
 */
async function requireAuth() {
  // التحقق من أننا لسنا في صفحة تسجيل الدخول (لتفادي حلقة إعادة التوجيه)
  if (window.location.pathname === '/index.html' || window.location.pathname === '/') {
    console.log('⚠️ requireAuth: تم استدعاؤه في صفحة تسجيل الدخول - تجاهل');
    return true;
  }

  // إخفاء المحتوى حتى يتم التحقق
  if (document.body) {
    document.body.style.display = 'none';
  }

  const token = localStorage.getItem("token");
  
  // إذا لم يكن هناك توكن، إعادة توجيه مباشرة
  if (!token) {
    console.log('❌ requireAuth: لا يوجد توكن - إعادة توجيه لتسجيل الدخول');
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // استخدام replace بدلاً من href لتجنب إضافة إلى history
    window.location.replace("/index.html?error=login_required");
    return false;
  }

  // التحقق من صحة التوكن مع السيرفر
  // إضافة retry mechanism في حالة فشل الاتصال
  let isValid = false;
  let retries = 2;
  
  while (retries > 0 && !isValid) {
    isValid = await verifyToken();
    if (!isValid && retries > 1) {
      console.log(`⚠️ requireAuth: فشل التحقق، محاولة أخرى... (${retries - 1} محاولات متبقية)`);
      // انتظار قصير قبل إعادة المحاولة
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    retries--;
  }
  
  if (!isValid) {
    console.log('❌ requireAuth: التوكن غير صالح أو منتهي - إعادة توجيه لتسجيل الدخول');
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // استخدام replace بدلاً من href لتجنب إضافة إلى history
    window.location.replace("/index.html?error=session_expired");
    return false;
  }

  // ✅ التوكن صالح - التحقق من الصلاحيات وإعادة التوجيه إذا لزم الأمر
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
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

      // 1. موظفي المطبخ (Kitchen Portal)
      if (user.role === 'kitchen_employee' || user.role === 'kitchen_manager') {
        const currentPath = window.location.pathname.replace(/\\/g, '/');
        const kitchenAllowed = ['/inventory.html', '/recipes.html', '/withdrawals.html', '/waste.html', '/attendance.html', '/leaves.html', '/index.html'];
        const isAllowed = kitchenAllowed.some(page => currentPath.includes(page));
        if (!isAllowed) {
          console.log(`⚠️ موظف/مدير المطبخ لا يمكنه الوصول لـ ${currentPath} - إعادة التوجيه إلى المخزن`);
          window.location.replace('/inventory.html');
          return false;
        }
      }

      // 2. موظفي الصالة والويترية (Dining / Waiter POS Portal)
      const floorRoles = ['waiter', 'captain', 'hall_manager', 'hall_captain'];
      if (floorRoles.includes(user.role)) {
        const currentPath = window.location.pathname.replace(/\\/g, '/');
        const floorAllowed = ['/waiter.html', '/floor-management.html', '/attendance.html', '/leaves.html', '/index.html'];
        const isAllowed = floorAllowed.some(page => currentPath.includes(page));
        if (!isAllowed) {
          console.log(`⚠️ كادر الصالة لا يمكنه الوصول لـ ${currentPath} - إعادة التوجيه إلى شاشة الويتر`);
          window.location.replace('/waiter.html');
          return false;
        }
      }

      // 3. الموارد البشرية (HR Portal)
      if (user.role === 'hr') {
        const currentPath = window.location.pathname.replace(/\\/g, '/');
        const hrAllowed = [
          '/hr-dashboard.html',
          '/hr-attendance.html',
          '/payroll.html',
          '/attendance.html',
          '/leaves.html',
          '/shifts.html',
          '/employees.html',
          '/work-hours.html',
          '/notifications.html',
          '/index.html'
        ];
        const isAllowed = hrAllowed.some(page => currentPath.includes(page));
        if (!isAllowed) {
          console.log('⚠️ صلاحية HR: إعادة توجيه إلى لوحة الموارد البشرية');
          window.location.replace('/hr-dashboard.html');
          return false;
        }
      }

      // 4. المحاسب المالي (Finance Portal)
      if (user.role === 'accountant') {
        const currentPath = window.location.pathname.replace(/\\/g, '/');
        const financeAllowed = ['/accounting.html', '/purchases.html', '/attendance.html', '/leaves.html', '/index.html'];
        const isAllowed = financeAllowed.some(page => currentPath.includes(page));
        if (!isAllowed) {
          console.log('⚠️ صلاحية المحاسب: إعادة توجيه إلى لوحة المحاسبة والمالية');
          window.location.replace('/accounting.html');
          return false;
        }
      }

      // 5. الموظفون العاديون (حضور وإجازات فقط)
      const basicEmployeeRoles = ['employee', 'cleaner', 'receptionist', 'garage_employee', 'garage_manager'];
      if (basicEmployeeRoles.includes(user.role)) {
        const currentPath = window.location.pathname.replace(/\\/g, '/');
        const basicAllowed = ['/attendance.html', '/leaves.html', '/index.html'];
        const isAllowed = basicAllowed.some(page => currentPath.includes(page));
        if (!isAllowed) {
          console.log('⚠️ الموظف العادي: إعادة توجيه إلى صفحة البصمة');
          window.location.replace('/attendance.html');
          return false;
        }
      }
    } catch (e) {
      console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
    }
  }

  // ✅ التوكن صالح - إظهار الصفحة
  if (document.body) {
    document.body.style.display = '';
  }
  
  console.log('✅ requireAuth: التحقق ناجح، عرض الصفحة');
  return true;
}

// جعل الدوال متاحة بشكل عام (global) للاستخدام في الصفحات
// هذا يضمن أن requireAuth متاحة في جميع الصفحات بعد تحميل هذا الملف
window.verifyToken = verifyToken;
window.requireAuth = requireAuth;

// تصدير الدوال للاستخدام في الصفحات الأخرى (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { verifyToken, requireAuth };
}

