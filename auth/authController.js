/**
 * ======================================================
 * Auth Controller - معالجة المصادقة وإدارة المستخدمين
 * ======================================================
 * 
 * هذا الملف يستخدم اتصال معزول تماماً لقاعدة بيانات المصادقة
 * لا يمكن الوصول إلى قاعدة بيانات المصادقة إلا من خلال database/authConnection.js
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// استيراد اتصال قاعدة بيانات المصادقة (معزول)
const { authPool } = require('../database/authConnection');
const { jwtConfig } = require('../config/database');
const { isValidRole, isValidUsername, isValidPassword } = require('../config/security');

// توليد توكن
function signToken(payload) {
  return jwt.sign(payload, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
    algorithm: jwtConfig.algorithm
  });
}

/**
 * تسجيل دخول
 * يستخدم اتصال معزول لقاعدة بيانات المصادقة
 */
async function login(req, res) {
  try {
    console.log('🔵 login: بدء عملية تسجيل الدخول');
    const { username, password } = req.body;

    console.log('🔵 login: البيانات المستلمة:', { 
      username: username?.substring(0, 20), 
      passwordLength: password?.length 
    });

    if (!username || !password) {
      console.log('❌ login: الحقول مطلوبة');
      return res.status(400).json({ status: 'error', message: 'الحقول مطلوبة' });
    }

    // استخدام الاتصال المعزول
    console.log('🔵 login: جاري البحث عن المستخدم في قاعدة البيانات...');
    const [rows] = await authPool.execute(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    );

    console.log('🔵 login: عدد النتائج:', rows.length);

    if (!rows.length) {
      console.log('❌ login: المستخدم غير موجود أو غير نشط:', username);
      return res.status(401).json({ status: 'error', message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    const user = rows[0];
    console.log('✅ login: تم العثور على المستخدم:', user.username, 'الرتبة:', user.role);

    console.log('🔵 login: جاري التحقق من كلمة المرور...');
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('❌ login: كلمة المرور غير صحيحة');
      return res.status(401).json({ status: 'error', message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }

    console.log('✅ login: كلمة المرور صحيحة');

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role
    };

    console.log('🔵 login: جاري إنشاء التوكن...');
    const token = signToken(payload);
    console.log('✅ login: تم إنشاء التوكن بنجاح');

    console.log('✅ login: تم تسجيل الدخول بنجاح للمستخدم:', user.username);
    return res.json({
      status: 'success',
      message: 'تم تسجيل الدخول',
      token,
      user: payload
    });
  } catch (err) {
    console.error('❌ خطأ في تسجيل الدخول:', err);
    console.error('❌ تفاصيل الخطأ:', err.message);
    console.error('❌ Stack:', err.stack);
    return res.status(500).json({ 
      status: 'error', 
      message: 'خطأ في السيرفر: ' + (err.message || 'خطأ غير معروف') 
    });
  }
}

/**
 * إنشاء مستخدم جديد — فقط الأدمن
 * ملاحظة: validateCreateUser يتحقق من البيانات قبل الوصول إلى هنا
 */
async function createUser(req, res) {
  try {
    console.log('🔵 createUser: بدء العملية');
    console.log('🔵 createUser: req.body =', req.body);
    console.log('🔵 createUser: req.user =', req.user);

    const { username, password, role = 'employee', full_name } = req.body;

    console.log('📝 محاولة إنشاء مستخدم:', { username, role, full_name });

    // ملاحظة: التحقق الأساسي تم في validateCreateUser middleware
    // لكن نتحقق مرة أخرى للسلامة
    if (!username || !password) {
      console.log('❌ createUser: الحقول مطلوبة (يجب ألا يحدث هذا)');
      return res.status(400).json({ status: 'error', message: 'اسم المستخدم وكلمة المرور مطلوبان' });
    }

    // التحقق من الاتصال بقاعدة البيانات
    try {
      const [testConnection] = await authPool.execute('SELECT 1');
      console.log('✅ الاتصال بقاعدة البيانات ناجح');
    } catch (dbErr) {
      console.error('❌ خطأ في الاتصال بقاعدة البيانات:', dbErr.message);
      return res.status(500).json({ 
        status: 'error', 
        message: 'خطأ في الاتصال بقاعدة البيانات: ' + dbErr.message 
      });
    }

    // التحقق من وجود اسم المستخدم
    let exist;
    try {
      [exist] = await authPool.execute(
        'SELECT id FROM users WHERE username = ?',
        [username]
      );
      console.log('🔍 التحقق من اسم المستخدم:', exist.length > 0 ? 'موجود' : 'غير موجود');
    } catch (checkErr) {
      console.error('❌ خطأ في التحقق من اسم المستخدم:', checkErr.message);
      console.error('❌ تفاصيل الخطأ:', checkErr);
      return res.status(500).json({ 
        status: 'error', 
        message: 'خطأ في التحقق من اسم المستخدم: ' + checkErr.message 
      });
    }

    if (exist.length > 0) {
      console.log('❌ اسم المستخدم موجود:', username);
      return res.status(400).json({ status: 'error', message: 'اسم المستخدم موجود مسبقاً' });
    }

    // تشفير كلمة المرور
    let hash;
    try {
      hash = await bcrypt.hash(password, 10);
      console.log('✅ تم تشفير كلمة المرور');
    } catch (hashErr) {
      console.error('❌ خطأ في تشفير كلمة المرور:', hashErr.message);
      return res.status(500).json({ 
        status: 'error', 
        message: 'خطأ في تشفير كلمة المرور' 
      });
    }

    // إدراج المستخدم الجديد
    const finalRole = role || 'employee';
    const finalFullName = full_name && full_name.trim() ? full_name.trim() : null;

    console.log('🔵 محاولة إدراج المستخدم:', { username, role: finalRole, full_name: finalFullName });

    // محاولة إدراج مع full_name أولاً
    try {
      await authPool.execute(
        `INSERT INTO users (username, password, role, full_name, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [username, hash, finalRole, finalFullName]
      );
    } catch (insertErr) {
      // إذا كان الخطأ بسبب عدم وجود عمود full_name، أضفه تلقائياً
      if (insertErr.code === 'ER_BAD_FIELD_ERROR' && insertErr.message.includes('full_name')) {
        console.log('⚠️ عمود full_name غير موجود، جاري إضافته...');
        try {
          await authPool.execute(
            `ALTER TABLE users ADD COLUMN full_name VARCHAR(100) NULL AFTER password`
          );
          console.log('✅ تم إضافة عمود full_name بنجاح');
          
          // إعادة المحاولة
          await authPool.execute(
            `INSERT INTO users (username, password, role, full_name, is_active)
             VALUES (?, ?, ?, ?, 1)`,
            [username, hash, finalRole, finalFullName]
          );
        } catch (alterErr) {
          // إذا فشل إضافة العمود، استخدم INSERT بدون full_name
          console.log('⚠️ فشل إضافة العمود، جاري الإدراج بدون full_name');
          await authPool.execute(
            `INSERT INTO users (username, password, role, is_active)
             VALUES (?, ?, ?, 1)`,
            [username, hash, finalRole]
          );
        }
      } else {
        throw insertErr; // إعادة رمي الخطأ إذا كان مختلفاً
      }
    }

    console.log('✅ تم إنشاء المستخدم بنجاح:', username);
    return res.json({ status: 'success', message: 'تم إنشاء المستخدم بنجاح' });

  } catch (err) {
    console.error('❌ خطأ في إنشاء المستخدم:', err);
    console.error('❌ تفاصيل الخطأ:', err.message);
    console.error('❌ Stack:', err.stack);
    console.error('❌ Error Code:', err.code);
    console.error('❌ SQL State:', err.sqlState);
    
    // معالجة أخطاء MySQL
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({ 
        status: 'error', 
        message: 'جدول المستخدمين غير موجود. تأكد من إنشاء قاعدة البيانات auth_db' 
      });
    }
    
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ 
        status: 'error', 
        message: 'اسم المستخدم موجود مسبقاً' 
      });
    }

    return res.status(500).json({ 
      status: 'error', 
      message: 'خطأ في السيرفر: ' + (err.message || 'خطأ غير معروف') 
    });
  }
}

// إعادة التحقق من الجلسة
async function me(req, res) {
  try {
    console.log('🔵 me: طلب التحقق من الجلسة');
    console.log('🔵 me: req.user =', req.user);
    
    if (!req.user) {
      console.log('❌ me: لا يوجد مستخدم في req.user');
      return res.status(401).json({ 
        status: 'error', 
        message: 'غير مصرح: لا يوجد مستخدم' 
      });
    }
    
    console.log('✅ me: إرجاع بيانات المستخدم:', req.user.username);
    return res.json({ 
      status: 'success', 
      user: req.user 
    });
  } catch (err) {
    console.error('❌ me: خطأ:', err);
    return res.status(500).json({ 
      status: 'error', 
      message: 'خطأ في السيرفر' 
    });
  }
}



/*  
========================================
     🔥 دوال إدارة المستخدمين (Admin)
========================================
*/

// جلب جميع المستخدمين
async function getUsers(req, res) {
  try {
    console.log('🔵 getUsers: بدء جلب المستخدمين');
    
    // التحقق من وجود الأعمدة في الجدول
    let hasFullNameColumn = false;
    let hasCreatedAtColumn = false;
    
    try {
      // التحقق من عمود full_name
      const [fullNameColumns] = await authPool.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'users' 
         AND COLUMN_NAME = 'full_name'`,
        [process.env.AUTH_DB_NAME || 'auth_db']
      );
      hasFullNameColumn = fullNameColumns.length > 0;
      console.log('🔍 عمود full_name:', hasFullNameColumn ? 'موجود' : 'غير موجود');
      
      // التحقق من عمود created_at
      const [createdAtColumns] = await authPool.execute(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'users' 
         AND COLUMN_NAME = 'created_at'`,
        [process.env.AUTH_DB_NAME || 'auth_db']
      );
      hasCreatedAtColumn = createdAtColumns.length > 0;
      console.log('🔍 عمود created_at:', hasCreatedAtColumn ? 'موجود' : 'غير موجود');
      
      // إضافة العمود created_at إذا لم يكن موجوداً
      if (!hasCreatedAtColumn) {
        console.log('⚠️ عمود created_at غير موجود، جاري إضافته...');
        await authPool.execute(
          `ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
        );
        hasCreatedAtColumn = true;
        console.log('✅ تم إضافة عمود created_at بنجاح');
      }
      
    } catch (colErr) {
      console.log('⚠️ خطأ في التحقق من الأعمدة:', colErr.message);
    }
    
    // بناء الاستعلام بناءً على الأعمدة المتاحة
    let selectFields = ['id', 'username', 'role', 'is_active'];
    if (hasFullNameColumn) {
      selectFields.push('full_name');
    }
    if (hasCreatedAtColumn) {
      selectFields.push('created_at');
    }
    
    let query = `SELECT ${selectFields.join(', ')} FROM users`;
    
    // إضافة ORDER BY فقط إذا كان created_at موجوداً
    if (hasCreatedAtColumn) {
      query += " ORDER BY created_at DESC";
    } else {
      query += " ORDER BY id DESC";
    }
    
    console.log('📝 تنفيذ الاستعلام:', query);
    const [rows] = await authPool.execute(query);
    
    console.log('✅ تم جلب', rows.length, 'مستخدم من قاعدة البيانات');
    
    // تنسيق البيانات
    const users = rows.map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name || null,
      created_at: user.created_at || new Date().toISOString(),
      is_active: user.is_active === 1 || user.is_active === true ? 1 : 0
    }));
    
    console.log('📤 إرسال', users.length, 'مستخدم إلى العميل');
    console.log('📤 بيانات المستخدمين:', JSON.stringify(users, null, 2));
    
    return res.json({ 
      status: "success", 
      users: users 
    });

  } catch (err) {
    console.error('❌ خطأ في getUsers:', err);
    console.error('❌ تفاصيل الخطأ:', err.message);
    console.error('❌ SQL State:', err.sqlState);
    console.error('❌ Error Code:', err.code);
    console.error('❌ Stack:', err.stack);
    return res.status(500).json({ status: "error", message: "خطأ في السيرفر: " + err.message });
  }
}

// تعديل مستخدم
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { username, password, role, full_name } = req.body;

    const fields = [];
    const values = [];

    if (username) { fields.push("username = ?"); values.push(username); }
    if (role) { fields.push("role = ?"); values.push(role); }
    if (full_name) { fields.push("full_name = ?"); values.push(full_name); }

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      fields.push("password = ?");
      values.push(hash);
    }

    if (fields.length === 0)
      return res.status(400).json({ status: "error", message: "لا يوجد تغييرات" });

    values.push(id);

    await authPool.execute(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    return res.json({ status: "success", message: "تم تحديث بيانات المستخدم" });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: "خطأ في السيرفر" });
  }
}

// تعطيل أو تفعيل مستخدم
async function toggleUser(req, res) {
  try {
    const { id } = req.params;

    await authPool.execute(
      "UPDATE users SET is_active = NOT is_active WHERE id = ?",
      [id]
    );

    return res.json({
      status: "success",
      message: "تم تغيير حالة المستخدم"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: "خطأ في السيرفر" });
  }
}

// حذف مستخدم
async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    await authPool.execute("DELETE FROM users WHERE id = ?", [id]);

    return res.json({
      status: "success",
      message: "تم حذف المستخدم"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: "خطأ في السيرفر" });
  }
}


/*  
========================================
             🔥 نهاية الدوال
========================================
*/

module.exports = {
  login,
  createUser,
  me,
  getUsers,
  updateUser,
  toggleUser,
  deleteUser
};
