/**
 * Setup Enterprise RBAC (Role-Based Access Control)
 * Creates roles, permissions, role_permissions tables and seeds comprehensive permissions
 */
const { authPool } = require('../database/authConnection');

async function setupRBAC() {
  const conn = await authPool.getConnection();
  try {
    console.log('🛡️ بدء إنشاء وتجهيز بنية نظام الصلاحيات والأدوار (Enterprise RBAC)...');
    await conn.beginTransaction();

    // 1. جدول الأدوار (roles)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_code VARCHAR(50) NOT NULL UNIQUE,
        role_name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        is_system TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. جدول الصلاحيات الدقيقة (permissions)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        permission_code VARCHAR(100) NOT NULL UNIQUE,
        module VARCHAR(50) NOT NULL,
        module_name VARCHAR(100) NOT NULL,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. جدول الربط بين الأدوار والصلاحيات (role_permissions)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_role_perm (role_id, permission_id),
        INDEX idx_role (role_id),
        INDEX idx_perm (permission_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. ترقية جدول المستخدمين (users) ليدعم VARCHAR واسع للرتب وحقل role_id
    const [userCols] = await conn.query('DESCRIBE users');
    const userFields = userCols.map(c => c.Field);
    
    // تحويل role إلى VARCHAR(64) لضمان عدم حدوث خطأ Data truncated لأي رتبة جديدة
    await conn.query(`
      ALTER TABLE users MODIFY COLUMN role VARCHAR(64) NOT NULL DEFAULT 'employee'
    `);

    if (!userFields.includes('role_id')) {
      await conn.query(`
        ALTER TABLE users ADD COLUMN role_id INT NULL AFTER role
      `);
    }

    // 5. زرع الصلاحيات الدقيقة للنظام (Granular Permissions)
    const systemPermissions = [
      // لوحة التحكم
      { code: 'dashboard.view', module: 'dashboard', module_name: 'لوحة التحكم', name: 'عرض الداشبورد والإحصائيات', desc: 'الاطلاع على المؤشرات المالية والتشغيلية' },
      
      // المخزن والعهد
      { code: 'inventory.read', module: 'inventory', module_name: 'المخزن والعهد', name: 'عرض أرصدة المخزن', desc: 'مشاهدة كميات المواد الخام وتنبيهات النواقص' },
      { code: 'inventory.write', module: 'inventory', module_name: 'المخزن والعهد', name: 'إضافة وتعديل المواد', desc: 'إدخال أصناف جديدة وتعديل أسعار التكلفة' },
      { code: 'inventory.transact', module: 'inventory', module_name: 'المخزن والعهد', name: 'سحب وتوريد المخزن', desc: 'تسجيل حركات الاستلام والصرف اليدوي' },
      
      // المطبخ والوصفات
      { code: 'recipes.read', module: 'kitchen', module_name: 'المطبخ والإنتاج', name: 'عرض كروت الوصفات', desc: 'الاطلاع على مقادير الطبخات والصوصات' },
      { code: 'recipes.manage', module: 'kitchen', module_name: 'المطبخ والإنتاج', name: 'إنشاء وتعديل الوصفات', desc: 'تحديد المكونات المعيارية ونسب الهدر' },
      { code: 'kitchen.prep', module: 'kitchen', module_name: 'المطبخ والإنتاج', name: 'تشغيل دفعات التحضير والباركود', desc: 'حساب مقادير الدفعة وطباعة ملصقات الباركود' },
      { code: 'kitchen.audit', module: 'kitchen', module_name: 'المطبخ والإنتاج', name: 'جرد ومطابقة نهاية الشفت', desc: 'مطابقة رصيد السكشن مع المبيعات وتأكيد الفروقات' },
      
      // نقطة البيع والصالة (POS)
      { code: 'pos.view', module: 'pos', module_name: 'الصالات ونقطة البيع', name: 'عرض خريطة الصالات والطاولات', desc: 'مشاهدة حالة الطاولات والطلبات النشطة' },
      { code: 'pos.order', module: 'pos', module_name: 'الصالات ونقطة البيع', name: 'تسجيل وإرسال طلبات الويتر', desc: 'إدخال طلبات الزبائن وإرسال الكبونات للمطبخ' },
      { code: 'pos.pay', module: 'pos', module_name: 'الصالات ونقطة البيع', name: 'تحصيل الحساب وإخلاء الطاولة', desc: 'استلام المدفوعات وتوليد القيود المحاسبية' },
      { code: 'pos.cancel', module: 'pos', module_name: 'الصالات ونقطة البيع', name: 'إلغاء وتعديل الأصناف المباعة', desc: 'صلاحية حساسة لحذف أصناف بعد طلبها' },
      
      // المالية والمحاسبة
      { code: 'accounting.read', module: 'accounting', module_name: 'المالية والمحاسبة', name: 'عرض شجرة الحسابات والقيود', desc: 'الاطلاع على الحسابات اليومية ودفتر الأستاذ' },
      { code: 'accounting.write', module: 'accounting', module_name: 'المالية والمحاسبة', name: 'إنشاء وترحيل القيود اليومية', desc: 'إدخال قيود محاسبية يدوية وتأكيدها' },
      { code: 'accounting.reports', module: 'accounting', module_name: 'المالية والمحاسبة', name: 'استخراج القوائم والتقارير المالية', desc: 'كشف ميزان المراجعة وقائمة الأرباح والخسائر' },
      
      // الفروع والشركات
      { code: 'branches.manage', module: 'branches', module_name: 'الفروع والشركات', name: 'إدارة الفروع والمناقلات', desc: 'إرسال واستلام التحويلات بين الفروع' },
      
      // الموارد البشرية
      { code: 'hr.attendance', module: 'hr', module_name: 'الموارد البشرية', name: 'تسجيل ومتابعة البصمة', desc: 'حضور وانصراف الموظفين' },
      { code: 'hr.leaves', module: 'hr', module_name: 'الموارد البشرية', name: 'إدارة الإجازات', desc: 'تقديم واعتماد طلبات الإجازات' },
      { code: 'hr.payroll', module: 'hr', module_name: 'الموارد البشرية', name: 'إدارة الرواتب والخصومات', desc: 'إعداد مسير الرواتب الشهرية' },
      { code: 'users.manage', module: 'hr', module_name: 'الموارد البشرية', name: 'إدارة حسابات الموظفين', desc: 'إضافة وتعديل بيانات مستخدمي النظام' },
      
      // إدارة الصلاحيات (RBAC)
      { code: 'rbac.manage', module: 'rbac', module_name: 'الأمان والصلاحيات', name: 'إدارة مصفوفة الأدوار والصلاحيات', desc: 'إنشاء الأدوار وتخصيص صلاحيات المستخدمين' }
    ];

    for (const p of systemPermissions) {
      await conn.query(`
        INSERT INTO permissions (permission_code, module, module_name, name, description)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          module = VALUES(module),
          module_name = VALUES(module_name),
          name = VALUES(name),
          description = VALUES(description)
      `, [p.code, p.module, p.module_name, p.name, p.desc]);
    }
    console.log(`✅ تم تثبيت ${systemPermissions.length} صلاحية معيارية دقيقة.`);

    // 6. زرع الأدوار القياسية لنظام إدارة المطاعم والمطابخ (Standard Restaurant Roles)
    const systemRoles = [
      {
        code: 'admin',
        name: '👑 المدير العام (Admin)',
        desc: 'صلاحيات كاملة وغير مقيدة على كافة أقسام النظام والبيانات',
        is_system: 1,
        permissions: systemPermissions.map(p => p.code) // كل الصلاحيات
      },
      {
        code: 'kitchen_manager',
        name: '👨‍🍳 مدير المطبخ / الشيف التنفيذي (Executive Chef)',
        desc: 'إدارة المطبخ، الوصفات، التحضير، الباركود، مطابقة السكاشن، والعهد',
        is_system: 1,
        permissions: [
          'dashboard.view', 'inventory.read', 'recipes.read', 'recipes.manage', 
          'kitchen.prep', 'kitchen.audit', 'pos.view', 'hr.attendance', 'hr.leaves'
        ]
      },
      {
        code: 'station_chef',
        name: '🍳 شيف سكشن / مسؤول خط الطهي (Station Cook)',
        desc: 'تحضير المواد، مسح الباركود لاستلام العهدة، وجرد نهاية الشفت',
        is_system: 1,
        permissions: [
          'inventory.read', 'recipes.read', 'kitchen.prep', 'kitchen.audit', 
          'hr.attendance', 'hr.leaves'
        ]
      },
      {
        code: 'waiter',
        name: '🍽️ ويتر / كابتن صالة (Waiter / Captain)',
        desc: 'خدمة الصالة، أخذ الطلبات للزبائن، إرسال الكبونات للمطبخ',
        is_system: 1,
        permissions: [
          'pos.view', 'pos.order', 'hr.attendance', 'hr.leaves'
        ]
      },
      {
        code: 'cashier',
        name: '💵 كاشير المطعم (Cashier)',
        desc: 'استلام المدفوعات النقدية والبطاقات، إخلاء الطاولات، وإغلاق الصندوق',
        is_system: 1,
        permissions: [
          'pos.view', 'pos.order', 'pos.pay', 'hr.attendance', 'hr.leaves'
        ]
      },
      {
        code: 'accountant',
        name: '💰 مدير الحسابات والمالية (Accountant)',
        desc: 'إدارة شجرة الحسابات، قيود اليومية، القوائم المالية، ومراقبة التكاليف',
        is_system: 1,
        permissions: [
          'dashboard.view', 'accounting.read', 'accounting.write', 'accounting.reports', 
          'inventory.read', 'branches.manage', 'hr.attendance', 'hr.leaves'
        ]
      },
      {
        code: 'inventory_keeper',
        name: '📦 أمين المخزن (Storekeeper)',
        desc: 'استلام التوريدات، مراقبة المخزون، التحويلات، والصرف للسكاشن',
        is_system: 1,
        permissions: [
          'inventory.read', 'inventory.write', 'inventory.transact', 'branches.manage', 
          'hr.attendance', 'hr.leaves'
        ]
      },
      {
        code: 'hr',
        name: '👥 مسؤول الموارد البشرية (HR Manager)',
        desc: 'إدارة الموظفين، البصمات، جداول الدوام، مسير الرواتب، والإجازات',
        is_system: 1,
        permissions: [
          'hr.attendance', 'hr.leaves', 'hr.payroll', 'users.manage', 'dashboard.view'
        ]
      },
      {
        code: 'employee',
        name: '👤 موظف عام (General Staff)',
        desc: 'الاطلاع على البصمة الشخصية وتقديم طلبات الإجازات',
        is_system: 1,
        permissions: [
          'hr.attendance', 'hr.leaves'
        ]
      }
    ];

    // جلب خريطة الصلاحيات
    const [allPerms] = await conn.query('SELECT id, permission_code FROM permissions');
    const permMap = {};
    allPerms.forEach(p => { permMap[p.permission_code] = p.id; });

    for (const r of systemRoles) {
      const [res] = await conn.query(`
        INSERT INTO roles (role_code, role_name, description, is_system)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          role_name = VALUES(role_name),
          description = VALUES(description),
          is_system = VALUES(is_system)
      `, [r.code, r.name, r.desc, r.is_system]);

      // جلب معرف الدور
      const [roleRow] = await conn.query('SELECT id FROM roles WHERE role_code = ?', [r.code]);
      const roleId = roleRow[0].id;

      // ربط الصلاحيات بالدور
      await conn.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
      for (const pCode of r.permissions) {
        const permId = permMap[pCode];
        if (permId) {
          await conn.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (?, ?)
          `, [roleId, permId]);
        }
      }
    }
    console.log(`✅ تم تثبيت ${systemRoles.length} أدوار قياسية وربط صلاحياتها بنجاح.`);

    // 7. ربط المستخدمين الحاليين بأدوارهم الصحيحة
    const [rolesList] = await conn.query('SELECT id, role_code FROM roles');
    const roleIdMap = {};
    rolesList.forEach(r => { roleIdMap[r.role_code] = r.id; });

    // تحديث admin
    if (roleIdMap['admin']) {
      await conn.query('UPDATE users SET role_id = ? WHERE role = "admin" OR username = "admin"', [roleIdMap['admin']]);
    }
    // تحديث chef
    if (roleIdMap['kitchen_manager']) {
      await conn.query('UPDATE users SET role_id = ? WHERE role = "kitchen_manager" OR username = "chef"', [roleIdMap['kitchen_manager']]);
    }
    // تحديث waiter
    if (roleIdMap['waiter']) {
      await conn.query('UPDATE users SET role_id = ?, role = "waiter" WHERE username = "waiter" OR role = "waiter"', [roleIdMap['waiter']]);
    }

    await conn.commit();
    console.log('🎉 اكتمل بناء نظام الصلاحيات والأدوار (Enterprise RBAC) بنجاح 100%!');
  } catch (err) {
    await conn.rollback();
    console.error('❌ خطأ في إعداد RBAC:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

setupRBAC();
