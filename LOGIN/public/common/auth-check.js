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

      // إذا كان موظف عادي وحاول الوصول لصفحة غير مصرح بها
      if (regularEmployeeRoles.includes(user.role)) {
        const currentPath = window.location.pathname;
        const allowedPages = ['/attendance.html', '/leaves.html', '/index.html'];
        const isAllowedPage = allowedPages.some(page => currentPath.includes(page));

        if (!isAllowedPage) {
          // إعادة التوجيه إلى صفحة البصمة
          console.log('⚠️ الموظف العادي لا يمكنه الوصول إلى هذه الصفحة. إعادة التوجيه إلى البصمة...');
          if (document.body) {
            document.body.style.display = '';
          }
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

