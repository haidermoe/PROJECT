/**
 * ======================================================
 * Settings Page - صفحة الإعدادات
 * ======================================================
 */

// التحقق من التوكن عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async function() {
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة!');
    window.location.replace("/index.html?error=login_required");
    return;
  }

  const authValid = await requireAuth();
  if (!authValid) {
    return;
  }

  // التحقق من الصلاحيات (admin only)
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      const userRole = user.role;
      
      if (userRole !== 'admin') {
        alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة. يجب أن تكون مدير عام (admin)');
        window.location.href = "/dashboard/dashboard.html";
        return;
      }
    } catch (e) {
      console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
      window.location.href = "/index.html?error=login_required";
      return;
    }
  }

  initializeSettings();
});

// تهيئة الصفحة
function initializeSettings() {
  loadSettings();
  setupEventListeners();
}

// ---------------------------------------------
// API Helper
// ---------------------------------------------
async function API(method, endpoint, body = null) {
  const token = localStorage.getItem("token");
  
  if (!token) {
    console.error("❌ لا يوجد توكن");
    alert("جلسة منتهية. يرجى تسجيل الدخول مرة أخرى");
    window.location.href = "/index.html";
    return { status: "error", message: "لا يوجد توكن" };
  }

  const config = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  };
  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(endpoint, config);
    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      const text = await res.text();
      console.error("❌ خطأ في تحليل الاستجابة:", text);
      return { 
        status: "error", 
        message: "خطأ في استجابة السيرفر: " + (text || `خطأ ${res.status}`)
      };
    }
    
    if (!res.ok) {
      const errorMsg = data.message || data.error || `خطأ ${res.status}: ${res.statusText}`;
      return { status: "error", message: errorMsg };
    }
    
    return data;
  } catch (error) {
    console.error("❌ خطأ في API:", error);
    return { status: "error", message: error.message || "خطأ في الاتصال بالسيرفر" };
  }
}

// ---------------------------------------------
// إعداد Event Listeners
// ---------------------------------------------
function setupEventListeners() {
  const workHoursStartInput = document.getElementById('workHoursStart');
  const workHoursEndInput = document.getElementById('workHoursEnd');

  if (workHoursStartInput) {
    workHoursStartInput.addEventListener('input', () => formatTo24Hour(workHoursStartInput));
    workHoursStartInput.addEventListener('blur', () => enforce24HourFormat(workHoursStartInput));
  }
  if (workHoursEndInput) {
    workHoursEndInput.addEventListener('input', () => formatTo24Hour(workHoursEndInput));
    workHoursEndInput.addEventListener('blur', () => enforce24HourFormat(workHoursEndInput));
  }
}

// تنسيق إدخال الوقت إلى 24 ساعة
function formatTo24Hour(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  if (value.length > 4) value = value.substring(0, 4);

  if (value.length >= 3) {
    value = value.substring(0, 2) + ':' + value.substring(2);
  }
  input.value = value;
}

// التحقق من صحة تنسيق 24 ساعة
function enforce24HourFormat(input) {
  let value = input.value;
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (!timeRegex.test(value)) {
    if (value.length === 4 && /^\d{4}$/.test(value)) {
      value = value.substring(0, 2) + ':' + value.substring(2);
      if (timeRegex.test(value)) {
        input.value = value;
        return;
      }
    }
    alert('❌ صيغة الوقت غير صحيحة. يجب أن تكون بصيغة HH:MM (مثلاً: 08:00 أو 17:30)');
    input.value = input.defaultValue || '08:00';
  }
}

// ---------------------------------------------
// تحميل الإعدادات
// ---------------------------------------------
async function loadSettings() {
  try {
    const res = await API('GET', '/api/settings');
    if (res.status === 'success' && res.data) {
      const settings = res.data;
      
      if (settings.checkin_location_latitude) {
        document.getElementById('latitude').value = settings.checkin_location_latitude;
      }
      if (settings.checkin_location_longitude) {
        document.getElementById('longitude').value = settings.checkin_location_longitude;
      }
      if (settings.checkin_location_radius) {
        document.getElementById('radius').value = settings.checkin_location_radius;
      }
      if (settings.work_hours_start) {
        document.getElementById('workHoursStart').value = settings.work_hours_start;
        document.getElementById('workHoursStart').defaultValue = settings.work_hours_start;
      }
      if (settings.work_hours_end) {
        document.getElementById('workHoursEnd').value = settings.work_hours_end;
        document.getElementById('workHoursEnd').defaultValue = settings.work_hours_end;
      }
    }
  } catch (error) {
    console.error('❌ خطأ في تحميل الإعدادات:', error);
    alert('❌ فشل تحميل الإعدادات: ' + error.message);
  }
}

// ---------------------------------------------
// حفظ الإعدادات
// ---------------------------------------------
async function saveSettings() {
  try {
    const latitude = document.getElementById('latitude').value.trim();
    const longitude = document.getElementById('longitude').value.trim();
    const radius = document.getElementById('radius').value.trim();
    const workHoursStart = document.getElementById('workHoursStart').value.trim();
    const workHoursEnd = document.getElementById('workHoursEnd').value.trim();

    const settingsData = {};

    if (latitude) settingsData.checkin_location_latitude = parseFloat(latitude);
    if (longitude) settingsData.checkin_location_longitude = parseFloat(longitude);
    if (radius) settingsData.checkin_location_radius = parseFloat(radius);
    if (workHoursStart) settingsData.work_hours_start = workHoursStart;
    if (workHoursEnd) settingsData.work_hours_end = workHoursEnd;

    const btn = document.querySelector('.btn-save');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ جاري الحفظ...';
    }

    const res = await API('PUT', '/api/settings', settingsData);

    if (res.status === 'success') {
      alert('✅ تم حفظ الإعدادات بنجاح');
    } else {
      alert('❌ فشل حفظ الإعدادات: ' + (res.message || 'خطأ غير معروف'));
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = '💾 حفظ الإعدادات';
    }
  } catch (error) {
    console.error('❌ خطأ في حفظ الإعدادات:', error);
    alert('❌ حدث خطأ: ' + error.message);
    
    const btn = document.querySelector('.btn-save');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💾 حفظ الإعدادات';
    }
  }
}

// ---------------------------------------------
// الحصول على الموقع الحالي
// ---------------------------------------------
function getCurrentLocationForSettings() {
  if (!navigator.geolocation) {
    alert('❌ المتصفح لا يدعم تحديد الموقع');
    return;
  }

  const btn = document.querySelector('.btn-get-location');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ جاري الحصول على الموقع...';
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      document.getElementById('latitude').value = lat.toFixed(6);
      document.getElementById('longitude').value = lng.toFixed(6);
      
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📍 الحصول على موقعي الحالي';
      }
      
      alert(`✅ تم الحصول على الموقع:\nخط العرض: ${lat.toFixed(6)}\nخط الطول: ${lng.toFixed(6)}`);
    },
    (error) => {
      console.error('❌ خطأ في تحديد الموقع:', error);
      alert('❌ فشل تحديد الموقع: ' + error.message);
      
      if (btn) {
        btn.disabled = false;
        btn.textContent = '📍 الحصول على موقعي الحالي';
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// ---------------------------------------------
// مسح الموقع
// ---------------------------------------------
function clearLocation() {
  if (confirm('هل أنت متأكد من مسح الموقع؟')) {
    document.getElementById('latitude').value = '';
    document.getElementById('longitude').value = '';
  }
}

