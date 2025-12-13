/**
 * ======================================================
 * Shifts Schedule Page - صفحة جداول الدوام
 * ======================================================
 */

let selectedEmployees = [];
let allEmployees = [];

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

  // التحقق من الصلاحيات (admin, manager, kitchen_manager)
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      const userRole = user.role;
      const allowedRoles = ['admin', 'manager', 'kitchen_manager'];
      
      if (!allowedRoles.includes(userRole)) {
        alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
        window.location.href = "/dashboard/dashboard.html";
        return;
      }
    } catch (e) {
      console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
      window.location.href = "/index.html?error=login_required";
      return;
    }
  }

  initializeShifts();
});

// تهيئة الصفحة
function initializeShifts() {
  setupEventListeners();
  loadSchedules();
  loadEmployees();
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
  const createBtn = document.getElementById('createScheduleBtn');
  if (createBtn) {
    createBtn.addEventListener('click', openCreateModal);
  }

  const modal = document.getElementById('createScheduleModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeCreateModal();
      }
    });
  }
}

// ---------------------------------------------
// تحميل قائمة الموظفين
// ---------------------------------------------
async function loadEmployees() {
  try {
    console.log('🔵 loadEmployees: جاري تحميل الموظفين...');
    const res = await API('GET', '/auth/users');
    console.log('🔵 loadEmployees: استجابة API:', res);
    
    if (res && res.status === 'success' && res.users) {
      allEmployees = res.users.filter(u => u.is_active === 1 || u.is_active === true);
      console.log('✅ loadEmployees: تم تحميل', allEmployees.length, 'موظف نشط');
      renderEmployeesList();
    } else {
      console.error('⚠️ loadEmployees: استجابة غير صحيحة:', res);
      allEmployees = [];
      renderEmployeesList();
    }
  } catch (error) {
    console.error('❌ خطأ في تحميل الموظفين:', error);
    allEmployees = [];
    renderEmployeesList();
  }
}

// عرض قائمة الموظفين في dropdown
function renderEmployeesList() {
  const select = document.getElementById('employeeSelect');
  if (!select) {
    console.log('⚠️ renderEmployeesList: employeeSelect غير موجود');
    return;
  }

  console.log('🔵 renderEmployeesList: عدد الموظفين:', allEmployees.length);
  console.log('🔵 renderEmployeesList: الموظفون المختارون:', selectedEmployees);

  // حفظ القيمة المختارة حالياً
  const currentValue = select.value;
  
  select.innerHTML = '<option value="">-- اختر موظف لإضافته --</option>';
  
  if (allEmployees.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'جاري تحميل الموظفين...';
    option.disabled = true;
    select.appendChild(option);
    return;
  }
  
  let addedCount = 0;
  allEmployees.forEach(emp => {
    // إضافة فقط الموظفين غير المختارين
    if (!selectedEmployees.includes(emp.id)) {
      const option = document.createElement('option');
      option.value = emp.id;
      const displayName = emp.full_name || emp.username || `موظف #${emp.id}`;
      option.textContent = displayName;
      select.appendChild(option);
      addedCount++;
    }
  });
  
  console.log('✅ renderEmployeesList: تم إضافة', addedCount, 'موظف إلى القائمة');
  
  // استعادة القيمة المختارة إذا كانت موجودة
  if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
    select.value = currentValue;
  }
  
  renderSelectedEmployeesList();
}

// إضافة موظف إلى الجدول
function addEmployeeToSchedule() {
  const select = document.getElementById('employeeSelect');
  if (!select || !select.value) {
    alert('⚠️ يرجى اختيار موظف أولاً');
    return;
  }
  
  const userId = parseInt(select.value);
  if (!selectedEmployees.includes(userId)) {
    selectedEmployees.push(userId);
    renderEmployeesList(); // تحديث القائمة لإزالة الموظف المختار
    buildShiftsTable();
  } else {
    alert('⚠️ هذا الموظف موجود بالفعل في الجدول');
  }
}

// عرض قائمة الموظفين المختارين
function renderSelectedEmployeesList() {
  const container = document.getElementById('selectedEmployeesList');
  if (!container) return;
  
  if (selectedEmployees.length === 0) {
    container.innerHTML = '<p style="color: #888; text-align: center; margin: 0; padding: 20px 0;">لم يتم اختيار موظفين بعد</p>';
    return;
  }
  
  let html = '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
  selectedEmployees.forEach(userId => {
    const emp = allEmployees.find(e => e.id === userId);
    if (!emp) return;
    
    const empName = emp.full_name || emp.username;
    html += `
      <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #2d2d44; border: 1px solid #3d3d5c; border-radius: 6px;">
        <span style="color: #ffffff;">${empName}</span>
        <button 
          type="button" 
          onclick="removeEmployeeFromSchedule(${userId})" 
          style="background: #dc3545; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;"
          title="إزالة"
        >✕</button>
      </div>
    `;
  });
  html += '</div>';
  
  container.innerHTML = html;
}

// إزالة موظف من الجدول
function removeEmployeeFromSchedule(userId) {
  selectedEmployees = selectedEmployees.filter(id => id !== userId);
  renderEmployeesList(); // تحديث القائمة لإضافة الموظف مرة أخرى
  buildShiftsTable();
}

// دالة قديمة (للتوافق)
function toggleEmployee(userId) {
  // لا شيء - نستخدم addEmployeeToSchedule و removeEmployeeFromSchedule
}

// ---------------------------------------------
// فتح Modal إنشاء جدول
// ---------------------------------------------
function openCreateModal() {
  const modal = document.getElementById('createScheduleModal');
  if (modal) {
    modal.classList.add('active');
    
    // تعيين تاريخ الأحد القادم كافتراضي
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = الأحد, 1 = الاثنين, ..., 6 = السبت
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7; // الأيام المتبقية حتى الأحد
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);
    
    const dateInput = document.getElementById('weekStartDate');
    if (dateInput) {
      dateInput.value = nextSunday.toISOString().split('T')[0];
    }
    
    selectedEmployees = [];
    document.getElementById('scheduleNotes').value = '';
    
    // التأكد من تحميل الموظفين ثم تحديث القائمة
    if (allEmployees.length === 0) {
      loadEmployees().then(() => {
        renderEmployeesList();
        buildShiftsTable();
      });
    } else {
      renderEmployeesList();
      buildShiftsTable();
    }
  }
}

// إغلاق Modal
function closeCreateModal() {
  const modal = document.getElementById('createScheduleModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

// ---------------------------------------------
// بناء جدول الدوام
// ---------------------------------------------
function buildShiftsTable() {
  const container = document.getElementById('shiftsTable');
  if (!container) return;

  if (selectedEmployees.length === 0) {
    container.innerHTML = '<p style="color: #888; text-align: center; padding: 40px 20px; background: rgba(255,255,255,0.05); border-radius: 8px; margin: 20px 0;">📋 يرجى اختيار موظفين من الأعلى لعرض جدول الدوام</p>';
    return;
  }

  // ترتيب الأيام من الأحد إلى السبت (كما في الصورة)
  const daysOfWeek = [
    { key: 'sunday', label: 'الأحد', order: 0 },
    { key: 'monday', label: 'الاثنين', order: 1 },
    { key: 'tuesday', label: 'الثلاثاء', order: 2 },
    { key: 'wednesday', label: 'الأربعاء', order: 3 },
    { key: 'thursday', label: 'الخميس', order: 4 },
    { key: 'friday', label: 'الجمعة', order: 5 },
    { key: 'saturday', label: 'السبت', order: 6 }
  ];

  // حساب التواريخ (التاريخ المدخل هو الأحد)
  const weekStartDate = document.getElementById('weekStartDate')?.value;
  let startDate = null;
  if (weekStartDate) {
    startDate = new Date(weekStartDate);
    // التأكد من أن التاريخ هو الأحد
    const dayOfWeek = startDate.getDay();
    if (dayOfWeek !== 0) { // إذا لم يكن الأحد
      // نبحث عن الأحد السابق
      const daysToSunday = dayOfWeek;
      startDate.setDate(startDate.getDate() - daysToSunday);
    }
  }

  let html = '<table class="weekly-schedule-table"><thead><tr><th>الاسم</th>';
  
  daysOfWeek.forEach(day => {
    let dateStr = '';
    if (startDate) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + day.order);
      dateStr = dayDate.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    html += `<th>
      <div class="day-header">${day.label}</div>
      ${dateStr ? `<div class="day-date">${dateStr}</div>` : ''}
    </th>`;
  });
  
  html += '</tr></thead><tbody>';

  selectedEmployees.forEach(userId => {
    const emp = allEmployees.find(e => e.id === userId);
    if (!emp) return;

    const empName = emp.full_name || emp.username;
    html += `<tr><td class="employee-name">${empName}</td>`;
    
    daysOfWeek.forEach(day => {
      html += `
        <td>
          <div class="time-inputs">
            <input 
              type="text" 
              placeholder="08:00" 
              pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
              maxlength="5"
              data-user-id="${userId}" 
              data-day="${day.key}" 
              data-type="start"
              oninput="formatTimeInput(this)"
            />
            <span class="time-separator">-</span>
            <input 
              type="text" 
              placeholder="17:00" 
              pattern="^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
              maxlength="5"
              data-user-id="${userId}" 
              data-day="${day.key}" 
              data-type="end"
              oninput="formatTimeInput(this)"
            />
          </div>
        </td>
      `;
    });
    
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// تنسيق إدخال الوقت
function formatTimeInput(input) {
  let value = input.value.replace(/[^0-9]/g, '');
  
  if (value.length >= 2) {
    value = value.substring(0, 2) + ':' + value.substring(2, 4);
  }
  
  if (value.length > 5) {
    value = value.substring(0, 5);
  }
  
  input.value = value;
}

// ---------------------------------------------
// حفظ جدول الدوام
// ---------------------------------------------
async function saveSchedule() {
  try {
    // توليد العنوان تلقائياً
    const weekStartDate = document.getElementById('weekStartDate').value;
    const notes = document.getElementById('scheduleNotes').value.trim();
    
    // توليد العنوان من التاريخ
    let title = 'جدول الدوام الأسبوعي';
    if (weekStartDate) {
      const date = new Date(weekStartDate);
      const dateStr = date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
      title = `جدول الدوام الأسبوعي - ${dateStr}`;
    }

    if (!weekStartDate) {
      alert('❌ يرجى اختيار تاريخ بداية الأسبوع (الأحد)');
      return;
    }
    
    // التحقق من أن التاريخ المحدد هو الأحد
    const selectedDate = new Date(weekStartDate);
    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek !== 0) {
      alert('⚠️ يرجى اختيار تاريخ الأحد (بداية الأسبوع)');
      return;
    }

    if (selectedEmployees.length === 0) {
      alert('❌ يرجى اختيار موظفين على الأقل');
      return;
    }

    const shifts = [];
    const timePattern = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

    selectedEmployees.forEach(userId => {
      // ترتيب الأيام من الأحد إلى السبت (كما في الصورة)
      ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].forEach(day => {
        const startInput = document.querySelector(
          `input[data-user-id="${userId}"][data-day="${day}"][data-type="start"]`
        );
        const endInput = document.querySelector(
          `input[data-user-id="${userId}"][data-day="${day}"][data-type="end"]`
        );

        if (startInput && endInput) {
          const startTime = startInput.value.trim();
          const endTime = endInput.value.trim();

          if (startTime && endTime) {
            if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
              alert(`❌ تنسيق الوقت غير صحيح في ${day}. يجب أن يكون HH:MM (مثلاً: 08:00)`);
              throw new Error('Invalid time format');
            }

            shifts.push({
              user_id: userId,
              day: day,
              start_time: startTime,
              end_time: endTime,
              break_duration: 0
            });
          }
        }
      });
    });

    if (shifts.length === 0) {
      alert('❌ يرجى إدخال دوام على الأقل ليوم واحد');
      return;
    }

    const btn = document.querySelector('#createScheduleModal .btn-save');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ جاري الحفظ...';
    }

    const res = await API('POST', '/api/shifts', {
      title,
      week_start_date: weekStartDate,
      shifts,
      notes: notes || null
    });

    if (res.status === 'success') {
      alert('✅ تم إنشاء جدول الدوام بنجاح وتم إرساله للموافقة');
      closeCreateModal();
      loadSchedules();
    } else {
      alert('❌ فشل إنشاء جدول الدوام: ' + (res.message || 'خطأ غير معروف'));
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = '💾 حفظ وإرسال للموافقة';
    }
  } catch (error) {
    console.error('❌ خطأ في حفظ جدول الدوام:', error);
    alert('❌ حدث خطأ: ' + error.message);
    
    const btn = document.querySelector('#createScheduleModal .btn-save');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💾 حفظ وإرسال للموافقة';
    }
  }
}

// ---------------------------------------------
// تحميل جداول الدوام
// ---------------------------------------------
async function loadSchedules() {
  try {
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    let endpoint = '/api/shifts?limit=50';
    if (statusFilter) {
      endpoint += `&status=${statusFilter}`;
    }

    const res = await API('GET', endpoint);
    const container = document.getElementById('schedulesTable');
    if (!container) return;

    if (res.status === 'success' && res.data && res.data.length > 0) {
      const statusNames = {
        'draft': 'مسودة',
        'pending_approval': 'في انتظار الموافقة',
        'approved': 'معتمد',
        'published': 'منشور',
        'rejected': 'مرفوض'
      };

      let html = `
        <table>
          <thead>
            <tr>
              <th>العنوان</th>
              <th>الأسبوع</th>
              <th>المنشئ</th>
              <th>الحالة</th>
              <th>تاريخ الإنشاء</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody>
      `;

      res.data.forEach(schedule => {
        const startDate = new Date(schedule.week_start_date);
        const endDate = new Date(schedule.week_end_date);
        const weekStr = `${startDate.toLocaleDateString('ar-EG')} - ${endDate.toLocaleDateString('ar-EG')}`;
        
        const createdDate = new Date(schedule.created_at);
        const createdStr = createdDate.toLocaleDateString('ar-EG');

        html += `
          <tr>
            <td>${schedule.title}</td>
            <td>${weekStr}</td>
            <td>${schedule.creator_name || 'غير معروف'}</td>
            <td><span class="status-badge status-${schedule.status}">${statusNames[schedule.status] || schedule.status}</span></td>
            <td>${createdStr}</td>
            <td>
              <button class="btn-mini view" onclick="viewSchedule(${schedule.id})" title="عرض">👁️</button>
            </td>
          </tr>
        `;
      });

      html += '</tbody></table>';
      container.innerHTML = html;
    } else {
      container.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">لا توجد جداول دوام</p>';
    }
  } catch (error) {
    console.error('❌ خطأ في تحميل جداول الدوام:', error);
  }
}

// عرض تفاصيل جدول دوام
async function viewSchedule(id) {
  try {
    const res = await API('GET', `/api/shifts/${id}`);
    
    if (res.status !== 'success' || !res.data) {
      alert('❌ فشل تحميل تفاصيل الجدول');
      return;
    }

    const schedule = res.data.schedule;
    const shifts = res.data.shifts || [];
    
    // فتح نافذة جديدة لعرض الجدول
    const printWindow = window.open('', '_blank');
    
    // ترتيب الأيام من الأحد إلى السبت
    const daysOfWeek = [
      { key: 'sunday', label: 'الأحد', order: 0 },
      { key: 'monday', label: 'الاثنين', order: 1 },
      { key: 'tuesday', label: 'الثلاثاء', order: 2 },
      { key: 'wednesday', label: 'الأربعاء', order: 3 },
      { key: 'thursday', label: 'الخميس', order: 4 },
      { key: 'friday', label: 'الجمعة', order: 5 },
      { key: 'saturday', label: 'السبت', order: 6 }
    ];

    // حساب التواريخ - نبدأ من الأحد دائماً
    const startDate = new Date(schedule.week_start_date);
    const dayOfWeek = startDate.getDay(); // 0 = الأحد, 1 = الاثنين, ..., 6 = السبت
    let weekStartSunday = new Date(startDate);
    
    // إذا لم يكن التاريخ المحدد هو الأحد، نحسب الأحد السابق
    if (dayOfWeek !== 0) {
      weekStartSunday.setDate(startDate.getDate() - dayOfWeek);
    }

    // تجميع البيانات حسب الموظف (البيانات تأتي من API كـ array من objects، كل object يحتوي على user_id و shifts object)
    const shiftsByEmployee = {};
    shifts.forEach(employeeData => {
      const userId = employeeData.user_id;
      shiftsByEmployee[userId] = {
        name: employeeData.full_name || employeeData.username || 'غير معروف',
        shifts: employeeData.shifts || {}
      };
    });

    // بناء HTML للجدول
    let tableHTML = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${schedule.title}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            direction: rtl;
          }
          .schedule-header {
            text-align: center;
            margin-bottom: 20px;
          }
          .schedule-header h1 {
            font-size: 24px;
            margin-bottom: 10px;
          }
          .schedule-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #000;
            padding: 10px;
            text-align: center;
          }
          th {
            background-color: #f0f0f0;
            font-weight: bold;
          }
          .day-header {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .day-date {
            font-size: 12px;
            color: #666;
          }
          .employee-name {
            font-weight: bold;
            text-align: right;
          }
          .time-cell {
            font-size: 14px;
          }
          @media print {
            body { padding: 10px; }
            .print-btn { display: none; }
          }
          .print-btn {
            margin: 20px 0;
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
          }
          .print-btn:hover {
            background: #45a049;
          }
        </style>
      </head>
      <body>
        <div class="schedule-header">
          <h1>الجدول الاسبوعي</h1>
        </div>
        <div class="schedule-info">
          <div>
            <strong>العنوان:</strong> ${schedule.title || ''}
          </div>
          <div>
            <span>مطعم:</span> <input type="text" style="border: none; border-bottom: 1px solid #000; width: 100px;">
            <span>فرع:</span> <input type="text" style="border: none; border-bottom: 1px solid #000; width: 100px;">
          </div>
        </div>
        <button class="print-btn" onclick="window.print()">🖨️ طباعة</button>
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
    `;

    daysOfWeek.forEach(day => {
      const dayDate = new Date(weekStartSunday);
      dayDate.setDate(weekStartSunday.getDate() + day.order);
      const dateStr = dayDate.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' });
      
      tableHTML += `
        <th>
          <div class="day-header">${day.label}</div>
          <div class="day-date">${dateStr}</div>
        </th>
      `;
    });

    tableHTML += '</tr></thead><tbody>';

    // إضافة صفوف الموظفين
    Object.keys(shiftsByEmployee).forEach(userId => {
      const employeeData = shiftsByEmployee[userId];
      const empName = employeeData.name;
      const userShifts = employeeData.shifts;
      
      tableHTML += `<tr><td class="employee-name">${empName}</td>`;
      
      daysOfWeek.forEach(day => {
        const shift = userShifts[day.key];
        let startTime = '';
        let endTime = '';
        
        if (shift) {
          // التحويل من TIME إلى تنسيق HH:MM
          if (shift.start_time) {
            const startParts = String(shift.start_time).split(':');
            startTime = startParts[0] + ':' + (startParts[1] || '00');
          }
          if (shift.end_time) {
            const endParts = String(shift.end_time).split(':');
            endTime = endParts[0] + ':' + (endParts[1] || '00');
          }
        }
        
        const timeStr = startTime && endTime ? `${startTime} - ${endTime}` : '';
        
        tableHTML += `<td class="time-cell">${timeStr}</td>`;
      });
      
      tableHTML += '</tr>';
    });

    tableHTML += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(tableHTML);
    printWindow.document.close();
  } catch (error) {
    console.error('❌ خطأ في عرض الجدول:', error);
    alert('❌ حدث خطأ في عرض الجدول: ' + error.message);
  }
}

// تطبيق الفلاتر
function applyFilters() {
  loadSchedules();
}

// تحديث الجدول عند تغيير تاريخ الأسبوع
document.addEventListener('DOMContentLoaded', function() {
  const weekStartInput = document.getElementById('weekStartDate');
  if (weekStartInput) {
    weekStartInput.addEventListener('change', function() {
      if (selectedEmployees.length > 0) {
        buildShiftsTable();
      }
    });
  }
});

