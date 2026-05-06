/**
 * ======================================================
 * Settings Page - صفحة الإعدادات
 * ======================================================
 */

let settingsDirty = false;
let activeTab = 'general';

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
  initializeTabs();
  loadSettings();
  loadPrinterSettings();
  setupEventListeners();
}

function initializeTabs() {
  const tabs = Array.from(document.querySelectorAll('.tab-btn'));
  const panels = Array.from(document.querySelectorAll('.tab-panel'));
  if (!tabs.length || !panels.length) return;

  const openTab = (tabName, skipConfirm = false) => {
    if (tabName === activeTab) return;
    if (!skipConfirm && settingsDirty && activeTab === 'attendance') {
      const proceed = confirm('لديك تغييرات غير محفوظة في إعدادات البصمة. هل تريد المتابعة بدون حفظ؟');
      if (!proceed) return;
    }

    tabs.forEach((tab) => {
      const selected = tab.dataset.tab === tabName;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });

    panels.forEach((panel) => {
      const visible = panel.id === `panel-${tabName}`;
      panel.classList.toggle('active', visible);
      panel.hidden = !visible;
    });

    activeTab = tabName;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tabName);
    window.history.replaceState({}, '', url.toString());
  };

  tabs.forEach((tab, index) => {
    tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
    tab.addEventListener('click', () => openTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      const nextIndex = event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      openTab(tabs[nextIndex].dataset.tab);
    });
  });

  const urlTab = new URL(window.location.href).searchParams.get('tab');
  if (urlTab && tabs.some(t => t.dataset.tab === urlTab)) {
    openTab(urlTab, true);
  }
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
  const latitudeInput = document.getElementById('latitude');
  const longitudeInput = document.getElementById('longitude');
  const radiusInput = document.getElementById('radius');

  if (workHoursStartInput) {
    workHoursStartInput.addEventListener('input', () => formatTo24Hour(workHoursStartInput));
    workHoursStartInput.addEventListener('blur', () => enforce24HourFormat(workHoursStartInput));
    workHoursStartInput.addEventListener('input', markSettingsDirty);
  }
  if (workHoursEndInput) {
    workHoursEndInput.addEventListener('input', () => formatTo24Hour(workHoursEndInput));
    workHoursEndInput.addEventListener('blur', () => enforce24HourFormat(workHoursEndInput));
    workHoursEndInput.addEventListener('input', markSettingsDirty);
  }
  if (latitudeInput) latitudeInput.addEventListener('input', markSettingsDirty);
  if (longitudeInput) longitudeInput.addEventListener('input', markSettingsDirty);
  if (radiusInput) radiusInput.addEventListener('input', markSettingsDirty);
}

function markSettingsDirty() {
  settingsDirty = true;
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
      settingsDirty = false;
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
      settingsDirty = false;
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
// POS Printer Settings
// ---------------------------------------------
async function loadPrinterSettings() {
  const [stationsRes, itemsRes] = await Promise.all([
    API('GET', '/api/pos/stations'),
    API('GET', '/api/pos/items')
  ]);

  if (stationsRes.status === 'success') {
    renderStations(stationsRes.data || []);
    fillStationSelect(stationsRes.data || []);
  }
  if (itemsRes.status === 'success') {
    renderPosItems(itemsRes.data || []);
  }
  await loadPrintConfig();
}

function renderStations(stations) {
  const tbody = document.querySelector('#stationsTable tbody');
  if (!tbody) return;
  if (!stations.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">لا توجد محطات</td></tr>`;
    return;
  }
  tbody.innerHTML = stations.map((s) => `
    <tr>
      <td>${s.station_code}</td>
      <td>${s.station_name}</td>
      <td>${s.station_type}</td>
      <td>${s.printer_ip}</td>
      <td>${s.printer_port}</td>
      <td>${s.is_active ? '✅ فعال' : '⛔ غير فعال'}</td>
      <td>
        ${s.is_active
          ? `<button class="btn-test" onclick="testPrinter(${s.id}, '${escapeHtml(s.station_name)}')">اختبار</button>`
          : '-'}
      </td>
    </tr>
  `).join('');
}

function fillStationSelect(stations) {
  const select = document.getElementById('posItemStation');
  if (!select) return;
  const activeStations = stations.filter(s => s.is_active);
  if (!activeStations.length) {
    select.innerHTML = '<option value="">لا توجد محطات فعالة</option>';
    return;
  }
  select.innerHTML = activeStations.map((s) => (
    `<option value="${s.id}">${s.station_name} (${s.station_code})</option>`
  )).join('');
}

function renderPosItems(items) {
  const tbody = document.querySelector('#posItemsTable tbody');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;">لا توجد أصناف</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((item) => `
    <tr>
      <td>${item.item_name}</td>
      <td>${Number(item.price).toFixed(2)}</td>
      <td>${item.station_name} (${item.station_code})</td>
    </tr>
  `).join('');
}

async function addStation() {
  const payload = {
    stationCode: document.getElementById('stationCode')?.value.trim(),
    stationName: document.getElementById('stationName')?.value.trim(),
    stationType: document.getElementById('stationType')?.value,
    printerIp: document.getElementById('stationPrinterIp')?.value.trim(),
    printerPort: Number(document.getElementById('stationPrinterPort')?.value || 9100),
    isActive: true
  };

  if (!payload.stationCode || !payload.stationName || !payload.stationType || !payload.printerIp) {
    alert('❌ يرجى إدخال كل بيانات المحطة');
    return;
  }

  const res = await API('POST', '/api/pos/stations', payload);
  if (res.status === 'success') {
    alert('✅ تمت إضافة المحطة بنجاح');
    loadPrinterSettings();
  } else {
    alert(`❌ ${res.message || 'فشل إضافة المحطة'}`);
  }
}

async function addPosItem() {
  const payload = {
    itemName: document.getElementById('posItemName')?.value.trim(),
    price: Number(document.getElementById('posItemPrice')?.value || 0),
    stationId: Number(document.getElementById('posItemStation')?.value)
  };

  if (!payload.itemName || !payload.stationId) {
    alert('❌ يرجى إدخال اسم الصنف واختيار المحطة');
    return;
  }

  const res = await API('POST', '/api/pos/items', payload);
  if (res.status === 'success') {
    alert('✅ تمت إضافة الصنف بنجاح');
    loadPrinterSettings();
  } else {
    alert(`❌ ${res.message || 'فشل إضافة الصنف'}`);
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function loadPrintConfig() {
  const res = await API('GET', '/api/pos/print-config');
  if (res.status !== 'success' || !res.data) return;

  const cfg = res.data;
  if (document.getElementById('paperWidthMm')) document.getElementById('paperWidthMm').value = String(cfg.paper_width_mm || 80);
  if (document.getElementById('fontFamily')) document.getElementById('fontFamily').value = String(cfg.font_family || 'A');
  if (document.getElementById('fontScale')) document.getElementById('fontScale').value = Number(cfg.font_scale || 1);
  if (document.getElementById('headerFontScale')) document.getElementById('headerFontScale').value = Number(cfg.header_font_scale || 2);
  if (document.getElementById('charsPerLine')) document.getElementById('charsPerLine').value = Number(cfg.chars_per_line || 48);
  if (document.getElementById('printCopies')) document.getElementById('printCopies').value = Number(cfg.print_copies || 1);
  if (document.getElementById('printerTimeoutMs')) document.getElementById('printerTimeoutMs').value = Number(cfg.printer_timeout_ms || 7000);
  if (document.getElementById('cutPaper')) document.getElementById('cutPaper').checked = Boolean(cfg.cut_paper);
  if (document.getElementById('openCashDrawer')) document.getElementById('openCashDrawer').checked = Boolean(cfg.open_cash_drawer);
}

async function savePrintConfig() {
  const payload = {
    paper_width_mm: Number(document.getElementById('paperWidthMm')?.value || 80),
    font_family: document.getElementById('fontFamily')?.value || 'A',
    font_scale: Number(document.getElementById('fontScale')?.value || 1),
    header_font_scale: Number(document.getElementById('headerFontScale')?.value || 2),
    chars_per_line: Number(document.getElementById('charsPerLine')?.value || 48),
    print_copies: Number(document.getElementById('printCopies')?.value || 1),
    printer_timeout_ms: Number(document.getElementById('printerTimeoutMs')?.value || 7000),
    cut_paper: document.getElementById('cutPaper')?.checked ? 'true' : 'false',
    open_cash_drawer: document.getElementById('openCashDrawer')?.checked ? 'true' : 'false'
  };

  const res = await API('PUT', '/api/pos/print-config', payload);
  if (res.status === 'success') {
    alert('✅ تم حفظ إعدادات الطباعة');
  } else {
    alert(`❌ ${res.message || 'فشل حفظ إعدادات الطباعة'}`);
  }
}

async function testPrinter(stationId, stationName) {
  if (!confirm(`إرسال اختبار طباعة إلى: ${stationName} ؟`)) return;
  const res = await API('POST', `/api/pos/stations/${stationId}/test-print`, {});
  if (res.status === 'success') {
    alert(`✅ ${res.message || 'تم إرسال الاختبار'}`);
  } else {
    alert(`❌ ${res.message || 'فشل اختبار الطابعة'}`);
  }
}

async function testAllPrinters() {
  if (!confirm('إرسال اختبار طباعة إلى جميع الطابعات الفعالة؟')) return;
  const res = await API('POST', '/api/pos/stations/test-print-all', {});
  if (res.status === 'success') {
    const failed = (res.data || []).filter(r => r.status === 'failed');
    if (!failed.length) {
      alert('✅ تم اختبار جميع الطابعات بنجاح');
    } else {
      const lines = failed.map(f => `- ${f.stationName}: ${f.error || 'فشل'}`).join('\n');
      alert(`⚠️ بعض الطابعات فشلت:\n${lines}`);
    }
  } else {
    alert(`❌ ${res.message || 'فشل اختبار الطابعات'}`);
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

