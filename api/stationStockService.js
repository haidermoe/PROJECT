/**
 * ======================================================
 * Station Stock Service - محرك مخزون السكاشن والعهد التشغيلية
 * خصم استهلاك الأوردرات والهدر من رصيد السكشن/الموظف
 * ======================================================
 */

const { appPool } = require('../database/appConnection');

/**
 * دالة مساعدة لإرسال إشعارات فورية لجميع المديرين ومدراء المطبخ
 */
async function notifyAdminsAndManagers(type, refId, title, message) {
  try {
    const { createNotification } = require('./notificationsController');
    const { authPool } = require('../database/authConnection');
    const [managers] = await authPool.query(
      `SELECT id FROM users WHERE role IN ('admin', 'kitchen_manager') AND is_active = 1`
    );
    for (const m of managers) {
      await createNotification(m.id, type, refId, title, message);
    }
  } catch (err) {
    console.warn('⚠️ [Station Notification Warning]:', err.message);
  }
}
async function transferToStation({ stationId, ingredientId, quantity, userId, notes }) {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) throw new Error('الكمية المحولة غير صحيحة');

    // 1. التحقق من رصيد المخزن الرئيسي وخصم الكمية منه
    const [ingRows] = await connection.query(`SELECT stock_quantity, name FROM ingredients WHERE id = ? FOR UPDATE`, [ingredientId]);
    if (!ingRows.length) throw new Error('المادة غير موجودة في المخزن الرئيسي');

    const currentMainStock = parseFloat(ingRows[0].stock_quantity) || 0;
    if (currentMainStock < qty) {
      throw new Error(`رصيد المخزن الرئيسي غير كافٍ! المتوفر: ${currentMainStock}، المطلوب: ${qty}`);
    }

    await connection.query(`UPDATE ingredients SET stock_quantity = stock_quantity - ? WHERE id = ?`, [qty, ingredientId]);

    // تسجيل حركة سحب في transactions بالمخزن الرئيسي
    await connection.query(`
      INSERT INTO transactions (ingredient_id, user_id, type, quantity, note)
      VALUES (?, ?, 'withdraw', ?, ?)
    `, [ingredientId, userId || null, qty, `صرف إلى سكشن ID: ${stationId} - ${notes || ''}`]);

    // 2. إضافة الكمية إلى رصيد السكشن في station_inventory
    await connection.query(`
      INSERT INTO station_inventory (station_id, ingredient_id, quantity, last_assigned_user_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        quantity = quantity + VALUES(quantity),
        last_assigned_user_id = VALUES(last_assigned_user_id),
        last_transferred_at = CURRENT_TIMESTAMP
    `, [stationId, ingredientId, qty, userId || null]);

    // 3. تسجيل حركة تحويل وارد في station_stock_moves
    await connection.query(`
      INSERT INTO station_stock_moves (station_id, ingredient_id, user_id, type, quantity, notes)
      VALUES (?, ?, ?, 'transfer_in', ?, ?)
    `, [stationId, ingredientId, userId || null, qty, notes || 'تحويل من المخزن الرئيسي إلى السكشن']);

    await connection.commit();
    return {
      success: true,
      message: `تم تحويل ${qty} من ${ingRows[0].name} بنجاح إلى رصيد السكشن.`
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * 2) خصم استهلاك الأوردر من رصيد السكشن المسؤول طبقاً لكارت الوصفة (Recipe Card)
 */
async function depleteOrderFromStation(orderId, passedConnection = null) {
  const connection = passedConnection || await appPool.getConnection();
  const shouldManageTransaction = !passedConnection;

  try {
    if (shouldManageTransaction) await connection.beginTransaction();

    // جلب أصناف الطلب مع معلومات المحطة
    const [orderItems] = await connection.query(`
      SELECT 
        oi.id, oi.item_id, oi.item_name, oi.quantity, oi.station_id,
        pi.recipe_id, pi.station_id AS pi_station_id
      FROM pos_order_items oi
      LEFT JOIN pos_items pi ON oi.item_id = pi.id
      WHERE oi.order_id = ?
    `, [orderId]);

    for (const item of orderItems) {
      const orderQty = parseFloat(item.quantity) || 1;
      let targetStationId = item.station_id || item.pi_station_id;

      let wasStationUnmapped = false;

      // 1) إذا لم يكن الصنف مسنداً لمحطة، نبحث عن أول محطة مطبخ ونقوم بالمعالجة التلقائية
      if (!targetStationId) {
        wasStationUnmapped = true;
        const [defaultStation] = await connection.query(
          `SELECT id, station_name FROM pos_stations WHERE station_type = 'kitchen' AND is_active = 1 LIMIT 1`
        );
        targetStationId = defaultStation[0]?.id || 1;
        const stationName = defaultStation[0]?.station_name || 'المطبخ الرئيسي';

        // 🛠️ معالجة ذاتية: تحديث الصنف في pos_items ليتم ربطه دائماً بهذه المحطة
        if (item.item_id) {
          await connection.query(
            `UPDATE pos_items SET station_id = ? WHERE id = ? AND (station_id IS NULL OR station_id = 0)`,
            [targetStationId, item.item_id]
          );
        }

        // 🔔 إرسال إشعار فوري للمدير العام ومدير المطبخ
        await notifyAdminsAndManagers(
          'item_unmapped_station',
          orderId,
          `⚠️ صنف غير مربوط بمحطة تحضير: ${item.item_name}`,
          `تم طلب الصنف "${item.item_name}" في الطلب #${orderId} وهو غير مسند لأي سكشن. قام النظام بتوجيهه تلقائياً إلى "${stationName}" وتثبيت السكشن في الإعدادات.`
        );
      }

      // 2) البحث عن كارت الوصفة (Recipe Card) والمعالجة في حال عدم وجوده
      let recipeId = item.recipe_id;
      if (!recipeId) {
        // مطابقة بالاسم في جدول recipes
        const [matchedRecipe] = await connection.query(`
          SELECT id FROM recipes 
          WHERE name = ? OR item_name = ? 
          LIMIT 1
        `, [item.item_name, item.item_name]);

        if (matchedRecipe.length > 0) {
          recipeId = matchedRecipe[0].id;
          // ربط تلقائي دائم
          if (item.item_id) {
            await connection.query(`UPDATE pos_items SET recipe_id = ? WHERE id = ?`, [recipeId, item.item_id]);
          }
        } else {
          // 🛠️ معالجة ذاتية: إنشاء مسودة كارت وصفة (Draft Recipe) فوراً
          const [draftInsert] = await connection.query(`
            INSERT INTO recipes (item_name, name, status, yield, portions)
            VALUES (?, ?, 'draft', '1 وجبة', 1)
          `, [item.item_name, item.item_name]);
          recipeId = draftInsert.insertId;

          if (item.item_id) {
            await connection.query(`UPDATE pos_items SET recipe_id = ? WHERE id = ?`, [recipeId, item.item_id]);
          }

          // 🔔 إرسال إشعار لمدير المطبخ لملء مكونات الوصفة المنشأة
          await notifyAdminsAndManagers(
            'missing_recipe_card',
            recipeId,
            `⚠️ صنف مباع بدون كارت وصفة: ${item.item_name}`,
            `تم بيع الصنف "${item.item_name}" في طلب #${orderId} دون وجود كارت وصفة لخصم المكونات. قام النظام بإنشاء مسودة وصفة له برقم #${recipeId}. يرجى إضافة مقادير المكونات في صفحة الوصفات.`
          );
        }
      }

      // جلب مكونات كارت الوصفة والكميات المعيارية للوجبة
      const [recipeIngredients] = await connection.query(`
        SELECT ingredient_id, quantity 
        FROM recipe_ingredients 
        WHERE recipe_id = ?
      `, [recipeId]);

      for (const ring of recipeIngredients) {
        const standardQty = parseFloat(ring.quantity) || 0;
        const totalConsumed = standardQty * orderQty;

        if (totalConsumed <= 0) continue;

        // ⚠️ الخصم يتم من رصيد السكشن المسند إليه الصنف في station_inventory وليس من المخزن الرئيسي!
        await connection.query(`
          INSERT INTO station_inventory (station_id, ingredient_id, quantity)
          VALUES (?, ?, -?)
          ON DUPLICATE KEY UPDATE quantity = quantity - VALUES(quantity)
        `, [targetStationId, ring.ingredient_id, totalConsumed]);

        // تسجيل حركة استهلاك في سجل حركات السكشن
        await connection.query(`
          INSERT INTO station_stock_moves (station_id, ingredient_id, type, quantity, ref_order_id, notes)
          VALUES (?, ?, 'order_consumption', ?, ?, ?)
        `, [
          targetStationId,
          ring.ingredient_id,
          totalConsumed,
          orderId,
          `استهلاك وجبة: ${item.item_name} (كمية ${orderQty}) - كارت وصفة #${recipeId}`
        ]);

        // 🔔 فحص ما إذا كان رصيد السكشن قد نزل دون الحد الأدنى وإرسال تنبيه فوري
        try {
          const [currRows] = await connection.query(`
            SELECT si.quantity, si.min_qty, i.name AS ing_name, s.station_name
            FROM station_inventory si
            JOIN ingredients i ON si.ingredient_id = i.id
            JOIN pos_stations s ON si.station_id = s.id
            WHERE si.station_id = ? AND si.ingredient_id = ?
          `, [targetStationId, ring.ingredient_id]);

          if (currRows.length > 0) {
            const remaining = parseFloat(currRows[0].quantity) || 0;
            const minLimit = parseFloat(currRows[0].min_qty) || 2;
            if (remaining <= minLimit) {
              await notifyAdminsAndManagers(
                'low_station_stock',
                targetStationId,
                `⚠️ رصيد منخفض في سكشن ${currRows[0].station_name}: ${currRows[0].ing_name}`,
                `رصيد مادة "${currRows[0].ing_name}" في سكشن "${currRows[0].station_name}" أصبح (${remaining}) وهو أقل من حد التنبيه (${minLimit}). يرجى تحويل كمية من المخزن الرئيسي فوراً.`
              );
            }
          }
        } catch (alertErr) {
          console.warn('⚠️ خطأ فحص رصيد السكشن:', alertErr.message);
        }
      }
    }

    if (shouldManageTransaction) await connection.commit();
    return true;
  } catch (err) {
    if (shouldManageTransaction) await connection.rollback();
    console.error('❌ خطأ في depleteOrderFromStation:', err);
    throw err;
  } finally {
    if (shouldManageTransaction) connection.release();
  }
}

/**
 * 3) خصم الهدر المعتمد من رصيد السكشن المسؤول + إنشاء قيد محاسبي تلقائي
 */
async function deductWasteFromStation(wasteId, passedConnection = null) {
  const connection = passedConnection || await appPool.getConnection();
  const shouldManageTransaction = !passedConnection;

  try {
    if (shouldManageTransaction) await connection.beginTransaction();

    const [wasteRows] = await connection.query(`SELECT * FROM waste_records WHERE id = ? FOR UPDATE`, [wasteId]);
    if (!wasteRows.length) throw new Error('سجل الهدر غير موجود');

    const waste = wasteRows[0];
    const qty = parseFloat(waste.quantity) || 0;
    const ingredientId = waste.ingredient_id;
    const stationId = waste.station_id;

    if (!ingredientId || qty <= 0) {
      if (shouldManageTransaction) await connection.commit();
      return;
    }

    // إذا كان الهدر مسنداً لسكشن معين، يُخصم من رصيد السكشن
    if (stationId) {
      await connection.query(`
        INSERT INTO station_inventory (station_id, ingredient_id, quantity)
        VALUES (?, ?, -?)
        ON DUPLICATE KEY UPDATE quantity = quantity - VALUES(quantity)
      `, [stationId, ingredientId, qty]);

      await connection.query(`
        INSERT INTO station_stock_moves (station_id, ingredient_id, user_id, type, quantity, ref_waste_id, notes)
        VALUES (?, ?, ?, 'waste_loss', ?, ?, ?)
      `, [stationId, ingredientId, waste.recorded_by, qty, wasteId, `هدر تالف في السكشن: ${waste.reason || ''}`]);
    } else {
      // هدر من المخزن الرئيسي مباشرة
      await connection.query(`UPDATE ingredients SET stock_quantity = stock_quantity - ? WHERE id = ?`, [qty, ingredientId]);
      await connection.query(`
        INSERT INTO transactions (ingredient_id, user_id, type, quantity, note)
        VALUES (?, ?, 'withdraw', ?, ?)
      `, [ingredientId, waste.recorded_by, qty, `تسجيل هدر معتمد #${wasteId} - ${waste.reason || ''}`]);
    }

    // إنشاء قيد محاسبي تلقائي في شجرة الحسابات (حساب 502000 تكلفة الهدر دائنًا لمخزون المواد 104000)
    try {
      // تقدير تكلفة المادة الهالكة
      const estimatedCost = qty * 5.0; // افتراض أو تقدير تكلفة الوحدة
      const [wasteAcc] = await connection.query('SELECT id FROM account_account WHERE code = ?', ['502000']);
      const [invAcc] = await connection.query('SELECT id FROM account_account WHERE code = ?', ['104000']);
      const [miscJournal] = await connection.query('SELECT id FROM account_journal WHERE code = ?', ['MISC']);

      if (wasteAcc.length && invAcc.length && miscJournal.length) {
        const year = new Date().getFullYear();
        const todayStr = new Date().toISOString().split('T')[0];
        const moveName = `WST/${year}/${String(wasteId).padStart(4, '0')}`;

        const [moveRes] = await connection.query(`
          INSERT INTO account_move (name, date, ref, journal_id, state, total_amount, created_by)
          VALUES (?, ?, ?, ?, 'posted', ?, ?)
        `, [
          moveName,
          todayStr,
          `إثبات خسارة هدر مادة ${waste.item_name} - سجل #${wasteId}`,
          miscJournal[0].id,
          estimatedCost,
          waste.recorded_by || null
        ]);

        const moveId = moveRes.insertId;

        // مدين: تكلفة الهدر والتالف (502000)
        await connection.query(`
          INSERT INTO account_move_line (move_id, account_id, name, debit, credit)
          VALUES (?, ?, ?, ?, 0.00)
        `, [moveId, wasteAcc[0].id, `خسارة هدر ${waste.item_name}`, estimatedCost]);

        // دائن: مخزون المواد (104000)
        await connection.query(`
          INSERT INTO account_move_line (move_id, account_id, name, debit, credit)
          VALUES (?, ?, ?, 0.00, ?)
        `, [moveId, invAcc[0].id, `تخفيض المخزون بسبب الهدر`, estimatedCost]);
      }
    } catch (accErr) {
      console.warn('⚠️ تعذر تسجيل القيد المحاسبي للهدر:', accErr.message);
    }

    if (shouldManageTransaction) await connection.commit();
  } catch (err) {
    if (shouldManageTransaction) await connection.rollback();
    console.error('❌ خطأ في deductWasteFromStation:', err);
    throw err;
  } finally {
    if (shouldManageTransaction) connection.release();
  }
}

/**
 * 4) جلب رصيد مخزون السكاشن مع تفاصيل المواد
 */
async function getStationInventories() {
  const [rows] = await appPool.query(`
    SELECT 
      si.id,
      si.station_id,
      s.station_name,
      s.station_code,
      si.ingredient_id,
      i.name AS ingredient_name,
      i.unit AS ingredient_unit,
      COALESCE(i.material_type, 'raw') AS material_type,
      si.quantity AS station_stock,
      i.stock_quantity AS main_store_stock,
      si.min_qty,
      si.last_transferred_at,
      si.last_assigned_user_id
    FROM station_inventory si
    JOIN pos_stations s ON si.station_id = s.id
    JOIN ingredients i ON si.ingredient_id = i.id
    ORDER BY s.station_name ASC, i.name ASC
  `);
  return rows;
}

/**
 * 5) حاسبة الإنتاجية والتغطية الذكية والتمييز بين المواد الخام والمصنعة
 */
async function calculateYieldCoverage(stationId, ingredientId, quantity) {
  const qty = parseFloat(quantity) || 0;

  // جلب تفاصيل المادة من المخزن
  const [ingRows] = await appPool.query(
    `SELECT id, name, unit, stock_quantity, COALESCE(material_type, 'raw') AS material_type
     FROM ingredients WHERE id = ?`,
    [ingredientId]
  );
  if (!ingRows.length) throw new Error('المادة غير موجودة');

  const ing = ingRows[0];
  const isManufactured = ing.material_type === 'manufactured';
  const materialTypeLabel = isManufactured ? 'مادة مصنعة / تحضير مسبق 🥫' : 'مادة خام أولية 🌾';

  // البحث عن جميع الوصفات التابعة لهذا السكشن أو التي يدخل فيها هذا المكون
  const [recipes] = await appPool.query(`
    SELECT DISTINCT 
      r.id AS recipe_id, 
      COALESCE(r.item_name, r.name) AS recipe_name, 
      r.yield, 
      r.portions,
      ri.quantity AS required_per_portion
    FROM recipes r
    JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    LEFT JOIN pos_items pi ON (pi.recipe_id = r.id OR pi.item_name = r.name)
    WHERE ri.ingredient_id = ? 
      AND (pi.station_id = ? OR pi.station_id IS NULL)
  `, [ingredientId, stationId]);

  const coverageList = recipes.map(rec => {
    const reqPortion = parseFloat(rec.required_per_portion) || 1;
    const portionsCount = reqPortion > 0 ? Math.floor(qty / reqPortion) : 0;
    return {
      recipe_id: rec.recipe_id,
      recipe_name: rec.recipe_name,
      required_per_portion: reqPortion,
      portions_possible: portionsCount,
      unit: ing.unit
    };
  });

  // صياغة ملخص التغطية باللغة العربية
  let summaryText = '';
  if (coverageList.length === 0) {
    summaryText = `هذه المادة (${ing.name}) لم يتم ربطها بعد بوصفة معيارية مسندة لهذا السكشن.`;
  } else {
    const lines = coverageList.map(c => `• ${c.recipe_name}: تكفي لتحضير [ ${c.portions_possible} وجبة ] (بمعدل ${c.required_per_portion} ${c.unit} للوجبة)`);
    summaryText = `هذه الكمية (${qty} ${ing.unit}) تغطي الوصفات التالية:\n` + lines.join('\n');
  }

  return {
    ingredientId: ing.id,
    ingredientName: ing.name,
    unit: ing.unit,
    materialType: ing.material_type,
    materialTypeLabel,
    availableMainStock: parseFloat(ing.stock_quantity) || 0,
    requestedQty: qty,
    recipesCoverage: coverageList,
    coverageSummary: summaryText
  };
}

/**
 * 6) تقديم طلب صرف عهدة تشغيلية (مع مراعاة علم وموافقة مدير المطبخ)
 */
async function requestStationTransfer({ stationId, ingredientId, quantity, userId, userRole, notes }) {
  const coverage = await calculateYieldCoverage(stationId, ingredientId, quantity);

  // إذا كان المستخدم مدير المطبخ أو مدير عام -> موافقة وصرف فوري مباشر
  if (userRole === 'kitchen_manager' || userRole === 'admin') {
    const transferResult = await transferToStation({
      stationId,
      ingredientId,
      quantity,
      userId,
      notes
    });

    const [insertReq] = await appPool.query(`
      INSERT INTO station_transfer_requests 
        (station_id, ingredient_id, quantity, coverage_summary, requested_by, approved_by, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'approved', ?)
    `, [stationId, ingredientId, quantity, coverage.coverageSummary, userId, userId, notes || 'صرف مباشر من مدير المطبخ']);

    return {
      autoApproved: true,
      requestId: insertReq.insertId,
      message: `تم الصرف الفوري للسكشن بنجاح بعلم مدير المطبخ.\n\n${coverage.coverageSummary}`,
      coverage
    };
  }

  // إذا كان شيف سكشن أو موظف عادي -> يحتاج موافقة مدير المطبخ أولاً
  const [insertReq] = await appPool.query(`
    INSERT INTO station_transfer_requests 
      (station_id, ingredient_id, quantity, coverage_summary, requested_by, status, notes)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)
  `, [stationId, ingredientId, quantity, coverage.coverageSummary, userId, notes || null]);

  const requestId = insertReq.insertId;

  // جلب اسم السكشن
  const [stRows] = await appPool.query(`SELECT station_name FROM pos_stations WHERE id = ?`, [stationId]);
  const stationName = stRows[0]?.station_name || 'السكشن';

  // إرسال إشعار فوري لمدير المطبخ والمدير العام
  await notifyAdminsAndManagers(
    'station_transfer_request',
    requestId,
    `📋 طلب صرف عهدة لسكشن ${stationName} بانتظار موافقتك`,
    `طلب الشيف سحب (${quantity} ${coverage.unit}) من (${coverage.ingredientName} - ${coverage.materialTypeLabel}) لسكشن (${stationName}).\nحساب التغطية:\n${coverage.coverageSummary}`
  );

  return {
    autoApproved: false,
    requestId,
    message: `تم رفع طلب الصرف بنجاح إلى مدير المطبخ لاعتماده.\n\n${coverage.coverageSummary}`,
    coverage
  };
}

/**
 * 7) اعتماد طلب الصرف من قبل مدير المطبخ
 */
async function approveStationTransfer(requestId, approvedBy) {
  const [rows] = await appPool.query(`SELECT * FROM station_transfer_requests WHERE id = ? FOR UPDATE`, [requestId]);
  if (!rows.length) throw new Error('الطلب غير موجود');
  const req = rows[0];
  if (req.status !== 'pending') throw new Error(`الطلب بالفعل بحالة: ${req.status}`);

  // تنفيذ التحويل الفعلي
  await transferToStation({
    stationId: req.station_id,
    ingredientId: req.ingredient_id,
    quantity: req.quantity,
    userId: approvedBy,
    notes: `موافقة مدير المطبخ على طلب #${requestId} - ${req.notes || ''}`
  });

  await appPool.query(`
    UPDATE station_transfer_requests 
    SET status = 'approved', approved_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [approvedBy, requestId]);

  // إشعار للشيف صاحب الطلب
  if (req.requested_by) {
    const { createNotification } = require('./notificationsController');
    await createNotification(
      req.requested_by,
      'station_transfer_approved',
      requestId,
      '✅ تمت الموافقة على طلب صرف العهدة',
      `وافق مدير المطبخ على صرف طلبك (${req.quantity}) لسكشنك بنجاح.`
    );
  }

  return { success: true, message: 'تمت الموافقة على الطلب وصرف العهدة للسكشن بنجاح.' };
}

/**
 * 8) رفض طلب الصرف
 */
async function rejectStationTransfer(requestId, rejectedBy, reason) {
  const [rows] = await appPool.query(`SELECT * FROM station_transfer_requests WHERE id = ?`, [requestId]);
  if (!rows.length) throw new Error('الطلب غير موجود');
  const req = rows[0];
  if (req.status !== 'pending') throw new Error(`الطلب بالفعل بحالة: ${req.status}`);

  await appPool.query(`
    UPDATE station_transfer_requests 
    SET status = 'rejected', approved_by = ?, notes = CONCAT(COALESCE(notes, ''), ' [سبب الرفض: ', ?, ']'), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [rejectedBy, reason || 'لم يحدد سبب', requestId]);

  if (req.requested_by) {
    const { createNotification } = require('./notificationsController');
    await createNotification(
      req.requested_by,
      'station_transfer_rejected',
      requestId,
      '❌ تم رفض طلب العهدة',
      `تم رفض طلب صرف العهدة من قبل مدير المطبخ. السبب: ${reason || 'لا يوجد'}`
    );
  }

  return { success: true, message: 'تم رفض الطلب.' };
}

/**
 * 9) عرض قائمة طلبات الصرف
 */
async function listStationTransferRequests(statusFilter = null) {
  let query = `
    SELECT 
      str.*,
      s.station_name, s.station_code,
      i.name AS ingredient_name, i.unit AS ingredient_unit,
      COALESCE(i.material_type, 'raw') AS material_type
    FROM station_transfer_requests str
    JOIN pos_stations s ON str.station_id = s.id
    JOIN ingredients i ON str.ingredient_id = i.id
  `;
  const params = [];
  if (statusFilter) {
    query += ` WHERE str.status = ?`;
    params.push(statusFilter);
  }
  query += ` ORDER BY str.created_at DESC LIMIT 100`;

  const [rows] = await appPool.query(query, params);
  return rows;
}

module.exports = {
  transferToStation,
  depleteOrderFromStation,
  deductWasteFromStation,
  getStationInventories,
  calculateYieldCoverage,
  requestStationTransfer,
  approveStationTransfer,
  rejectStationTransfer,
  listStationTransferRequests
};
