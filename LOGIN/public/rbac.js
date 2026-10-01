/**
 * ============================================================================
 * Enterprise RBAC Management Frontend Logic
 * Dynamic Permissions Matrix & Custom Roles Management
 * ============================================================================
 */

const token = localStorage.getItem('token');
if (!token) {
  alert('يجب تسجيل الدخول أولاً');
  window.location.href = '/index.html';
}

let allRoles = [];
let allPermissionsGrouped = [];
let selectedRoleId = null;
let currentRolePermissions = new Set();

// ===============================
// 1) تهيئة الشاشة وجلب البيانات
// ===============================
async function initRBAC() {
  try {
    // 1. جلب شجرة الصلاحيات
    const permsRes = await fetch('/api/rbac/permissions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const permsData = await permsRes.json();
    if (permsData.status === 'success') {
      allPermissionsGrouped = permsData.data.grouped;
      document.getElementById('permsCount').textContent = permsData.data.raw.length;
    }

    // 2. جلب قائمة الأدوار
    await loadRoles();

  } catch (err) {
    console.error('خطأ في تهيئة RBAC:', err);
  }
}

async function loadRoles() {
  try {
    const res = await fetch('/api/rbac/roles', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.status !== 'success') throw new Error(data.message);

    allRoles = data.data;
    document.getElementById('rolesCount').textContent = allRoles.length;

    // حساب إجمالي المستخدمين
    const totalUsers = allRoles.reduce((acc, r) => acc + (parseInt(r.users_count) || 0), 0);
    document.getElementById('activeUsersCount').textContent = `${totalUsers} مستخدم`;

    renderRoleSelector();
    renderRolesTable();

    // اختيار أول دور تلقائياً إذا لم يكن هناك دور محدد
    if (!selectedRoleId && allRoles.length > 0) {
      // اختيار مدير المطبخ أو أول دور غير الأدمن لإبراز التحكم بالصلاحيات
      const defaultRole = allRoles.find(r => r.role_code === 'kitchen_manager') || allRoles[0];
      selectedRoleId = defaultRole.id;
      document.getElementById('roleSelector').value = selectedRoleId;
    }

    onRoleChange();
  } catch (err) {
    console.error('خطأ في جلب الأدوار:', err);
  }
}

function renderRoleSelector() {
  const sel = document.getElementById('roleSelector');
  if (!sel) return;

  sel.innerHTML = allRoles.map(r => `
    <option value="${r.id}">
      ${r.role_name} (${r.permissions?.length || 0} صلاحية)
    </option>
  `).join('');
}

// ===============================
// 2) تغيير الدور المختار وعرض مصفوفة الصلاحيات
// ===============================
window.onRoleChange = function() {
  const sel = document.getElementById('roleSelector');
  if (!sel) return;
  selectedRoleId = parseInt(sel.value);

  const role = allRoles.find(r => r.id === selectedRoleId);
  if (!role) return;

  currentRolePermissions = new Set(role.permissions || []);

  // تحديث بنر معلومات الدور
  const banner = document.getElementById('roleInfoBanner');
  banner.innerHTML = `
    <div>
      <div style="font-size: 1.05rem; font-weight: bold; color: #f8fafc; display:flex; align-items:center; gap: 8px;">
        <span>${role.role_name}</span>
        <span class="${role.is_system ? 'badge-system' : 'badge-custom'}">${role.is_system ? 'دور نظامي أساسي' : 'دور مخصص'}</span>
        <code style="color:#38bdf8; font-size:0.8rem; background:#1e293b; padding:2px 6px; border-radius:4px;">${role.role_code}</code>
      </div>
      <div style="color: #94a3b8; font-size: 0.85rem; margin-top: 4px;">${role.description || 'لا يوجد وصف محدد'}</div>
    </div>
    <div style="text-align:left;">
      <span style="font-size:1.1rem; font-weight:800; color:#10b981;" id="activePermsBadge">${currentRolePermissions.size}</span>
      <span style="font-size:0.85rem; color:#94a3b8;">صلاحية مفعّلة من أصل ${document.getElementById('permsCount').textContent}</span>
    </div>
  `;

  renderMatrix();
};

function renderMatrix() {
  const container = document.getElementById('matrixContainer');
  if (!container) return;

  const role = allRoles.find(r => r.id === selectedRoleId);
  const isAdminRole = role && role.role_code === 'admin';

  container.innerHTML = allPermissionsGrouped.map(mod => {
    return `
      <div class="module-box">
        <div class="module-header">
          <div class="module-title">
            <span>📦</span> ${mod.moduleName}
          </div>
          <div>
            ${!isAdminRole ? `
              <button type="button" class="btn-secondary" style="padding: 4px 10px; font-size: 0.78rem;" onclick="toggleModuleAll('${mod.moduleCode}', true)">تحديد الكل</button>
              <button type="button" class="btn-secondary" style="padding: 4px 10px; font-size: 0.78rem;" onclick="toggleModuleAll('${mod.moduleCode}', false)">إلغاء الكل</button>
            ` : '<span style="color:#10b981; font-size:0.8rem; font-weight:bold;">👑 مفعّل تلقائياً بالكامل للمدير</span>'}
          </div>
        </div>

        <div class="module-perms-grid">
          ${mod.permissions.map(p => {
            const isChecked = isAdminRole || currentRolePermissions.has(p.code);
            return `
              <label class="perm-item ${isChecked ? 'active' : ''}" id="perm-label-${p.code}">
                <input type="checkbox" class="perm-checkbox" value="${p.code}" 
                       data-module="${mod.moduleCode}"
                       ${isChecked ? 'checked' : ''} 
                       ${isAdminRole ? 'disabled' : ''}
                       onchange="onPermToggle('${p.code}', this.checked)" />
                <div class="perm-info">
                  <div class="perm-name">${p.name}</div>
                  <div class="perm-code">${p.code}</div>
                  <div class="perm-desc">${p.description || ''}</div>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

window.onPermToggle = function(permCode, checked) {
  if (checked) {
    currentRolePermissions.add(permCode);
  } else {
    currentRolePermissions.delete(permCode);
  }

  const label = document.getElementById(`perm-label-${permCode}`);
  if (label) {
    if (checked) label.classList.add('active');
    else label.classList.remove('active');
  }

  const badge = document.getElementById('activePermsBadge');
  if (badge) badge.textContent = currentRolePermissions.size;
};

window.toggleModuleAll = function(moduleCode, selectAll) {
  const checkboxes = document.querySelectorAll(`input[data-module="${moduleCode}"]`);
  checkboxes.forEach(cb => {
    cb.checked = selectAll;
    onPermToggle(cb.value, selectAll);
  });
};

// ===============================
// 3) حفظ مصفوفة صلاحيات الدور
// ===============================
window.saveSelectedRolePermissions = async function() {
  if (!selectedRoleId) return;
  const role = allRoles.find(r => r.id === selectedRoleId);

  if (role.role_code === 'admin') {
    alert('الدور العام (Admin) يملك كافة الصلاحيات بصورة أصيلة غير قابلة للإلغاء لضمان استقرار النظام.');
    return;
  }

  const permsArray = Array.from(currentRolePermissions);

  try {
    const res = await fetch(`/api/rbac/roles/${selectedRoleId}/permissions`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ permissions: permsArray })
    });

    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert(`✅ ${result.message}`);
    await loadRoles();
  } catch (err) {
    alert(`❌ حدث خطأ أثناء الحفظ: ${err.message}`);
  }
};

// ===============================
// 4) جدول الأدوار
// ===============================
function renderRolesTable() {
  const tbody = document.getElementById('rolesTableBody');
  if (!tbody) return;

  tbody.innerHTML = allRoles.map(r => `
    <tr>
      <td><code style="color:#38bdf8; font-weight:bold;">${r.role_code}</code></td>
      <td><strong>${r.role_name}</strong></td>
      <td style="color:#94a3b8; font-size:0.85rem;">${r.description || '—'}</td>
      <td>
        <span class="${r.is_system ? 'badge-system' : 'badge-custom'}">
          ${r.is_system ? '🔒 دور نظامي' : '✨ مخصص'}
        </span>
      </td>
      <td>
        <span style="font-weight:bold; color:#10b981;">${r.permissions?.length || 0}</span> صلاحية
      </td>
      <td>
        <button type="button" class="btn-secondary" style="padding: 4px 10px; font-size: 0.8rem;" onclick="selectRoleById(${r.id})">
          ⚙️ ضبط الصلاحيات
        </button>
      </td>
    </tr>
  `).join('');
}

window.selectRoleById = function(roleId) {
  document.getElementById('roleSelector').value = roleId;
  onRoleChange();
  window.scrollTo({ top: 300, behavior: 'smooth' });
};

// ===============================
// 5) نافذة إنشاء دور جديد
// ===============================
window.openNewRoleModal = function() {
  const listEl = document.getElementById('newRolePermsList');
  if (listEl) {
    listEl.innerHTML = allPermissionsGrouped.flatMap(m => m.permissions).map(p => `
      <label style="display:flex; align-items:center; gap:8px; font-size:0.82rem; color:#f8fafc; cursor:pointer;">
        <input type="checkbox" class="new-role-perm-cb" value="${p.code}" />
        <span>${p.name} <code style="color:#38bdf8; font-size:0.75rem;">(${p.code})</code></span>
      </label>
    `).join('');
  }
  document.getElementById('newRoleModal').classList.add('active');
};

window.closeNewRoleModal = function() {
  document.getElementById('newRoleModal').classList.remove('active');
  document.getElementById('newRoleCode').value = '';
  document.getElementById('newRoleName').value = '';
  document.getElementById('newRoleDesc').value = '';
};

window.submitNewRole = async function() {
  const code = document.getElementById('newRoleCode').value.trim();
  const name = document.getElementById('newRoleName').value.trim();
  const desc = document.getElementById('newRoleDesc').value.trim();

  if (!code || !name) {
    alert('يرجى إدخال كود واسم الدور');
    return;
  }

  const selectedPerms = Array.from(document.querySelectorAll('.new-role-perm-cb:checked')).map(cb => cb.value);

  try {
    const res = await fetch('/api/rbac/roles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        role_code: code,
        role_name: name,
        description: desc,
        permissions: selectedPerms
      })
    });

    const result = await res.json();
    if (result.status !== 'success') throw new Error(result.message);

    alert(`✅ ${result.message}`);
    closeNewRoleModal();
    await loadRoles();
  } catch (err) {
    alert(`❌ حدث خطأ: ${err.message}`);
  }
};

// تشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initRBAC);
