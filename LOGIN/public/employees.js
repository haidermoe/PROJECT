/* ======================================================
   Employees Management – Admin Only (Westig System)
====================================================== */

let currentEditId = null;

function canManageEmployeesAccount(role) {
  return role === 'admin' || role === 'hr';
}

// ---------------------------------------------
// 1) حماية الصفحة - التحقق من التوكن والصلاحيات
// ---------------------------------------------
// الانتظار حتى يتم تحميل auth-check.js
document.addEventListener('DOMContentLoaded', async function() {
  // التأكد من أن requireAuth متاحة
  if (typeof requireAuth === 'undefined') {
    console.error('❌ requireAuth غير متاحة! تأكد من تحميل auth-check.js');
    // إعادة توجيه لتسجيل الدخول
    window.location.replace("/index.html?error=login_required");
    return;
  }

  // استخدام دالة التحقق الموحدة
  const authValid = await requireAuth();
  
  if (!authValid) {
    // تم إعادة التوجيه تلقائياً في requireAuth
    return;
  }

  // التحقق من الصلاحيات (يجب أن يكون مدير)
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      console.log('👤 المستخدم الحالي في initializeEmployees:', user.username, 'الرتبة:', user.role);
      if (!canManageEmployeesAccount(user.role)) {
        console.error('❌ صلاحية غير كافية، الرتبة:', user.role);
        alert('⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة (مدير عام أو موارد بشرية)');
        window.location.href = "/dashboard/dashboard.html";
        return;
      }
      console.log('✅ مسموح بالوصول إلى صفحة الموظفين');
    } catch (e) {
      console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
      window.location.href = "/index.html?error=login_required";
      return;
    }
  } else {
    console.error('❌ لا توجد بيانات مستخدم في localStorage!');
    window.location.href = "/index.html?error=login_required";
    return;
  }

  // ✅ التوكن صحيح والصلاحيات كافية - تهيئة الصفحة
  initializeEmployees();
});

// تهيئة صفحة الموظفين
function initializeEmployees() {
  // إعداد event listeners
  setupListeners();
  
  // تحميل البيانات
  loadEmployeesPage();
}

// ---------------------------------------------
// 2) API Helper
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
    console.log("📤 إرسال البيانات:", body);
  }

  try {
    console.log(`📡 API Request: ${method} ${endpoint}`);
    const res = await fetch(endpoint, config);
    
    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      const text = await res.text();
      console.error("❌ خطأ في تحليل الاستجابة:", text);
      return { 
        status: "error", 
        message: "خطأ في استجابة السيرفر: " + text.substring(0, 100) 
      };
    }
    
    console.log(`📥 API Response (${res.status}):`, data);
    
    if (!res.ok) {
      console.error("❌ خطأ في API:", {
        status: res.status,
        statusText: res.statusText,
        data: data
      });
      
      if (res.status === 401 || res.status === 403) {
        alert("صلاحيات غير كافية أو جلسة منتهية: " + (data.message || ""));
        window.location.href = "/index.html";
      } else {
        // عرض رسالة الخطأ للمستخدم
        const errorMsg = data.message || `خطأ ${res.status}: ${res.statusText}`;
        console.error("❌ رسالة الخطأ:", errorMsg);
      }
    }
    
    return data;
  } catch (error) {
    console.error("❌ خطأ في الاتصال:", error);
    console.error("❌ تفاصيل الخطأ:", error.message);
    return { 
      status: "error", 
      message: "خطأ في الاتصال بالسيرفر: " + error.message 
    };
  }
}

// ---------------------------------------------
// 3) إعداد Event Listeners
// ---------------------------------------------
function setupListeners() {
  // زر إضافة موظف
  const addUserBtn = document.getElementById("addUserBtn");
  if (addUserBtn) {
    addUserBtn.addEventListener("click", () => {
      document.getElementById("addModal").classList.add("active");
    });
  }

  // زر إلغاء إضافة
  const cancelAdd = document.getElementById("cancelAdd");
  if (cancelAdd) {
    cancelAdd.addEventListener("click", () => {
      document.getElementById("addModal").classList.remove("active");
      clearAddFields();
    });
  }

  // زر حفظ إضافة
  const saveAdd = document.getElementById("saveAdd");
  if (saveAdd) {
    saveAdd.addEventListener("click", async () => {
      await handleAddUser();
    });
  }

  // إضافة إمكانية الضغط على Enter في حقول المودال
  const addModal = document.getElementById("addModal");
  if (addModal) {
    const inputs = addModal.querySelectorAll("input, select");
    inputs.forEach(input => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAddUser();
        }
      });
    });
  }

  // إضافة إمكانية الضغط على Enter في حقول مودال التعديل
  const editModal = document.getElementById("editModal");
  if (editModal) {
    const inputs = editModal.querySelectorAll("input, select");
    inputs.forEach(input => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleEditUser();
        }
      });
    });
  }

  // زر إلغاء تعديل
  const cancelEdit = document.getElementById("cancelEdit");
  if (cancelEdit) {
    cancelEdit.addEventListener("click", () => {
      document.getElementById("editModal").classList.remove("active");
      currentEditId = null;
      clearEditFields();
    });
  }

  // زر حفظ تعديل
  const saveEdit = document.getElementById("saveEdit");
  if (saveEdit) {
    saveEdit.addEventListener("click", async () => {
      await handleEditUser();
    });
  }

  // إغلاق المودال عند النقر خارجها
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        if (modal.id === 'addModal') clearAddFields();
        if (modal.id === 'editModal') {
          currentEditId = null;
          clearEditFields();
        }
      }
    });
  });

  // زر رفع إكسل
  const importExcelBtn = document.getElementById("importExcelBtn");
  const excelFileInput = document.getElementById("excelFileInput");
  if (importExcelBtn && excelFileInput) {
    importExcelBtn.addEventListener("click", () => {
      excelFileInput.click();
    });

    excelFileInput.addEventListener("change", async (e) => {
      if (e.target.files.length > 0) {
        await handleExcelUpload(e.target.files[0]);
        e.target.value = ''; // Reset
      }
    });
  }
}

// ---------------------------------------------
// 4) تحميل البيانات الأساسية
// ---------------------------------------------
async function loadEmployeesPage() {
  await loadKPIs();
  await loadTable();
  await loadStats();
}

// ---------------------------------------------
// 5) KPIs
// ---------------------------------------------
async function loadKPIs() {
  try {
    const res = await API("GET", "/auth/users");
    
    if (res.status === "success" && res.users) {
      const users = res.users;
      const total = users.length;
      const active = users.filter(u => u.is_active === 1).length;
      const admins = users.filter(u => u.role === 'admin').length;
      const employees = users.filter(u => u.role === 'employee').length;

      document.getElementById("kpiTotalUsers").textContent = total;
      document.getElementById("kpiActiveUsers").textContent = active;
      document.getElementById("kpiAdmins").textContent = admins;
      document.getElementById("kpiEmployees").textContent = employees;
    }
  } catch (error) {
    console.error("خطأ في تحميل KPIs:", error);
  }
}

// ---------------------------------------------
// 6) جدول الموظفين
// ---------------------------------------------
async function loadTable() {
  try {
    console.log('📥 جاري تحميل قائمة الموظفين...');
    
    // التحقق من أن المستخدم admin
    const userData = localStorage.getItem('user');
    if (userData) {
      try {
        const user = JSON.parse(userData);
        console.log('👤 المستخدم الحالي:', user.username, 'الرتبة:', user.role);
        if (!canManageEmployeesAccount(user.role)) {
          console.error('❌ ليس لديك صلاحية عرض الموظفين');
          const tbody = document.querySelector("#usersTable tbody");
          if (tbody) {
            tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:red;'>⚠️ ليس لديك صلاحية لعرض الموظفين</td></tr>";
          }
          return;
        }
      } catch (e) {
        console.error('❌ خطأ في قراءة بيانات المستخدم:', e);
      }
    }
    
    console.log('📡 جاري إرسال طلب إلى /auth/users...');
    const res = await API("GET", "/auth/users");
    
    console.log('📥 استجابة API:', res);
    console.log('📥 نوع الاستجابة:', typeof res);
    console.log('📥 status:', res?.status);
    console.log('📥 users:', res?.users);
    console.log('📥 عدد المستخدمين:', res?.users?.length);

    const tbody = document.querySelector("#usersTable tbody");
    if (!tbody) {
      console.error('❌ لم يتم العثور على جدول الموظفين');
      return;
    }
    
    tbody.innerHTML = "";

    // التحقق من الاستجابة
    if (!res) {
      throw new Error('لا توجد استجابة من السيرفر');
    }

    if (res.status === "error") {
      throw new Error(res.message || 'حدث خطأ في جلب البيانات');
    }

    if (res.status === "success") {
      // التحقق من وجود users في الاستجابة
      const users = res.users || [];
      
      if (Array.isArray(users) && users.length > 0) {
        console.log('✅ تم جلب', users.length, 'موظف');
        
        // عرض جميع الموظفين (نشطين وغير نشطين)
        users.forEach((user, index) => {
          const row = document.createElement("tr");

          const roleNames = {
            'admin': '👑 مدير عام',
            'hr': '👥 موارد بشرية',
            'manager': '👔 مدير',
            'kitchen_manager': '👨‍🍳 مدير مطبخ',
            'kitchen_employee': '👨‍🍳 موظف مطبخ',
            'employee': '👤 موظف',
            'waiter': '🍽️ ويتر',
            'captain': '👔 كابتن',
            'cleaner': '🧹 عامل نظافة',
            'hall_manager': '🏢 مسؤول صالة',
            'hall_captain': '👔 كابتن صالة',
            'receptionist': '📞 موظف استقبال',
            'garage_employee': '🚗 موظف كراج',
            'garage_manager': '🚗 مسؤول كراج'
          };

          const status = user.is_active === 1 || user.is_active === true
            ? `<span style="color:#00ff88; font-weight:600;">✔ نشط</span>`
            : `<span style="color:#ff6b7a; font-weight:600;">✗ معطل</span>`;

          const date = user.created_at ? new Date(user.created_at) : new Date();
          const dateStr = date.toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });

          row.innerHTML = `
            <td>${user.username || '—'}</td>
            <td>${user.full_name || '—'}</td>
            <td>${roleNames[user.role] || user.role || '—'}</td>
            <td>${status}</td>
            <td>${dateStr}</td>
            <td style="text-align:center;">
              <button class="btn-mini edit" onclick="openEdit(${user.id})" title="تعديل">✏</button>
              <button class="btn-mini password" onclick="changePassword(${user.id})" title="تغيير كلمة المرور">🔑</button>
              <button class="btn-mini toggle" onclick="toggleUser(${user.id})" title="تفعيل/تعطيل">${user.is_active === 1 || user.is_active === true ? '🔒' : '🔓'}</button>
              <button class="btn-mini delete" onclick="deleteUser(${user.id})" title="حذف">🗑</button>
            </td>
          `;

          tbody.appendChild(row);
        });
        
        console.log('✅ تم عرض', users.length, 'موظف في الجدول');
      } else {
        console.log('⚠️ لا توجد موظفين في قاعدة البيانات');
        tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:#707789; padding:20px;'>لا توجد موظفين مسجلين في النظام</td></tr>";
      }
    } else {
      console.log('⚠️ استجابة غير متوقعة:', res);
      const errorMsg = res.message || 'استجابة غير متوقعة من السيرفر';
      tbody.innerHTML = `<tr><td colspan='6' style='text-align:center; color:#ff6b7a; padding:20px;'>⚠️ ${errorMsg}</td></tr>`;
    }
  } catch (error) {
    console.error("❌ خطأ في تحميل الموظفين:", error);
    console.error("❌ تفاصيل الخطأ:", error.message);
    console.error("❌ Stack:", error.stack);
    const tbody = document.querySelector("#usersTable tbody");
    if (tbody) {
      const errorMsg = error.message || 'حدث خطأ في تحميل البيانات';
      tbody.innerHTML = `<tr><td colspan='6' style='text-align:center; color:#ff6b7a; padding:20px;'>⚠️ ${errorMsg}</td></tr>`;
    }
  }
}

// ---------------------------------------------
// 7) الإحصائيات
// ---------------------------------------------
async function loadStats() {
  try {
    const res = await API("GET", "/auth/users");
    const list = document.getElementById("statsList");
    list.innerHTML = "";

    if (res.status === "success" && res.users) {
      const users = res.users;
      const stats = [
        `إجمالي الحسابات: ${users.length}`,
        `نشطين: ${users.filter(u => u.is_active === 1).length}`,
        `معطلين: ${users.filter(u => u.is_active === 0).length}`,
        `مديرين عامين: ${users.filter(u => u.role === 'admin').length}`,
        `موارد بشرية: ${users.filter(u => u.role === 'hr').length}`
      ];

      stats.forEach(stat => {
        const li = document.createElement("li");
        li.textContent = stat;
        list.appendChild(li);
      });
    }
  } catch (error) {
    console.error("خطأ في تحميل الإحصائيات:", error);
  }
}

// ---------------------------------------------
// 8) إضافة موظف
// ---------------------------------------------
async function handleAddUser() {
  // منع إرسال متعدد
  const saveBtn = document.getElementById("saveAdd");
  if (saveBtn && saveBtn.disabled) {
    return; // الطلب قيد المعالجة
  }

  const username = document.getElementById("userUsername")?.value.trim();
  const password = document.getElementById("userPassword")?.value;
  const fullName = document.getElementById("userFullName")?.value.trim();
  const role = document.getElementById("userRole")?.value;

  // التحقق من البيانات
  if (!username) {
    alert("⚠️ يرجى إدخال اسم المستخدم");
    document.getElementById("userUsername")?.focus();
    return;
  }

  if (!password) {
    alert("⚠️ يرجى إدخال كلمة المرور");
    document.getElementById("userPassword")?.focus();
    return;
  }

  if (password.length < 4) {
    alert("⚠️ كلمة المرور يجب أن تكون 4 أحرف على الأقل");
    document.getElementById("userPassword")?.focus();
    return;
  }

  // تعطيل الزر أثناء المعالجة
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "جاري الإضافة...";
  }

  try {
    console.log("📤 إرسال طلب إضافة موظف:", { username, role, fullName });
    
    const res = await API("POST", "/auth/users", {
      username,
      password,
      full_name: fullName || null,
      role: role || 'employee'
    });

    console.log("📥 استجابة السيرفر:", res);

    if (res && res.status === "success") {
      // إغلاق المودال
      document.getElementById("addModal").classList.remove("active");
      clearAddFields();
      
      // إعادة تحميل البيانات
      await loadEmployeesPage();
      
      // رسالة نجاح
      alert("✅ تم إضافة الموظف بنجاح!\n\nاسم المستخدم: " + username + "\nالرتبة: " + getRoleName(role || 'employee'));
    } else {
      const errorMsg = res?.message || res?.error || "حدث خطأ أثناء إضافة الموظف";
      console.error("❌ خطأ من السيرفر:", errorMsg);
      alert("❌ خطأ: " + errorMsg);
    }
  } catch (error) {
    console.error("❌ خطأ في إضافة الموظف:", error);
    alert("❌ حدث خطأ في الاتصال بالسيرفر: " + (error.message || "خطأ غير معروف"));
  } finally {
    // إعادة تفعيل الزر
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "إضافة";
    }
  }
}

// دالة مساعدة للحصول على اسم الرتبة
function getRoleName(role) {
  const roleNames = {
    'admin': '👑 مدير عام',
    'hr': '👥 موارد بشرية',
    'manager': '👔 مدير',
    'kitchen_manager': '👨‍🍳 مدير مطبخ',
    'kitchen_employee': '👨‍🍳 موظف مطبخ',
    'employee': '👤 موظف',
    'waiter': '🍽️ ويتر',
    'captain': '👔 كابتن',
    'cleaner': '🧹 عامل نظافة',
    'hall_manager': '🏢 مسؤول صالة',
    'hall_captain': '👔 كابتن صالة',
    'receptionist': '📞 موظف استقبال',
    'garage_employee': '🚗 موظف كراج',
    'garage_manager': '🚗 مسؤول كراج'
  };
  return roleNames[role] || role;
}

// ---------------------------------------------
// 9) تعديل موظف
// ---------------------------------------------
async function openEdit(id) {
  try {
    console.log('🔵 openEdit: فتح نافذة التعديل للمستخدم ID:', id);
    
    const res = await API("GET", "/auth/users");
    
    console.log('📥 openEdit: استجابة API:', res);
    
    if (res && res.status === "success" && res.users) {
      const user = res.users.find(u => u.id === id);
      
      console.log('🔍 openEdit: المستخدم المحدد:', user);
      
      if (user) {
        currentEditId = id;
        
        // ملء الحقول
        const editUsername = document.getElementById("editUsername");
        const editFullName = document.getElementById("editFullName");
        const editRole = document.getElementById("editRole");
        const editPassword = document.getElementById("editPassword");
        
        if (editUsername) editUsername.value = user.username || '';
        if (editFullName) editFullName.value = user.full_name || '';
        if (editRole) editRole.value = user.role || 'employee';
        if (editPassword) editPassword.value = '';
        
        // فتح المودال
        const editModal = document.getElementById("editModal");
        if (editModal) {
          editModal.classList.add("active");
          console.log('✅ openEdit: تم فتح نافذة التعديل بنجاح');
        } else {
          console.error('❌ openEdit: لم يتم العثور على editModal');
        }
      } else {
        console.error('❌ openEdit: لم يتم العثور على المستخدم مع ID:', id);
        alert("⚠️ لم يتم العثور على بيانات المستخدم");
      }
    } else {
      console.error('❌ openEdit: استجابة غير صحيحة من API:', res);
      alert("⚠️ حدث خطأ في تحميل بيانات المستخدم");
    }
  } catch (error) {
    console.error("❌ openEdit: خطأ في فتح التعديل:", error);
    console.error("❌ openEdit: تفاصيل الخطأ:", error.message);
    alert("❌ حدث خطأ في تحميل بيانات المستخدم: " + (error.message || "خطأ غير معروف"));
  }
}

async function handleEditUser() {
  if (!currentEditId) {
    console.error("❌ handleEditUser: لا يوجد currentEditId");
    alert("⚠️ خطأ: لم يتم تحديد المستخدم للتعديل");
    return;
  }

  // منع إرسال متعدد
  const saveBtn = document.getElementById("saveEdit");
  if (saveBtn && saveBtn.disabled) {
    return; // الطلب قيد المعالجة
  }

  const username = document.getElementById("editUsername")?.value.trim();
  const password = document.getElementById("editPassword")?.value;
  const fullName = document.getElementById("editFullName")?.value.trim();
  const role = document.getElementById("editRole")?.value;

  console.log('🔵 handleEditUser: البيانات المدخلة:', { 
    currentEditId, 
    username, 
    role, 
    fullName, 
    hasPassword: !!password 
  });

  if (!username) {
    alert("⚠️ اسم المستخدم مطلوب");
    document.getElementById("editUsername")?.focus();
    return;
  }

  const updateData = {
    username,
    full_name: fullName || null,
    role
  };

  // إضافة كلمة المرور فقط إذا تم إدخالها
  if (password && password.trim()) {
    if (password.trim().length < 4) {
      alert("⚠️ كلمة المرور يجب أن تكون 4 أحرف على الأقل");
      document.getElementById("editPassword")?.focus();
      return;
    }
    updateData.password = password.trim();
  }

  // تعطيل الزر أثناء المعالجة
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "جاري الحفظ...";
  }

  try {
    console.log('📤 handleEditUser: إرسال طلب تحديث:', updateData);
    const res = await API("PUT", `/auth/users/${currentEditId}`, updateData);

    console.log('📥 handleEditUser: استجابة السيرفر:', res);

    if (res && res.status === "success") {
      // إغلاق المودال
      document.getElementById("editModal").classList.remove("active");
      currentEditId = null;
      clearEditFields();
      
      // إعادة تحميل البيانات
      await loadEmployeesPage();
      
      // رسالة نجاح
      alert("✅ تم تحديث بيانات الموظف بنجاح!");
    } else {
      const errorMsg = res?.message || res?.error || "حدث خطأ أثناء تحديث بيانات الموظف";
      console.error("❌ handleEditUser: خطأ من السيرفر:", errorMsg);
      alert("❌ خطأ: " + errorMsg);
    }
  } catch (error) {
    console.error("❌ handleEditUser: خطأ في تحديث الموظف:", error);
    console.error("❌ handleEditUser: تفاصيل الخطأ:", error.message);
    alert("❌ حدث خطأ في الاتصال بالسيرفر: " + (error.message || "خطأ غير معروف"));
  } finally {
    // إعادة تفعيل الزر
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "حفظ التغييرات";
    }
  }
}

// ---------------------------------------------
// 10) تغيير كلمة المرور
// ---------------------------------------------
async function changePassword(id) {
  const newPassword = prompt("أدخل كلمة المرور الجديدة:");
  
  if (!newPassword || newPassword.trim().length < 4) {
    alert("كلمة المرور يجب أن تكون 4 أحرف على الأقل");
    return;
  }

  if (confirm("هل أنت متأكد من تغيير كلمة المرور؟")) {
    try {
      const res = await API("PUT", `/auth/users/${id}`, {
        password: newPassword
      });

      if (res.status === "success") {
        alert("تم تغيير كلمة المرور بنجاح");
        loadEmployeesPage();
      } else {
        alert(res.message || "حدث خطأ أثناء تغيير كلمة المرور");
      }
    } catch (error) {
      console.error("خطأ في تغيير كلمة المرور:", error);
      alert("حدث خطأ في الاتصال بالسيرفر");
    }
  }
}

// ---------------------------------------------
// 11) تفعيل/تعطيل حساب
// ---------------------------------------------
async function toggleUser(id) {
  if (confirm("هل أنت متأكد من تغيير حالة هذا الحساب؟")) {
    try {
      const res = await API("PATCH", `/auth/users/${id}/toggle`);

      if (res.status === "success") {
        loadEmployeesPage();
      } else {
        alert(res.message || "حدث خطأ أثناء تغيير حالة الحساب");
      }
    } catch (error) {
      console.error("خطأ في تغيير حالة الحساب:", error);
      alert("حدث خطأ في الاتصال بالسيرفر");
    }
  }
}

// ---------------------------------------------
// 12) حذف موظف
// ---------------------------------------------
async function deleteUser(id) {
  if (confirm("هل أنت متأكد من حذف هذا الموظف؟ هذا الإجراء لا يمكن التراجع عنه.")) {
    try {
      const res = await API("DELETE", `/auth/users/${id}`);

      if (res.status === "success") {
        loadEmployeesPage();
      } else {
        alert(res.message || "حدث خطأ أثناء حذف الموظف");
      }
    } catch (error) {
      console.error("خطأ في حذف الموظف:", error);
      alert("حدث خطأ في الاتصال بالسيرفر");
    }
  }
}

// ---------------------------------------------
// 13) مسح الحقول
// ---------------------------------------------
function clearAddFields() {
  document.getElementById("userUsername").value = "";
  document.getElementById("userPassword").value = "";
  document.getElementById("userFullName").value = "";
  document.getElementById("userRole").value = "employee";
}

function clearEditFields() {
  document.getElementById("editUsername").value = "";
  document.getElementById("editPassword").value = "";
  document.getElementById("editFullName").value = "";
  document.getElementById("editRole").value = "employee";
}

// ---------------------------------------------
// 14) استيراد موظفين من الإكسل
// ---------------------------------------------
async function handleExcelUpload(file) {
  const token = localStorage.getItem("token");
  if (!token) return;

  const formData = new FormData();
  formData.append('file', file);

  const importExcelBtn = document.getElementById("importExcelBtn");
  if (importExcelBtn) {
    importExcelBtn.disabled = true;
    importExcelBtn.textContent = "جاري الرفع...";
  }

  try {
    const res = await fetch("/api/hr/import-excel", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    let data;
    try {
      data = await res.json();
    } catch(e) {
      data = { status: "error", message: "خطأ غير متوقع من السيرفر" };
    }

    if (res.ok && data.success) {
      alert("✅ " + data.message);
      await loadEmployeesPage();
    } else {
      alert("❌ خطأ: " + (data.message || 'حدث خطأ أثناء الرفع'));
    }
  } catch (err) {
    console.error("Upload error:", err);
    alert("❌ حدث خطأ في الاتصال بالسيرفر");
  } finally {
    if (importExcelBtn) {
      importExcelBtn.disabled = false;
      importExcelBtn.textContent = "📄 رفع إكسل";
    }
  }
}

