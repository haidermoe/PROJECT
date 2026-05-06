/* ======================================================
   Payroll Logic - HRMS Integration
====================================================== */

document.addEventListener('DOMContentLoaded', async function() {
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة! تأكد من تحميل auth-check.js');
    window.location.replace("/index.html?error=login_required");
    return;
  }
  const authValid = await requireAuth();
  if (!authValid) return;

  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      if (user.role !== 'hr' && user.role !== 'admin') {
        alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة');
        window.location.href = "/attendance.html";
        return;
      }
    } catch (e) {
      window.location.href = "/index.html?error=login_required";
      return;
    }
  }

  // Bind Generate Button
  const btn = document.getElementById("calculatePayrollBtn");
  if (btn) {
    btn.addEventListener("click", calculatePayroll);
  }

  loadPeriods();
  loadSalaries();
});

// ---------------------------------------------
// Tabs
// ---------------------------------------------
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  
  if(tabName === 'processing') {
    document.getElementById('tabProcessing').classList.add('active');
    document.getElementById('btnTabProcessing').classList.add('active');
  } else {
    document.getElementById('tabSettings').classList.add('active');
    document.getElementById('btnTabSettings').classList.add('active');
    loadSalaries(); // Refresh list just in case
  }
}

// ---------------------------------------------
// API Helper
// ---------------------------------------------
async function API(method, endpoint, body = null) {
  const token = localStorage.getItem("token");
  if (!token) {
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
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("❌ API Error:", error);
    return { status: "error", message: error.message };
  }
}

// ---------------------------------------------
// Periods
// ---------------------------------------------
async function loadPeriods() {
  const select = document.getElementById("periodSelect");
  select.innerHTML = '<option value="">جاري التحميل...</option>';
  
  const res = await API("GET", "/api/payroll/periods");
  select.innerHTML = '<option value="">-- اختر فترة --</option>';
  
  if (res.status === "success" && res.data.length > 0) {
    res.data.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      // Format ex: أسبوع 1 يناير (2026-01-01 -> 2026-01-07) [مفتوح]
      const s = p.status === 'open' ? '🟢 مفتوح' : '🔴 مغلق';
      opt.textContent = `${p.title} (${p.start_date.substring(0,10)} -> ${p.end_date.substring(0,10)}) [${s}]`;
      select.appendChild(opt);
    });
  } else {
    select.innerHTML = '<option value="">لا توجد فترات متاحة حالياً</option>';
  }
}

function openNewPeriodModal() {
  document.getElementById('periodModal').style.display = 'flex';
}

async function saveNewPeriod() {
  const title = document.getElementById('modalPeriodTitle').value;
  const start = document.getElementById('modalPeriodStart').value;
  const end = document.getElementById('modalPeriodEnd').value;

  if(!title || !start || !end) {
    alert("يرجى تعبئة جميع الحقول!");
    return;
  }

  const res = await API("POST", "/api/payroll/periods", {
    title: title,
    start_date: start,
    end_date: end
  });

  if (res.status === "success") {
    alert("تم فتح الفترة بنجاح!");
    document.getElementById('periodModal').style.display = 'none';
    loadPeriods();
  } else {
    alert("خطأ: " + res.message);
  }
}

// ---------------------------------------------
// Load Processing Table
// ---------------------------------------------
async function loadPayrollForPeriod() {
  const periodId = document.getElementById("periodSelect").value;
  if (!periodId) {
    alert("يرجى اختيار فترة");
    return;
  }
  
  const tbody = document.getElementById("payrollTableBody");
  tbody.innerHTML = "<tr><td colspan='7' class='loading-row'>جاري التحميل...</td></tr>";
  
  const res = await API("GET", `/api/payroll/records/${periodId}`);
  if (res.status === "success") {
    tbody.innerHTML = "";
    
    let totalPayroll = 0;
    let employeeCount = res.data.length;

    if (employeeCount === 0) {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>لا توجد سجلات. الرجاء ضغط (حساب الرواتب التلقائي) للاستخراج.</td></tr>";
    }

    res.data.forEach(r => {
      const net = parseFloat(r.net_pay) || 0;
      totalPayroll += net;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${r.full_name || r.username} <div style="font-size:10px; color:#aaa">${r.role}</div></td>
        <td>${parseFloat(r.base_pay).toFixed(2)}</td>
        <td>${parseFloat(r.scheduled_hours).toFixed(2)}</td>
        <td>${parseFloat(r.actual_hours).toFixed(2)}</td>
        <td style="color:#00ff88; font-weight:bold">+ ${parseFloat(r.overtime_hours).toFixed(2)}</td>
        <td style="color:#ff4444; font-weight:bold">- ${parseFloat(r.undertime_hours).toFixed(2)}</td>
        <td style="font-size:16px; font-weight:bold; color:gold">${net.toFixed(2)}</td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById("kpiEmployeesCount").textContent = employeeCount;
    document.getElementById("kpiTotalPayroll").textContent = totalPayroll.toFixed(2);
  } else {
    tbody.innerHTML = `<tr><td colspan='7' class='loading-row' style="color:red">خطأ: ${res.message}</td></tr>`;
  }
}

// ---------------------------------------------
// Calculate
// ---------------------------------------------
async function calculatePayroll() {
  const periodId = document.getElementById("periodSelect").value;
  if (!periodId) {
    alert("يرجى اختيار فترة لتوليد الحسابات");
    return;
  }

  const confirmMsg = "هل أنت متأكد؟ هذه العملية ستقوم بجلب ساعات التواجد والجداول الزمنية لإعادة حساب الرواتب لهذه الفترة بالكامل.";
  if(!confirm(confirmMsg)) return;

  document.getElementById("calculatePayrollBtn").textContent = "جاري الحساب...";
  document.getElementById("calculatePayrollBtn").disabled = true;

  const res = await API("POST", `/api/payroll/generate/${periodId}`);
  
  document.getElementById("calculatePayrollBtn").textContent = "حساب الرواتب التلقائي";
  document.getElementById("calculatePayrollBtn").disabled = false;

  if (res.status === "success") {
    alert(res.message);
    loadPayrollForPeriod(); // Refresh the table
  } else {
    alert("خطأ: " + res.message);
  }
}

// ---------------------------------------------
// Salaries Settings
// ---------------------------------------------
let currentEditUserId = null;

async function loadSalaries() {
  const tbody = document.getElementById("salaryTableBody");
  tbody.innerHTML = "<tr><td colspan='5'>جاري التحميل...</td></tr>";

  const res = await API("GET", "/api/payroll/salaries");
  if (res.status === "success") {
    tbody.innerHTML = "";
    res.data.forEach(emp => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${emp.full_name || emp.username}</td>
        <td>${emp.role}</td>
        <td style="font-weight:bold">${parseFloat(emp.base_salary).toFixed(2)}</td>
        <td style="font-weight:bold">${parseFloat(emp.hourly_rate).toFixed(2)}</td>
        <td>
          <button class="action-btn" onclick="openSalaryModal(${emp.user_id}, '${emp.full_name || emp.username}', ${emp.base_salary}, ${emp.hourly_rate})">تعديل الراتب</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = `<tr><td colspan='5' style="color:red">خطأ: ${res.message}</td></tr>`;
  }
}

function openSalaryModal(id, name, base, hourly) {
  currentEditUserId = id;
  document.getElementById("modalEmpName").value = name;
  document.getElementById("modalBaseSalary").value = base;
  document.getElementById("modalHourlyRate").value = hourly;
  document.getElementById("salaryModal").style.display = "flex";
}

async function saveSalary() {
  if(!currentEditUserId) return;

  const baseStr = document.getElementById("modalBaseSalary").value;
  const hourStr = document.getElementById("modalHourlyRate").value;

  if(baseStr==="" || hourStr==="") {
    alert("الرجاء تعبئة كل החقول.");
    return;
  }

  const res = await API("PUT", `/api/payroll/salaries/${currentEditUserId}`, {
    base_salary: parseFloat(baseStr),
    hourly_rate: parseFloat(hourStr)
  });

  if (res.status === "success") {
    alert("تم الحفظ بنجاح!");
    document.getElementById("salaryModal").style.display = "none";
    loadSalaries(); // Refresh table
  } else {
    alert("خطأ: " + res.message);
  }
}
