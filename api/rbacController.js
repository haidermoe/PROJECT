/**
 * ============================================================================
 * RBAC Controller - نظام إدارة الأدوار والصلاحيات المتقدم (Enterprise RBAC)
 * مطابقة معايير Odoo ir.model.access & Security Groups
 * ============================================================================
 */

const { authPool } = require('../database/authConnection');

/**
 * 1) جلب كافة الأدوار مع صلاحياتها المرتبطة
 */
exports.listRoles = async (req, res) => {
  try {
    const [roles] = await authPool.query(`
      SELECT 
        r.id,
        r.role_code,
        r.role_name,
        r.description,
        r.is_system,
        COUNT(DISTINCT u.id) AS users_count
      FROM roles r
      LEFT JOIN users u ON r.role_code = u.role OR r.id = u.role_id
      GROUP BY r.id, r.role_code, r.role_name, r.description, r.is_system
      ORDER BY r.id ASC
    `);

    // جلب الصلاحيات المسندة لكل دور
    const [rolePerms] = await authPool.query(`
      SELECT 
        rp.role_id,
        p.permission_code,
        p.name AS permission_name,
        p.module
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
    `);

    const result = roles.map(role => ({
      ...role,
      permissions: rolePerms
        .filter(rp => rp.role_id === role.id)
        .map(rp => rp.permission_code),
      permissionDetails: rolePerms.filter(rp => rp.role_id === role.id)
    }));

    res.json({ status: 'success', data: result });
  } catch (err) {
    console.error('❌ خطأ في listRoles:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * 2) جلب شجرة الصلاحيات المعيارية مصنفة حسب الموديول (Module)
 */
exports.listPermissions = async (req, res) => {
  try {
    const [permissions] = await authPool.query(`
      SELECT * FROM permissions ORDER BY module ASC, id ASC
    `);

    // تجميع الصلاحيات حسب الموديول
    const modulesMap = {};
    permissions.forEach(p => {
      if (!modulesMap[p.module]) {
        modulesMap[p.module] = {
          moduleCode: p.module,
          moduleName: p.module_name,
          permissions: []
        };
      }
      modulesMap[p.module].permissions.push({
        id: p.id,
        code: p.permission_code,
        name: p.name,
        description: p.description
      });
    });

    res.json({
      status: 'success',
      data: {
        raw: permissions,
        grouped: Object.values(modulesMap)
      }
    });
  } catch (err) {
    console.error('❌ خطأ في listPermissions:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * 3) تحديث مصفوفة صلاحيات دور معين (Update Role Permissions)
 */
exports.updateRolePermissions = async (req, res) => {
  const connection = await authPool.getConnection();
  try {
    await connection.beginTransaction();
    const { roleId } = req.params;
    const { permissions = [] } = req.body; // مصفوفة أكواد الصلاحيات

    const [roleRows] = await connection.query('SELECT * FROM roles WHERE id = ?', [roleId]);
    if (!roleRows.length) {
      await connection.rollback();
      return res.status(404).json({ status: 'error', message: 'الدور غير موجود' });
    }

    const role = roleRows[0];

    // حذف الصلاحيات القديمة لهذا الدور
    await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    // إدراج الصلاحيات الجديدة
    if (permissions.length > 0) {
      const [permRows] = await connection.query(
        'SELECT id, permission_code FROM permissions WHERE permission_code IN (?)',
        [permissions]
      );

      for (const p of permRows) {
        await connection.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [roleId, p.id]
        );
      }
    }

    await connection.commit();

    res.json({
      status: 'success',
      message: `تم تحديث صلاحيات الدور [ ${role.role_name} ] بنجاح (${permissions.length} صلاحية مسندة).`
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في updateRolePermissions:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 4) إنشاء دور وظيفي جديد مخصص (Create Custom Role)
 */
exports.createRole = async (req, res) => {
  const connection = await authPool.getConnection();
  try {
    await connection.beginTransaction();
    const { role_code, role_name, description, permissions = [] } = req.body;

    if (!role_code || !role_name) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'كود الدور واسم الدور مطلوبان' });
    }

    const cleanCode = role_code.trim().toLowerCase().replace(/\s+/g, '_');

    // التحقق من عدم وجود الكود مسبقاً
    const [existing] = await connection.query('SELECT id FROM roles WHERE role_code = ?', [cleanCode]);
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ status: 'error', message: 'كود الدور مستخدم مسبقاً' });
    }

    const [insertResult] = await connection.query(`
      INSERT INTO roles (role_code, role_name, description, is_system)
      VALUES (?, ?, ?, 0)
    `, [cleanCode, role_name.trim(), description || '']);

    const newRoleId = insertResult.insertId;

    // ربط الصلاحيات
    if (permissions.length > 0) {
      const [permRows] = await connection.query(
        'SELECT id FROM permissions WHERE permission_code IN (?)',
        [permissions]
      );
      for (const p of permRows) {
        await connection.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [newRoleId, p.id]
        );
      }
    }

    await connection.commit();

    res.json({
      status: 'success',
      message: `تم إنشاء الدور [ ${role_name} ] بنجاح.`,
      data: { id: newRoleId, role_code: cleanCode, role_name }
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في createRole:', err);
    res.status(500).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

/**
 * 5) جلب صلاحيات المستخدم الحالي المسجل دخوله
 */
exports.getUserPermissions = async (req, res) => {
  try {
    const userRole = req.user?.role;
    const userId = req.user?.id;

    if (!userRole) {
      return res.status(401).json({ status: 'error', message: 'غير مصرح' });
    }

    // المدير العام يملك كافة الصلاحيات دائماً
    if (userRole === 'admin') {
      const [allPerms] = await authPool.query('SELECT permission_code FROM permissions');
      return res.json({
        status: 'success',
        data: {
          isAdmin: true,
          role: 'admin',
          permissions: allPerms.map(p => p.permission_code)
        }
      });
    }

    // للمستخدمين الآخرين: جلب الصلاحيات بناءً على role_code أو role_id
    const [perms] = await authPool.query(`
      SELECT DISTINCT p.permission_code
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN roles r ON rp.role_id = r.id
      WHERE r.role_code = ? OR r.id = (SELECT role_id FROM users WHERE id = ?)
    `, [userRole, userId]);

    res.json({
      status: 'success',
      data: {
        isAdmin: false,
        role: userRole,
        permissions: perms.map(p => p.permission_code)
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getUserPermissions:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

/**
 * دالة مساعدة عامة لفحص صلاحية مستخدم في الباك إند
 */
exports.checkUserHasPermission = async (user, permissionCode) => {
  if (!user) return false;
  if (user.role === 'admin') return true;

  try {
    const [rows] = await authPool.query(`
      SELECT 1
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      JOIN roles r ON rp.role_id = r.id
      WHERE (r.role_code = ? OR r.id = ?) AND p.permission_code = ?
      LIMIT 1
    `, [user.role, user.role_id || 0, permissionCode]);

    return rows.length > 0;
  } catch (e) {
    console.error('خطأ فحص الصلاحية:', e);
    return false;
  }
};
