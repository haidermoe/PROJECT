/**
 * ======================================================
 * Withdrawals Controller - معالجة سحوبات الوصفات
 * ======================================================
 * 
 * يستخدم اتصال معزول لقاعدة البيانات الرئيسية
 */

// استيراد اتصال قاعدة البيانات الرئيسية (معزول)
const { appPool } = require('../database/appConnection');
// استيراد اتصال قاعدة بيانات المصادقة (للمستخدمين)
const { authPool } = require('../database/authConnection');

// ===============================
//      مسح QR Code وتسجيل السحب
// ===============================
exports.scanQRCode = async (req, res) => {
  try {
    console.log('🔵 scanQRCode: بدء مسح QR Code');
    let { qr_code_data, withdrawal_quantity, notes } = req.body;
    const userId = req.user?.id;

    if (!qr_code_data) {
      return res.status(400).json({
        status: "error",
        message: "بيانات QR Code مطلوبة"
      });
    }

    // تحليل بيانات QR Code
    let qrData;
    try {
      qrData = typeof qr_code_data === 'string' ? JSON.parse(qr_code_data) : qr_code_data;
    } catch (parseErr) {
      return res.status(400).json({
        status: "error",
        message: "بيانات QR Code غير صحيحة"
      });
    }

    const productionId = qrData.production_id;
    if (!productionId) {
      return res.status(400).json({
        status: "error",
        message: "رقم الإنتاج غير موجود في QR Code"
      });
    }

    // إذا كان QR Code يحتوي على portion_weight، نستخدم وزن البورشن ككمية تلقائياً
    if (qrData.portion_weight) {
      const portionWeight = parseFloat(qrData.portion_weight);
      // كمية السحب = وزن البورشن (1 بورشن) تلقائياً
      withdrawal_quantity = portionWeight;
      console.log('✅ استخدام وزن البورشن ككمية السحب:', withdrawal_quantity);
    }

    // التحقق من الكمية
    if (!withdrawal_quantity || withdrawal_quantity <= 0) {
      return res.status(400).json({
        status: "error",
        message: "كمية السحب غير صحيحة"
      });
    }

    // التحقق من وجود الإنتاج
    const [productionRows] = await appPool.query(
      `SELECT rp.*, ps.remaining_quantity 
       FROM recipe_productions rp
       LEFT JOIN production_statistics ps ON rp.id = ps.production_id
       WHERE rp.id = ?`,
      [productionId]
    );

    if (productionRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "الإنتاج غير موجود"
      });
    }

    const production = productionRows[0];
    const remainingQty = parseFloat(production.remaining_quantity || production.production_quantity);
    const withdrawalQty = parseFloat(withdrawal_quantity || 0);

    // التحقق من الكمية المتبقية
    if (withdrawalQty > remainingQty) {
      return res.status(400).json({
        status: "error",
        message: `الكمية المتبقية غير كافية. المتبقي: ${remainingQty}`
      });
    }

    // التحقق من تاريخ الانتهاء
    const expiryDate = new Date(production.expiry_date);
    const now = new Date();
    if (now > expiryDate) {
      return res.status(400).json({
        status: "error",
        message: "هذا الإنتاج منتهي الصلاحية"
      });
    }

    // إدراج السحب
    const connection = await appPool.getConnection();
    try {
      await connection.beginTransaction();

      // إدراج السحب
      const [result] = await connection.execute(
        `INSERT INTO recipe_withdrawals 
         (production_id, user_id, withdrawal_quantity, notes) 
         VALUES (?, ?, ?, ?)`,
        [productionId, userId, withdrawalQty, notes || null]
      );

      // تحديث إحصائيات الإنتاج
      const newRemaining = remainingQty - withdrawalQty;
      await connection.execute(
        `INSERT INTO production_statistics (production_id, total_withdrawn, remaining_quantity, withdrawal_count)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
         total_withdrawn = total_withdrawn + ?,
         remaining_quantity = remaining_quantity - ?,
         withdrawal_count = withdrawal_count + 1,
         updated_at = CURRENT_TIMESTAMP`,
        [productionId, withdrawalQty, newRemaining, withdrawalQty, withdrawalQty]
      );

      await connection.commit();

      console.log('✅ scanQRCode: تم تسجيل السحب بنجاح:', result.insertId);

      // جلب بيانات السحب الكاملة مع الكمية المتبقية المحدثة
      const [withdrawalRows] = await appPool.query(
        `SELECT rw.*, rp.production_quantity, rp.production_date, rp.expiry_date,
                r.item_name, r.name, r.reference,
                ps.remaining_quantity, ps.total_withdrawn, ps.withdrawal_count
         FROM recipe_withdrawals rw
         LEFT JOIN recipe_productions rp ON rw.production_id = rp.id
         LEFT JOIN recipes r ON rp.recipe_id = r.id
         LEFT JOIN production_statistics ps ON rp.id = ps.production_id
         WHERE rw.id = ?`,
        [result.insertId]
      );

      // جلب اسم المستخدم من auth_db
      let username = 'غير معروف';
      if (userId) {
        try {
          const [userRows] = await authPool.query(
            'SELECT username, full_name FROM users WHERE id = ?',
            [userId]
          );
          if (userRows.length > 0) {
            username = userRows[0].full_name || userRows[0].username;
          }
        } catch (userErr) {
          console.error('⚠️ خطأ في جلب اسم المستخدم:', userErr);
        }
      }

      const withdrawal = withdrawalRows[0];
      withdrawal.username = username;

      res.json({
        status: "success",
        message: "تم تسجيل السحب بنجاح",
        data: withdrawal
      });
    } catch (dbErr) {
      await connection.rollback();
      throw dbErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ خطأ في scanQRCode:', err);
    console.error('❌ تفاصيل الخطأ:', err.message);
    console.error('❌ Stack:', err.stack);
    res.status(500).json({
      status: "error",
      message: err.message || 'خطأ في تسجيل السحب'
    });
  }
};

// ===============================
//      جلب جميع السحوبات
// ===============================
exports.getWithdrawals = async (req, res) => {
  try {
    const { production_id, user_id, start_date, end_date, limit = 100, offset = 0 } = req.query;
    
    let query = `SELECT rw.*, 
                 rp.production_quantity, rp.production_date, rp.expiry_date,
                 r.item_name, r.name, r.reference, r.version,
                 ps.remaining_quantity, ps.total_withdrawn
                 FROM recipe_withdrawals rw
                 LEFT JOIN recipe_productions rp ON rw.production_id = rp.id
                 LEFT JOIN recipes r ON rp.recipe_id = r.id
                 LEFT JOIN production_statistics ps ON rp.id = ps.production_id
                 WHERE 1=1`;
    const params = [];

    if (production_id) {
      query += ' AND rw.production_id = ?';
      params.push(production_id);
    }

    if (user_id) {
      query += ' AND rw.user_id = ?';
      params.push(user_id);
    }

    if (start_date) {
      query += ' AND DATE(rw.withdrawal_date) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(rw.withdrawal_date) <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY rw.withdrawal_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await appPool.query(query, params);

    // جلب أسماء المستخدمين من auth_db
    const userIds = [...new Set(rows.map(row => row.user_id))];
    const userMap = {};
    
    if (userIds.length > 0) {
      try {
        const placeholders = userIds.map(() => '?').join(',');
        const [userRows] = await authPool.query(
          `SELECT id, username, full_name FROM users WHERE id IN (${placeholders})`,
          userIds
        );
        userRows.forEach(user => {
          userMap[user.id] = user.full_name || user.username;
        });
      } catch (userErr) {
        console.error('⚠️ خطأ في جلب أسماء المستخدمين:', userErr);
      }
    }

    // إضافة أسماء المستخدمين
    const withdrawals = rows.map(row => ({
      ...row,
      username: userMap[row.user_id] || 'غير معروف'
    }));

    res.json({
      status: "success",
      data: withdrawals
    });
  } catch (err) {
    console.error('❌ خطأ في getWithdrawals:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      جلب سحب معين
// ===============================
exports.getWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await appPool.query(
      `SELECT rw.*, 
       rp.production_quantity, rp.production_date, rp.expiry_date,
       r.item_name, r.name, r.reference, r.version,
       ps.remaining_quantity, ps.total_withdrawn
       FROM recipe_withdrawals rw
       LEFT JOIN recipe_productions rp ON rw.production_id = rp.id
       LEFT JOIN recipes r ON rp.recipe_id = r.id
       LEFT JOIN production_statistics ps ON rp.id = ps.production_id
       WHERE rw.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "السحب غير موجود"
      });
    }

    // جلب اسم المستخدم
    const withdrawal = rows[0];
    let username = 'غير معروف';
    if (withdrawal.user_id) {
      try {
        const [userRows] = await authPool.query(
          'SELECT username, full_name FROM users WHERE id = ?',
          [withdrawal.user_id]
        );
        if (userRows.length > 0) {
          username = userRows[0].full_name || userRows[0].username;
        }
      } catch (userErr) {
        console.error('⚠️ خطأ في جلب اسم المستخدم:', userErr);
      }
    }

    withdrawal.username = username;

    res.json({
      status: "success",
      data: withdrawal
    });
  } catch (err) {
    console.error('❌ خطأ في getWithdrawal:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      إحصائيات السحوبات
// ===============================
exports.getWithdrawalsStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = `SELECT 
                 COUNT(*) AS total_withdrawals,
                 SUM(withdrawal_quantity) AS total_quantity,
                 COUNT(DISTINCT user_id) AS unique_users,
                 COUNT(DISTINCT production_id) AS unique_productions
                 FROM recipe_withdrawals
                 WHERE 1=1`;
    const params = [];

    if (start_date) {
      query += ' AND DATE(withdrawal_date) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(withdrawal_date) <= ?';
      params.push(end_date);
    }

    const [rows] = await appPool.query(query, params);
    const stats = rows[0];

    res.json({
      status: "success",
      data: {
        total_withdrawals: parseInt(stats.total_withdrawals) || 0,
        total_quantity: parseFloat(stats.total_quantity) || 0,
        unique_users: parseInt(stats.unique_users) || 0,
        unique_productions: parseInt(stats.unique_productions) || 0
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getWithdrawalsStats:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

