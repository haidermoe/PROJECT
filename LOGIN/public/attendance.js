/**
 * ======================================================
 * Attendance Management – JavaScript
 * ======================================================
 */

let currentLocation = null;
let isInsideRestaurant = false;
let watchId = null;

// التحقق من التوكن عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', async function() {
  // التأكد من أن requireAuth متاحة
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة! تأكد من تحميل auth-check.js');
    window.location.replace("/index.html?error=login_required");
    return;
  }

  // استخدام دالة التحقق الموحدة
  const authValid = await requireAuth();
  
  if (!authValid) {
    return;
  }

  // ✅ التوكن صحيح - تهيئة الصفحة
  initializeAttendance();
});

// تهيئة صفحة البصمة
function initializeAttendance() {
  // تحديث الوقت الحالي
  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);

  // تحديد الموقع
  getCurrentLocation();

  // تحميل حالة البصمة
  loadCurrentStatus();

  // تحميل السجلات
  loadMyRecords();

  // تحميل الإحصائيات
  loadMyStats();
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
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ API Error:', res.status, errorText);
      return { status: "error", message: `خطأ ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("❌ خطأ في API:", error);
    return { status: "error", message: error.message };
  }
}

// ---------------------------------------------
// تحديث الوقت الحالي
// ---------------------------------------------
function updateCurrentTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('ar-EG', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
  const dateStr = now.toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const timeEl = document.getElementById("currentTime");
  if (timeEl) {
    timeEl.textContent = `${timeStr} - ${dateStr}`;
  }
}

// ---------------------------------------------
// تحديد الموقع
// ---------------------------------------------
function getCurrentLocation() {
  if (!navigator.geolocation) {
    document.getElementById("locationText").textContent = "المتصفح لا يدعم تحديد الموقع";
    return;
  }

  const locationStatus = document.getElementById("locationStatus");
  
  // الحصول على الموقع
  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      // التحقق من أن المستخدم داخل المطعم
      // يمكنك تعديل هذه الإحداثيات لتطابق موقع المطعم الفعلي
      const restaurantLocation = {
        latitude: 33.3152, // مثال: بغداد
        longitude: 44.3661,
        radius: 100 // نصف القطر بالمتر (100 متر)
      };

      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        restaurantLocation.latitude,
        restaurantLocation.longitude
      );

      isInsideRestaurant = distance <= restaurantLocation.radius;

      if (isInsideRestaurant) {
        locationStatus.className = "location-status inside";
        locationStatus.querySelector(".location-text").textContent = 
          `✅ أنت داخل المطعم (دقة: ${Math.round(currentLocation.accuracy)}م)`;
      } else {
        locationStatus.className = "location-status outside";
        locationStatus.querySelector(".location-text").textContent = 
          `❌ أنت خارج المطعم (المسافة: ${Math.round(distance)}م)`;
      }

      // مراقبة الموقع
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          currentLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy
          };
          
          const dist = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            restaurantLocation.latitude,
            restaurantLocation.longitude
          );
          
          isInsideRestaurant = dist <= restaurantLocation.radius;
          
          if (isInsideRestaurant) {
            locationStatus.className = "location-status inside";
            locationStatus.querySelector(".location-text").textContent = 
              `✅ أنت داخل المطعم (دقة: ${Math.round(currentLocation.accuracy)}م)`;
          } else {
            locationStatus.className = "location-status outside";
            locationStatus.querySelector(".location-text").textContent = 
              `❌ أنت خارج المطعم (المسافة: ${Math.round(dist)}م)`;
          }
        },
        (error) => {
          console.error("❌ خطأ في تحديد الموقع:", error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    },
    (error) => {
      console.error("❌ خطأ في تحديد الموقع:", error);
      locationStatus.className = "location-status outside";
      locationStatus.querySelector(".location-text").textContent = 
        "❌ فشل تحديد الموقع. يرجى السماح بالوصول إلى الموقع";
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}

// ---------------------------------------------
// حساب المسافة بين نقطتين (Haversine formula)
// ---------------------------------------------
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // نصف قطر الأرض بالمتر
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // المسافة بالمتر
}

// ---------------------------------------------
// تحميل حالة البصمة الحالية
// ---------------------------------------------
async function loadCurrentStatus() {
  try {
    const res = await API("GET", "/api/attendance/status");

    if (res.status === "success" && res.data) {
      const isCheckedIn = res.data.is_checked_in;
      
      const statusIcon = document.getElementById("statusIcon");
      const statusText = document.getElementById("statusText");
      const statusTime = document.getElementById("statusTime");
      const checkInBtn = document.getElementById("checkInBtn");
      const checkOutBtn = document.getElementById("checkOutBtn");

      if (isCheckedIn) {
        statusIcon.textContent = "✅";
        statusText.textContent = "تم تسجيل الدخول";
        const checkInTime = new Date(res.data.check_in_time);
        statusTime.textContent = `وقت الدخول: ${checkInTime.toLocaleString('ar-EG')}`;
        checkInBtn.style.display = "none";
        checkOutBtn.style.display = "flex";
      } else {
        statusIcon.textContent = "⏰";
        statusText.textContent = "لم يتم تسجيل الدخول";
        statusTime.textContent = "";
        checkInBtn.style.display = "flex";
        checkOutBtn.style.display = "none";
      }
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل حالة البصمة:", error);
  }
}

// ---------------------------------------------
// تسجيل دخول
// ---------------------------------------------
async function handleCheckIn() {
  try {
    // التحقق من الموقع
    if (!isInsideRestaurant) {
      alert("⚠️ يجب أن تكون داخل المطعم لتسجيل الدخول");
      return;
    }

    if (!currentLocation) {
      alert("⚠️ جاري تحديد الموقع... يرجى الانتظار");
      return;
    }

    const locationStr = `${currentLocation.latitude},${currentLocation.longitude}`;

    const checkInBtn = document.getElementById("checkInBtn");
    if (checkInBtn) {
      checkInBtn.disabled = true;
      checkInBtn.querySelector(".btn-text").textContent = "⏳ جاري التسجيل...";
    }

    const res = await API("POST", "/api/attendance/checkin", {
      location: locationStr,
      notes: null
    });

    if (res.status === "success") {
      alert("✅ تم تسجيل الدخول بنجاح!");
      await loadCurrentStatus();
      await loadMyRecords();
      await loadMyStats();
    } else {
      alert("❌ خطأ: " + (res.message || "حدث خطأ أثناء تسجيل الدخول"));
    }

    if (checkInBtn) {
      checkInBtn.disabled = false;
      checkInBtn.querySelector(".btn-text").textContent = "تسجيل دخول";
    }
  } catch (error) {
    console.error("❌ خطأ في تسجيل الدخول:", error);
    alert("❌ حدث خطأ: " + error.message);
    
    const checkInBtn = document.getElementById("checkInBtn");
    if (checkInBtn) {
      checkInBtn.disabled = false;
      checkInBtn.querySelector(".btn-text").textContent = "تسجيل دخول";
    }
  }
}

// ---------------------------------------------
// تسجيل خروج
// ---------------------------------------------
async function handleCheckOut() {
  try {
    // التحقق من الموقع
    if (!isInsideRestaurant) {
      alert("⚠️ يجب أن تكون داخل المطعم لتسجيل الخروج");
      return;
    }

    if (!currentLocation) {
      alert("⚠️ جاري تحديد الموقع... يرجى الانتظار");
      return;
    }

    const locationStr = `${currentLocation.latitude},${currentLocation.longitude}`;

    const checkOutBtn = document.getElementById("checkOutBtn");
    if (checkOutBtn) {
      checkOutBtn.disabled = true;
      checkOutBtn.querySelector(".btn-text").textContent = "⏳ جاري التسجيل...";
    }

    const res = await API("POST", "/api/attendance/checkout", {
      location: locationStr,
      notes: null
    });

    if (res.status === "success") {
      const workHours = res.data.work_hours || 0;
      alert(`✅ تم تسجيل الخروج بنجاح!\nساعات العمل: ${workHours} ساعة`);
      await loadCurrentStatus();
      await loadMyRecords();
      await loadMyStats();
    } else {
      alert("❌ خطأ: " + (res.message || "حدث خطأ أثناء تسجيل الخروج"));
    }

    if (checkOutBtn) {
      checkOutBtn.disabled = false;
      checkOutBtn.querySelector(".btn-text").textContent = "تسجيل خروج";
    }
  } catch (error) {
    console.error("❌ خطأ في تسجيل الخروج:", error);
    alert("❌ حدث خطأ: " + error.message);
    
    const checkOutBtn = document.getElementById("checkOutBtn");
    if (checkOutBtn) {
      checkOutBtn.disabled = false;
      checkOutBtn.querySelector(".btn-text").textContent = "تسجيل خروج";
    }
  }
}

// ---------------------------------------------
// تحميل سجلاتي
// ---------------------------------------------
async function loadMyRecords() {
  try {
    const startDate = document.getElementById("filterStartDate")?.value || "";
    const endDate = document.getElementById("filterEndDate")?.value || "";

    let endpoint = "/api/attendance/my-records?limit=50";
    if (startDate) endpoint += `&start_date=${startDate}`;
    if (endDate) endpoint += `&end_date=${endDate}`;

    const res = await API("GET", endpoint);

    const tbody = document.querySelector("#myRecordsTable tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (res.status === "success" && res.data && res.data.length > 0) {
      res.data.forEach((record) => {
        const row = document.createElement("tr");

        const checkInTime = record.check_in_time 
          ? new Date(record.check_in_time) 
          : null;
        const checkOutTime = record.check_out_time 
          ? new Date(record.check_out_time) 
          : null;

        const dateStr = checkInTime ? checkInTime.toLocaleDateString('ar-EG') : '—';
        const checkInStr = checkInTime ? checkInTime.toLocaleTimeString('ar-EG') : '—';
        const checkOutStr = checkOutTime ? checkOutTime.toLocaleTimeString('ar-EG') : '—';
        const workHoursStr = record.work_hours ? `${record.work_hours} ساعة` : '—';
        const statusStr = record.status === 'checked_in' ? '⏳ داخل' : '✅ خارج';

        row.innerHTML = `
          <td>${dateStr}</td>
          <td>${checkInStr}</td>
          <td>${checkOutStr}</td>
          <td>${workHoursStr}</td>
          <td>${statusStr}</td>
        `;

        tbody.appendChild(row);
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>لا توجد سجلات</td></tr>";
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل السجلات:", error);
    const tbody = document.querySelector("#myRecordsTable tbody");
    if (tbody) {
      tbody.innerHTML = "<tr><td colspan='5' style='text-align:center;'>حدث خطأ في تحميل البيانات</td></tr>";
    }
  }
}

// ---------------------------------------------
// تحميل إحصائياتي
// ---------------------------------------------
async function loadMyStats() {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const monthStart = startOfMonth.toISOString().split('T')[0];
    const weekStart = startOfWeek.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    // إحصائيات الشهر
    const monthRes = await API("GET", `/api/attendance/my-records?start_date=${monthStart}&end_date=${today}&limit=1000`);
    let totalHoursMonth = 0;
    let totalDaysMonth = 0;
    if (monthRes.status === "success" && monthRes.data) {
      monthRes.data.forEach(record => {
        if (record.work_hours) {
          totalHoursMonth += parseFloat(record.work_hours);
        }
        if (record.status === 'checked_out') {
          totalDaysMonth++;
        }
      });
    }

    // إحصائيات الأسبوع
    const weekRes = await API("GET", `/api/attendance/my-records?start_date=${weekStart}&end_date=${today}&limit=1000`);
    let totalHoursWeek = 0;
    if (weekRes.status === "success" && weekRes.data) {
      weekRes.data.forEach(record => {
        if (record.work_hours) {
          totalHoursWeek += parseFloat(record.work_hours);
        }
      });
    }

    document.getElementById("totalHoursMonth").textContent = totalHoursMonth.toFixed(2);
    document.getElementById("totalHoursWeek").textContent = totalHoursWeek.toFixed(2);
    document.getElementById("totalDays").textContent = totalDaysMonth;
  } catch (error) {
    console.error("❌ خطأ في تحميل الإحصائيات:", error);
  }
}

