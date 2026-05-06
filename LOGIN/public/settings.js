/**
 * ======================================================
 * Settings Page - صفحة الإعدادات
 * ======================================================
 */

let settingsDirty = false;
let activeTab = 'general';
let editingStationId = null;
let allStationsData = [];

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
  const tabs = Array.from(document.querySelectorAll('#settingsMenu .tab-btn'));
  const panels = Array.from(document.querySelectorAll('#tabPanels > .tab-panel'));
  if (!tabs.length || !panels.length) return;

  const openTab = (tabName, skipConfirm = false) => {
    if (!skipConfirm && settingsDirty && activeTab === 'attendance') {
      const proceed = confirm('لديك تغييرات غير محفوظة في إعدادات البصمة. هل تريد المتابعة بدون حفظ؟');
      if (!proceed) return;
    }

    panels.forEach((panel) => {
      const visible = panel.id === `panel-${tabName}`;
      panel.classList.toggle('active', visible);
      panel.hidden = !visible;
    });

    if (tabName === 'printing') {
      showPrintMenu();
    }

    document.getElementById('settingsMenu').style.display = 'none';
    document.getElementById('tabPanels').style.display = 'block';
    document.getElementById('backToMenu').style.display = 'block';
    document.getElementById('tabsLayout').classList.add('single-view');

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
  } else {
    showSettingsMenu();
  }
}

function showSettingsMenu() {
  const tabsLayout = document.getElementById('tabsLayout');
  const settingsMenu = document.getElementById('settingsMenu');
  const tabPanels = document.getElementById('tabPanels');
  const backToMenu = document.getElementById('backToMenu');
  
  if (settingsMenu) settingsMenu.style.display = 'grid';
  if (tabPanels) tabPanels.style.display = 'none';
  if (backToMenu) backToMenu.style.display = 'none';
  if (tabsLayout) tabsLayout.classList.remove('single-view');
  
  activeTab = null;
  const url = new URL(window.location.href);
  url.searchParams.delete('tab');
  window.history.replaceState({}, '', url.toString());
}

function showPrintMenu() {
  document.getElementById('printMenu').style.display = 'grid';
  document.getElementById('printSubPanels').style.display = 'none';
  document.getElementById('backToPrintMenu').style.display = 'none';
}

function openPrintSubTab(subTabName) {
  document.getElementById('printMenu').style.display = 'none';
  document.getElementById('printSubPanels').style.display = 'block';
  document.getElementById('backToPrintMenu').style.display = 'block';
  
  const subPanels = Array.from(document.querySelectorAll('.print-sub-panel'));
  subPanels.forEach(panel => {
    panel.style.display = panel.id === `panel-${subTabName}` ? 'block' : 'none';
  });
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
    allStationsData = stationsRes.data || [];
    renderStations(allStationsData);
    fillStationSelect(allStationsData);
    fillFallbackSelect(allStationsData);
  }
  if (itemsRes.status === 'success') {
    renderPosItems(itemsRes.data || []);
  }
  await loadPrintConfig();
  await loadPrintQueue();
}

function renderStations(stations) {
  const grid = document.getElementById('printersGrid');
  if (!grid) return;
  if (!stations.length) {
    grid.innerHTML = `<div style="text-align:center; color:#8892b0; width:100%; grid-column: 1 / -1; padding: 20px;">لا توجد محطات/طابعات مسجلة حتى الآن.</div>`;
    return;
  }
  
  grid.innerHTML = stations.map((s) => {
    const fallback = s.fallback_station_id ? stations.find(fs => fs.id === s.fallback_station_id)?.station_name : 'بدون';
    
    return `
      <div class="printer-card ${!s.is_active ? 'inactive' : ''}">
        <div class="printer-card-header">
          <h4 class="printer-card-title">${s.station_name}</h4>
          <span class="printer-card-code">${s.station_code}</span>
        </div>
        
        <div class="printer-card-body">
          <div class="printer-card-info">
            <span class="printer-card-info-label">النوع:</span>
            <span class="printer-card-info-value">${s.station_type}</span>
          </div>
          <div class="printer-card-info">
            <span class="printer-card-info-label">الربط:</span>
            <span class="printer-card-info-value" style="font-family: monospace;">
              ${s.connection_type === 'usb' ? 'USB' : 'Network'} - ${s.printer_ip}${s.connection_type !== 'usb' && s.printer_port ? ':' + s.printer_port : ''}
            </span>
          </div>
          <div class="printer-card-info">
            <span class="printer-card-info-label">الطابعة البديلة:</span>
            <span class="printer-card-info-value">${fallback}</span>
          </div>
          <div class="printer-card-info">
            <span class="printer-card-info-label">الحالة:</span>
            <span class="printer-card-info-value" style="color: ${s.is_active ? '#00ff88' : '#ff6b6b'};">
              ${s.is_active ? '✅ تعمل' : '⛔ متوقفة'}
            </span>
          </div>
        </div>

        <div class="printer-card-actions">
          <button class="btn-card-edit" onclick="editStation(${s.id})">✏️ تعديل</button>
          <button class="btn-card-toggle ${s.is_active ? 'on' : 'off'}" onclick="toggleStationStatus(${s.id}, ${s.is_active})">
            ${s.is_active ? '🛑 إيقاف' : '▶️ تشغيل'}
          </button>
          ${s.is_active ? `<button class="btn-card-test" onclick="testPrinter(${s.id}, '${escapeHtml(s.station_name)}')">🧪 تيست</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function fillFallbackSelect(stations) {
  const select = document.getElementById('stationFallbackId');
  if (!select) return;
  const activeStations = stations.filter(s => s.is_active);
  let html = '<option value="">بدون طابعة بديلة</option>';
  html += activeStations.map(s => `<option value="${s.id}">${s.station_name} (${s.station_code})</option>`).join('');
  select.innerHTML = html;
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

async function saveStation() {
  const payload = {
    stationCode: document.getElementById('stationCode')?.value.trim(),
    stationName: document.getElementById('stationName')?.value.trim(),
    stationType: document.getElementById('stationType')?.value,
    connectionType: document.getElementById('stationConnectionType')?.value || 'network',
    printerIp: document.getElementById('stationPrinterIp')?.value.trim(),
    printerPort: Number(document.getElementById('stationPrinterPort')?.value || 9100),
    fallbackStationId: document.getElementById('stationFallbackId')?.value || null,
    isActive: document.getElementById('stationIsActive')?.checked
  };

  if (!payload.stationCode || !payload.stationName || !payload.stationType || !payload.printerIp) {
    alert('❌ يرجى إدخال كل بيانات المحطة');
    return;
  }

  let res;
  if (editingStationId) {
    res = await API('PUT', `/api/pos/stations/${editingStationId}`, payload);
  } else {
    res = await API('POST', '/api/pos/stations', payload);
  }

  if (res.status === 'success') {
    alert(editingStationId ? '✅ تم تحديث بيانات المحطة' : '✅ تمت إضافة المحطة بنجاح');
    clearStationForm();
    loadPrinterSettings();
  } else {
    alert(`❌ ${res.message || 'فشل حفظ المحطة'}`);
  }
}

function editStation(id) {
  const station = allStationsData.find(s => s.id === id);
  if (!station) return;
  
  editingStationId = id;
  document.getElementById('stationCode').value = station.station_code;
  document.getElementById('stationName').value = station.station_name;
  document.getElementById('stationType').value = station.station_type;
  document.getElementById('stationConnectionType').value = station.connection_type || 'network';
  document.getElementById('stationPrinterIp').value = station.printer_ip;
  document.getElementById('stationPrinterPort').value = station.printer_port;
  document.getElementById('stationFallbackId').value = station.fallback_station_id || '';
  document.getElementById('stationIsActive').checked = station.is_active;

  document.getElementById('btnSaveStation').innerHTML = '💾 حفظ التعديلات';
  document.getElementById('btnCancelEditStation').style.display = 'inline-block';
  document.getElementById('stationCode').focus();
}

function clearStationForm() {
  editingStationId = null;
  document.getElementById('stationCode').value = '';
  document.getElementById('stationName').value = '';
  document.getElementById('stationType').value = 'kitchen';
  document.getElementById('stationConnectionType').value = 'network';
  document.getElementById('stationPrinterIp').value = '';
  document.getElementById('stationPrinterPort').value = '9100';
  document.getElementById('stationFallbackId').value = '';
  document.getElementById('stationIsActive').checked = true;

  document.getElementById('btnSaveStation').innerHTML = '➕ إضافة محطة';
  document.getElementById('btnCancelEditStation').style.display = 'none';
}

async function toggleStationStatus(id, currentStatus) {
  if (!confirm(`هل أنت متأكد من ${currentStatus ? 'إيقاف' : 'تشغيل'} هذه الطابعة؟`)) return;
  const res = await API('PUT', `/api/pos/stations/${id}`, { isActive: !currentStatus });
  if (res.status === 'success') {
    loadPrinterSettings();
  } else {
    alert(`❌ فشل تغيير حالة الطابعة: ${res.message}`);
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
  if (document.getElementById('receiptHeaderText')) document.getElementById('receiptHeaderText').value = cfg.receipt_header_text || '';
  if (document.getElementById('receiptFooterText')) document.getElementById('receiptFooterText').value = cfg.receipt_footer_text || '';
  if (document.getElementById('bottomMarginLines')) document.getElementById('bottomMarginLines').value = Number(cfg.bottom_margin_lines || 3);
  if (document.getElementById('borderCharacter')) document.getElementById('borderCharacter').value = cfg.border_character || '-';
  if (document.getElementById('logoPath')) document.getElementById('logoPath').value = cfg.logo_path || '';
  if (document.getElementById('lineSpacing')) document.getElementById('lineSpacing').value = Number(cfg.line_spacing || 4);
  if (document.getElementById('cutPaper')) document.getElementById('cutPaper').checked = Boolean(cfg.cut_paper);
  if (document.getElementById('openCashDrawer')) document.getElementById('openCashDrawer').checked = Boolean(cfg.open_cash_drawer);
  if (document.getElementById('boldItems')) document.getElementById('boldItems').checked = Boolean(cfg.bold_items);
  if (document.getElementById('showLogo')) document.getElementById('showLogo').checked = Boolean(cfg.show_logo);
  
  updateLivePreview();
}

function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64Str = e.target.result;
    document.getElementById('logoPath').value = base64Str;
    const showLogoCheckbox = document.getElementById('showLogo');
    if (showLogoCheckbox) showLogoCheckbox.checked = true;
    updateLivePreview();
  };
  reader.readAsDataURL(file);
}

function updateLivePreview() {
  const widthMm = document.getElementById('paperWidthMm')?.value || '80';
  const paper = document.getElementById('liveReceiptPaper');
  if (paper) paper.style.width = widthMm + 'mm';
  
  const fontScale = document.getElementById('fontScale')?.value || '1';
  if (paper) paper.style.fontSize = fontScale === '1' ? '12px' : fontScale === '2' ? '16px' : '20px';
  
  const lineSpacing = document.getElementById('lineSpacing')?.value || '4';
  if (paper) paper.style.lineHeight = `calc(1em + ${lineSpacing}px)`;
  
  const boldItems = document.getElementById('boldItems')?.checked;
  const itemsContainer = document.getElementById('previewItems');
  if (itemsContainer) itemsContainer.style.fontWeight = boldItems ? 'bold' : 'normal';
  
  const headerText = document.getElementById('receiptHeaderText')?.value;
  const previewHeader = document.getElementById('previewHeader');
  if (previewHeader) {
    previewHeader.innerText = headerText || '';
    const headerScale = document.getElementById('headerFontScale')?.value || '2';
    previewHeader.style.fontSize = headerScale === '1' ? '1em' : headerScale === '2' ? '1.5em' : '2em';
  }
  
  const footerText = document.getElementById('receiptFooterText')?.value;
  const previewFooter = document.getElementById('previewFooter');
  if (previewFooter) previewFooter.innerText = footerText || '';
  
  const borderChar = document.getElementById('borderCharacter')?.value || '-';
  const borderString = borderChar.repeat(50);
  for (let i = 1; i <= 4; i++) {
    const b = document.getElementById('previewBorder' + i);
    if (b) b.innerText = borderString;
  }
  
  const showLogo = document.getElementById('showLogo')?.checked;
  const logoBase64 = document.getElementById('logoPath')?.value;
  const logoImg = document.getElementById('previewLogoImage');
  if (logoImg) {
    logoImg.src = logoBase64 || '';
    logoImg.style.display = (showLogo && logoBase64) ? 'inline-block' : 'none';
  }
  
  const bottomMargin = document.getElementById('bottomMarginLines')?.value || '3';
  const previewMargin = document.getElementById('previewMargin');
  if (previewMargin) previewMargin.style.height = `${bottomMargin * 20}px`;
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
    receipt_header_text: document.getElementById('receiptHeaderText')?.value || '',
    receipt_footer_text: document.getElementById('receiptFooterText')?.value || '',
    bottom_margin_lines: Number(document.getElementById('bottomMarginLines')?.value || 3),
    border_character: document.getElementById('borderCharacter')?.value || '-',
    logo_path: document.getElementById('logoPath')?.value || '',
    line_spacing: Number(document.getElementById('lineSpacing')?.value || 4),
    cut_paper: document.getElementById('cutPaper')?.checked,
    open_cash_drawer: document.getElementById('openCashDrawer')?.checked,
    bold_items: document.getElementById('boldItems')?.checked,
    show_logo: document.getElementById('showLogo')?.checked
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
// Print Queue Management
// ---------------------------------------------
async function loadPrintQueue() {
  const tbody = document.querySelector('#queueTable tbody');
  if (!tbody) return;

  const res = await API('GET', '/api/pos/queue');
  if (res.status === 'success') {
    const queue = res.data || [];
    if (!queue.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">الطابور فارغ. جميع الطلبات تم طباعتها بنجاح.</td></tr>`;
      return;
    }

    tbody.innerHTML = queue.map(q => `
      <tr>
        <td>#${q.order_id}</td>
        <td>${q.station_name} (${q.ticket_type})</td>
        <td>${new Date(q.created_at).toLocaleString('en-GB')}</td>
        <td>${q.retry_count} / 3</td>
        <td>
          <span style="color: ${q.status === 'failed_permanently' ? 'red' : 'orange'}">
            ${q.status === 'pending' ? 'جاري المعالجة (Pending)' : 'فشل دائم (Permanently Failed)'}
          </span>
        </td>
        <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(q.last_error_message || '')}">
          ${escapeHtml(q.last_error_message || '')}
        </td>
        <td>
          <button class="btn-save" style="padding: 2px 8px; font-size: 12px;" onclick="retryQueueJob(${q.id})">🔄 إعادة</button>
          <button class="btn-cancel" style="padding: 2px 8px; font-size: 12px; margin-right: 5px;" onclick="deleteQueueJob(${q.id})">🗑️ حذف</button>
        </td>
      </tr>
    `).join('');
  }
}

async function retryAllQueue() {
  if (!confirm('هل تريد إعادة محاولة طباعة جميع المهام التي فشلت دائمًا؟')) return;
  const res = await API('POST', '/api/pos/queue', { action: 'retry_all' });
  if (res.status === 'success') {
    alert('✅ تم إرسال المهام للطابور مرة أخرى');
    loadPrintQueue();
  } else alert('❌ فشل');
}

async function clearAllQueue() {
  if (!confirm('هل أنت متأكد من حذف كل طابور الطباعة المعلق والفاشل؟')) return;
  const res = await API('POST', '/api/pos/queue', { action: 'delete_all' });
  if (res.status === 'success') {
    alert('✅ تم تفريغ الطابور');
    loadPrintQueue();
  } else alert('❌ فشل');
}

async function retryQueueJob(id) {
  const res = await API('POST', '/api/pos/queue', { action: 'retry', id });
  if (res.status === 'success') loadPrintQueue();
}

async function deleteQueueJob(id) {
  if (!confirm('حذف هذه المهمة من الطابور؟')) return;
  const res = await API('POST', '/api/pos/queue', { action: 'delete', id });
  if (res.status === 'success') loadPrintQueue();
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

