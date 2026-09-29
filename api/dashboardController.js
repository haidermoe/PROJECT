/**
 * ======================================================
 * Dashboard Controller - معالجة بيانات الداشبورد
 * ======================================================
 * 
 * يستخدم اتصال معزول لقاعدة البيانات الرئيسية
 */

// استيراد اتصال قاعدة البيانات الرئيسية (معزول)
const { appPool } = require('../database/appConnection');
// استيراد اتصال قاعدة بيانات المصادقة (لعدد الموظفين)
const { authPool } = require('../database/authConnection');

// ===============================
//      المواد القليلة
// ===============================
exports.getLowStock = async (req, res) => {
  try {
    const [rows] = await appPool.query(`
      SELECT id, name, unit, stock_quantity 
      FROM ingredients 
      WHERE stock_quantity <= 5
      ORDER BY stock_quantity ASC
    `);
    res.json({ status: "success", data: rows });
  } catch (err) {
    console.error('❌ خطأ في getLowStock:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};


// ===============================
//      الهدر اليومي
// ===============================
exports.getDailyWaste = async (req, res) => {
  try {
    const [rows] = await appPool.query(`
      SELECT id, ingredient_id, quantity, created_at 
      FROM transactions 
      WHERE type = 'withdraw'
        AND DATE(created_at) = CURDATE()
      ORDER BY created_at DESC
    `);
    res.json({ status: "success", data: rows });
  } catch (err) {
    console.error('❌ خطأ في getDailyWaste:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};


// ===============================
//      آخر عملية سحب
// ===============================
exports.getLastOut = async (req, res) => {
  try {
    const [rows] = await appPool.query(`
      SELECT t.*, i.name AS ingredient_name
      FROM transactions t
      LEFT JOIN ingredients i ON t.ingredient_id = i.id
      WHERE t.type = 'withdraw'
      ORDER BY t.created_at DESC
      LIMIT 1
    `);
    res.json({ status: "success", data: rows[0] || null });
  } catch (err) {
    console.error('❌ خطأ في getLastOut:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      عدد الموظفين
// ===============================
exports.getEmployeeCount = async (req, res) => {
  try {
    // استخدام اتصال قاعدة بيانات المصادقة المعزول
    const [[result]] = await authPool.query(
      "SELECT COUNT(*) AS count FROM users WHERE is_active = 1"
    );
    res.json({ status: "success", data: { count: result.count } });
  } catch (err) {
    console.error('❌ خطأ في getEmployeeCount:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      قائمة الموظفين (مبسطة للداشبورد)
// ===============================
exports.getEmployees = async (req, res) => {
  try {
    console.log('🔵 getEmployees: بدء جلب قائمة الموظفين');
    
    // التحقق من وجود عمود full_name في الجدول
    let hasFullNameColumn = false;
    try {
      const [columns] = await authPool.query(
        `SELECT COLUMN_NAME 
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = 'users' 
         AND COLUMN_NAME = 'full_name'`,
        [process.env.AUTH_DB_NAME || 'auth_db']
      );
      hasFullNameColumn = columns.length > 0;
      console.log('🔍 عمود full_name:', hasFullNameColumn ? 'موجود' : 'غير موجود');
    } catch (colErr) {
      console.log('⚠️ خطأ في التحقق من عمود full_name:', colErr.message);
    }
    
    // بناء الاستعلام - جلب معلومات مبسطة فقط
    let query;
    if (hasFullNameColumn) {
      query = `SELECT id, username, role, full_name, created_at, is_active 
               FROM users 
               WHERE is_active = 1 
               ORDER BY created_at DESC 
               LIMIT 10`;
    } else {
      query = `SELECT id, username, role, created_at, is_active 
               FROM users 
               WHERE is_active = 1 
               ORDER BY created_at DESC 
               LIMIT 10`;
    }
    
    console.log('📝 تنفيذ الاستعلام:', query);
    const [rows] = await authPool.query(query);
    
    console.log('📊 عدد الصفوف المسترجعة:', rows.length);
    
    // تنسيق البيانات للعرض
    const employees = rows.map(user => {
      // أسماء الرتب بالعربية
      const roleNames = {
        'admin': 'مدير عام',
        'hr': 'موارد بشرية',
        'manager': 'مدير',
        'kitchen_manager': 'مدير مطبخ',
        'employee': 'موظف'
      };
      
      return {
        id: user.id,
        username: user.username,
        full_name: user.full_name || user.username,
        role: roleNames[user.role] || user.role,
        role_code: user.role,
        created_at: user.created_at,
        is_active: user.is_active
      };
    });
    
    console.log('✅ تم جلب', employees.length, 'موظف');
    
    res.json({ 
      status: "success", 
      data: employees 
    });
  } catch (err) {
    console.error('❌ خطأ في getEmployees:', err);
    console.error('❌ تفاصيل الخطأ:', err.message);
    console.error('❌ SQL State:', err.sqlState);
    console.error('❌ Error Code:', err.code);
    console.error('❌ Stack:', err.stack);
    res.status(500).json({ 
      status: "error", 
      message: err.message || 'خطأ في جلب قائمة الموظفين',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ===============================
//      سعر الدولار من البورصة العراقية
// ===============================
exports.getUsdRate = async (req, res) => {
  try {
    const https = require('https');
    
    // محاولة جلب السعر من API البورصة العراقية أو API عام
    // نستخدم exchangerate-api.com كخيار أول
    const options = {
      hostname: 'api.exchangerate-api.com',
      path: '/v4/latest/USD',
      method: 'GET',
      timeout: 5000,
      headers: {
        'User-Agent': 'Kitchen-Inventory-System/1.0'
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (apiRes) => {
        let data = '';
        
        apiRes.on('data', (chunk) => {
          data += chunk;
        });
        
        apiRes.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            let iqdRate = jsonData.rates?.IQD;
            
            // إذا لم يكن IQD متاحاً، نستخدم سعر تقريبي
            // سعر تقريبي: 1 USD = 1310 IQD (يمكن تحديثه حسب السعر الحالي)
            if (!iqdRate || isNaN(iqdRate)) {
              console.log('⚠️ IQD غير متاح في API، استخدام سعر افتراضي');
              iqdRate = 1310;
            }
            
            // تقريب السعر إلى رقمين عشريين
            const rate = parseFloat(iqdRate).toFixed(2);
            
            console.log('✅ تم جلب سعر الدولار:', rate, 'IQD');
            
            res.json({ 
              status: "success", 
              data: { 
                rate: rate,
                currency: 'IQD',
                timestamp: new Date().toISOString()
              } 
            });
            resolve();
          } catch (parseErr) {
            console.error('❌ خطأ في تحليل بيانات API:', parseErr);
            // إرجاع سعر افتراضي في حالة الخطأ
            res.json({ 
              status: "success", 
              data: { 
                rate: "1310.00",
                currency: 'IQD',
                timestamp: new Date().toISOString(),
                note: 'سعر افتراضي'
              } 
            });
            resolve();
          }
        });
      });
      
      req.on('error', (err) => {
        console.error('❌ خطأ في الاتصال بـ API:', err.message);
        // إرجاع سعر افتراضي في حالة فشل الاتصال
        res.json({ 
          status: "success", 
          data: { 
            rate: "1310.00",
            currency: 'IQD',
            timestamp: new Date().toISOString(),
            note: 'سعر افتراضي - فشل الاتصال'
          } 
        });
        resolve();
      });
      
      req.on('timeout', () => {
        req.destroy();
        console.error('❌ انتهت مهلة الاتصال بـ API');
        res.json({ 
          status: "success", 
          data: { 
            rate: "1310.00",
            currency: 'IQD',
            timestamp: new Date().toISOString(),
            note: 'سعر افتراضي - انتهت المهلة'
          } 
        });
        resolve();
      });
      
      req.setTimeout(5000);
      req.end();
    });
  } catch (err) {
    console.error('❌ خطأ في getUsdRate:', err);
    // إرجاع سعر افتراضي في حالة الخطأ
    res.json({ 
      status: "success", 
      data: { 
        rate: "1310.00",
        currency: 'IQD',
        timestamp: new Date().toISOString(),
        note: 'سعر افتراضي'
      } 
    });
  }
};
