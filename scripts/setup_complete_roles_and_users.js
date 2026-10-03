/**
 * ============================================================================
 * Enterprise Roles & Users Seeder
 * يضمن وجود كافة الأدوار الوظيفية (محاسب، كاشير، مدير صالة، شيف سكشن، أمين مخزن، مدير فرع)
 * وتعيين الصلاحيات الدقيقة وإنشاء حسابات تجريبية موحدة
 * ============================================================================
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function setupRolesAndUsers() {
  const pool = mysql.createPool({
    host: process.env.AUTH_DB_HOST || 'localhost',
    port: parseInt(process.env.AUTH_DB_PORT, 10) || 3307,
    user: process.env.AUTH_DB_USER || 'root',
    password: process.env.AUTH_DB_PASSWORD || '1234',
    database: process.env.AUTH_DB_NAME || 'auth_db',
    multipleStatements: true
  });

  console.log('🔄 جاري تهيئة وتحديث كافة الأدوار والمستخدمين في auth_db...');

  // 1) قائمة الأدوار الشاملة
  const allRoles = [
    { code: 'admin', name: '👑 المدير العام (Admin)', desc: 'صلاحيات كاملة وغير مقيدة على كافة أقسام النظام والبيانات' },
    { code: 'manager', name: '👔 مدير الفرع (Branch Manager)', desc: 'إدارة تشغيلية عليا للفرع، متابعة المبيعات والعمليات والموظفين' },
    { code: 'accountant', name: '💰 مدير الحسابات والمالية (Accountant)', desc: 'إدارة شجرة الحسابات، قيود اليومية، القوائم المالية، ومراقبة التكاليف' },
    { code: 'cashier', name: '💵 كاشير المطعم (Cashier)', desc: 'استلام المدفوعات النقدية والبطاقات، إخلاء الطاولات، وإغلاق اليومية' },
    { code: 'hall_manager', name: '🏢 مدير الصالة ومسؤول الخدمة (Hall Manager)', desc: 'إدارة صالة المطعم، متابعة الويترية، إشغال الطاولات، وخدمة الزبائن' },
    { code: 'kitchen_manager', name: '👨‍🍳 مدير المطبخ / الشيف التنفيذي (Executive Chef)', desc: 'إدارة المطبخ، الوصفات، التحضير، الباركود، مطابقة السكاشن، والعهد' },
    { code: 'station_chef', name: '🍳 شيف سكشن / مسؤول خط الطهي (Station Cook)', desc: 'تحضير المواد، مسح الباركود لاستلام العهدة، وجرد نهاية الشفت' },
    { code: 'waiter', name: '🍽️ ويتر / كابتن صالة (Waiter / Captain)', desc: 'خدمة الصالة، أخذ الطلبات للزبائن، إرسال الكبونات للمطبخ' },
    { code: 'inventory_keeper', name: '📦 أمين المخزن (Storekeeper)', desc: 'استلام التوريدات، مراقبة المخزون، التحويلات، والصرف للسكاشن' },
    { code: 'hr', name: '👥 مسؤول الموارد البشرية (HR Manager)', desc: 'إدارة الموظفين، البصمات، جداول الدوام، مسير الرواتب، والإجازات' },
    { code: 'employee', name: '👤 موظف عام (General Staff)', desc: 'الاطلاع على البصمة الشخصية وتقديم طلبات الإجازات' }
  ];

  for (const r of allRoles) {
    await pool.query(`
      INSERT INTO roles (role_code, role_name, description, is_system)
      VALUES (?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE 
        role_name = VALUES(role_name),
        description = VALUES(description),
        is_system = 1
    `, [r.code, r.name, r.desc]);
  }

  // جلب معرفات الأدوار
  const [roleRows] = await pool.query('SELECT id, role_code FROM roles');
  const roleIdMap = {};
  roleRows.forEach(r => { roleIdMap[r.role_code] = r.id; });

  // جلب كافة الصلاحيات
  const [permRows] = await pool.query('SELECT id, permission_code FROM permissions');
  const permIdMap = {};
  permRows.forEach(p => { permIdMap[p.permission_code] = p.id; });

  // 2) توزيع الصلاحيات المعيارية لكل دور
  const rolePermissionsMapping = {
    manager: [
      'dashboard.view', 'inventory.read', 'inventory.transact', 'recipes.read', 'recipes.manage',
      'kitchen.prep', 'kitchen.audit', 'pos.view', 'pos.order', 'pos.pay', 'pos.cancel',
      'accounting.read', 'branches.manage', 'hr.attendance', 'hr.leaves', 'users.manage'
    ],
    accountant: [
      'dashboard.view', 'accounting.read', 'accounting.write', 'accounting.reports',
      'inventory.read', 'branches.manage', 'hr.payroll', 'hr.attendance', 'hr.leaves'
    ],
    cashier: [
      'pos.view', 'pos.order', 'pos.pay', 'pos.cancel', 'hr.attendance', 'hr.leaves'
    ],
    hall_manager: [
      'dashboard.view', 'pos.view', 'pos.order', 'pos.cancel', 'hr.attendance', 'hr.leaves', 'users.manage'
    ],
    kitchen_manager: [
      'dashboard.view', 'kitchen.prep', 'kitchen.audit', 'recipes.read', 'recipes.manage',
      'inventory.read', 'inventory.transact', 'pos.view', 'hr.attendance', 'hr.leaves'
    ],
    station_chef: [
      'kitchen.prep', 'kitchen.audit', 'recipes.read', 'inventory.read', 'hr.attendance', 'hr.leaves'
    ],
    waiter: [
      'pos.view', 'pos.order', 'hr.attendance', 'hr.leaves'
    ],
    inventory_keeper: [
      'inventory.read', 'inventory.write', 'inventory.transact', 'branches.manage', 'hr.attendance', 'hr.leaves'
    ],
    hr: [
      'dashboard.view', 'hr.attendance', 'hr.leaves', 'hr.payroll', 'users.manage'
    ],
    employee: [
      'hr.attendance', 'hr.leaves'
    ]
  };

  for (const [rCode, perms] of Object.entries(rolePermissionsMapping)) {
    const rId = roleIdMap[rCode];
    if (!rId) continue;

    for (const pCode of perms) {
      const pId = permIdMap[pCode];
      if (pId) {
        await pool.query(`
          INSERT IGNORE INTO role_permissions (role_id, permission_id)
          VALUES (?, ?)
        `, [rId, pId]);
      }
    }
  }

  // 3) إنشاء أو تحديث المستخدمين التجريبيين لكل دور
  const sampleUsers = [
    { username: 'admin', pass: 'admin123', name: 'المدير العام', role: 'admin' },
    { username: 'manager', pass: 'manager123', name: 'أحمد السامرائي - مدير الفرع', role: 'manager' },
    { username: 'accountant', pass: 'account123', name: 'عمر القيسي - المحاسب المالي', role: 'accountant' },
    { username: 'cashier', pass: 'cashier123', name: 'يوسف الكاشير', role: 'cashier' },
    { username: 'hall_manager', pass: 'hall123', name: 'سامر الشمري - مسؤول الصالة', role: 'hall_manager' },
    { username: 'chef', pass: 'chef123', name: 'الشيف حيدر - مدير المطبخ', role: 'kitchen_manager' },
    { username: 'cook', pass: 'cook123', name: 'شيف مصطفى - مسؤول سكشن المشويات', role: 'station_chef' },
    { username: 'waiter', pass: 'waiter123', name: 'علي حسن - كابتن ويتر', role: 'waiter' },
    { username: 'storekeeper', pass: 'store123', name: 'كرار الأمين - أمين المخزن', role: 'inventory_keeper' },
    { username: 'hr_manager', pass: 'hr123', name: 'سارة - مديرة الموارد البشرية', role: 'hr' }
  ];

  for (const u of sampleUsers) {
    const rId = roleIdMap[u.role] || null;
    const hashed = await bcrypt.hash(u.pass, 10);

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [u.username]);
    if (existing.length > 0) {
      await pool.query(`
        UPDATE users 
        SET password = ?, full_name = ?, role = ?, role_id = ?, is_active = 1
        WHERE username = ?
      `, [hashed, u.name, u.role, rId, u.username]);
      console.log(`✅ تم تحديث حساب المستخدم: [${u.username}] بالرتبة: [${u.role}]`);
    } else {
      await pool.query(`
        INSERT INTO users (username, password, full_name, role, role_id, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `, [u.username, hashed, u.name, u.role, rId]);
      console.log(`✨ تم إنشاء حساب مستخدم جديد: [${u.username}] بالرتبة: [${u.role}]`);
    }
  }

  console.log('🎉 اكتمل إعداد وتوزيع كافة الأدوار والصلاحيات والمستخدمين بنجاح!');
  await pool.end();
}

setupRolesAndUsers().catch(err => {
  console.error('❌ خطأ في الإعداد:', err);
  process.exit(1);
});
