/**
 * ============================================================================
 * Kitchen Operations Controller - إدارة التحضير والباركود ومطابقة السكاشن
 * Commercial Kitchen Batch Prep, Portion Labels & Station Shift Reconciliation
 * ============================================================================
 */

const { appPool } = require('../database/appConnection');
const cacheService = require('./cacheService');

/**
 * دالة مساعدة لإرسال إشعارات لمدراء المطبخ والمدير العام
 */
async function notifyKitchenAdmins(type, refId, title, message) {
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
    console.warn('⚠️ [Kitchen Notification Warning]:', err.message);
  }
}

// ======================================================================
// 1) حساب مقادير التحضير المطلوبة قبل الإنتاج (Prep Calculator)
// ======================================================================
exports.calculatePrepPlan = async (req, res) => {
  try {
    const { recipe_id, planned_portions, portion_size = 1 } = req.body;
    const portions = parseInt(planned_portions) || 1;
    const size = parseFloat(portion_size) || 1;
    const totalYield = portions * size;

    if (!recipe_id) {
      return res.status(400).json({ status: 'error', message: 'يرجى اختيار الوصفة المراد تحضيرها' });
    }

    // جلب الوصفة
    const [recipes] = await appPool.query('SELECT * FROM recipes WHERE id = ?', [recipe_id]);
    if (!recipes.length) {
      return res.status(404).json({ status: 'error', message: 'الوصفة غير موجودة' });
    }
    const recipe = recipes[0];

    // جلب مكونات الوصفة المعيارية
    const [ingredients] = await appPool.query(`
      SELECT 
        ri.ingredient_id,
        ri.quantity AS standard_qty,
        i.unit AS standard_unit,
        i.name AS ingredient_name,
        i.unit AS stock_unit,
        i.stock_quantity AS current_stock
      FROM recipe_ingredients ri
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE ri.recipe_id = ?
    `, [recipe_id]);

    const basePortions = parseInt(recipe.portions) || 1;
    const multiplier = portions / basePortions;

    let hasShortage = false;
    const calculatedItems = ingredients.map(item => {
      const requiredQty = (parseFloat(item.standard_qty) || 0) * multiplier;
      const currentStock = parseFloat(item.current_stock) || 0;
      const isShort = currentStock < requiredQty;
      if (isShort) hasShortage = true;

      return {
        ingredientId: item.ingredient_id,
        name: item.ingredient_name,
        requiredQty: parseFloat(requiredQty.toFixed(3)),
        currentStock,
        unit: item.stock_unit || item.standard_unit,
        isShort,
        shortageQty: isShort ? parseFloat((requiredQty - currentStock).toFixed(3)) : 0
      };
    });

    res.json({
      status: 'success',
      data: {
        recipeName: recipe.item_name || recipe.name,
        plannedPortions: portions,
        portionSize: size,
        totalYield,
        unit: recipe.yield || 'علبة',
        hasShortage,
        items: calculatedItems
      }
    });
  } catch (err) {
    console.error('❌ خطأ في calculatePrepPlan:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================================
// 2) تأكيد إنتاج دفعة تحضير وتوليد الباركودات الفردية (Produce Batch & Labels)
// ======================================================================
exports.producePrepBatch = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      recipe_id,
      planned_portions,
      portion_size = 0.25,
      unit = 'علبة',
      shelf_life_days = 7,
      notes = ''
    } = req.body;

    const portions = parseInt(planned_portions);
    const size = parseFloat(portion_size);
    const totalYield = portions * size;
    const branchId = req.user?.branch_id || req.headers['x-branch-id'] || 1;
    const userId = req.user?.id || null;

    if (!recipe_id || isNaN(portions) || portions <= 0) {
      throw new Error('يرجى تحديد الوصفة وعدد البورشنات بشكل صحيح');
    }

    // جلب الوصفة
    const [recipes] = await connection.query('SELECT * FROM recipes WHERE id = ?', [recipe_id]);
    if (!recipes.length) throw new Error('الوصفة غير موجودة');
    const recipe = recipes[0];
    const recipeName = recipe.item_name || recipe.name;

    // جلب أو إنشاء المادة المصنعة الناتجة في ingredients
    let targetIngredientId;
    const [existingIng] = await connection.query(
      'SELECT id, stock_quantity FROM ingredients WHERE recipe_id = ? AND branch_id = ? LIMIT 1',
      [recipe_id, branchId]
    );

    if (existingIng.length > 0) {
      targetIngredientId = existingIng[0].id;
      // زيادة رصيد المادة المصنعة بالمخزن
      await connection.query(
        'UPDATE ingredients SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [portions, targetIngredientId]
      );
    } else {
      const [insertIng] = await connection.query(
        `INSERT INTO ingredients (name, unit, stock_quantity, material_type, recipe_id, branch_id)
         VALUES (?, ?, ?, 'manufactured', ?, ?)`,
        [recipeName, unit, portions, recipe_id, branchId]
      );
      targetIngredientId = insertIng.insertId;
    }

    // خصم المواد الأولية من المخزن
    const [recIngs] = await connection.query(
      'SELECT ingredient_id, quantity FROM recipe_ingredients WHERE recipe_id = ?',
      [recipe_id]
    );

    const basePortions = parseInt(recipe.portions) || 1;
    const multiplier = portions / basePortions;

    for (const raw of recIngs) {
      const reqQty = (parseFloat(raw.quantity) || 0) * multiplier;
      if (reqQty <= 0) continue;

      // فحص الرصيد مع قفل سطري
      const [stockRows] = await connection.query(
        'SELECT id, name, stock_quantity FROM ingredients WHERE id = ? FOR UPDATE',
        [raw.ingredient_id]
      );

      if (!stockRows.length || parseFloat(stockRows[0].stock_quantity) < reqQty) {
        throw new Error(`رصيد المادة الخام "${stockRows[0]?.name || raw.ingredient_id}" غير كافٍ لإتمام التحضير!`);
      }

      await connection.query(
        'UPDATE ingredients SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [reqQty, raw.ingredient_id]
      );

      // تسجيل حركة سحب
      await connection.query(
        `INSERT INTO transactions (ingredient_id, type, quantity, user_id, note, branch_id)
         VALUES (?, 'withdraw', ?, ?, ?, ?)`,
        [raw.ingredient_id, reqQty, userId, `استهلاك تحضير دفعة: ${recipeName} (${portions} ${unit})`, branchId]
      );
    }

    // توليد رقم دفعة فريد
    const batchNumber = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(shelf_life_days));

    // إدراج الدفعة في prep_batches
    const [batchResult] = await connection.query(
      `INSERT INTO prep_batches 
       (batch_number, recipe_id, ingredient_id, planned_portions, portion_size, total_yield, unit, prepared_by, branch_id, shelf_life_days, expiry_date, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [batchNumber, recipe_id, targetIngredientId, portions, size, totalYield, unit, userId, branchId, shelf_life_days, expiryDate, notes]
    );
    const batchId = batchResult.insertId;

    // توليد الملصقات الفردية للعلب في prep_batch_items
    const labels = [];
    for (let i = 1; i <= portions; i++) {
      const labelCode = `${batchNumber}-${String(i).padStart(3, '0')}`;
      await connection.query(
        `INSERT INTO prep_batch_items (batch_id, label_code, portion_number, portion_qty, status)
         VALUES (?, ?, ?, ?, 'in_stock')`,
        [batchId, labelCode, i, size]
      );

      labels.push({
        labelCode,
        portionNumber: i,
        portionQty: size,
        unit,
        recipeName,
        batchNumber,
        prepDate: new Date().toISOString().split('T')[0],
        expiryDate: expiryDate.toISOString().split('T')[0]
      });
    }

    // تسجيل حركة إيداع المادة المصنعة بالدفعة
    await connection.query(
      `INSERT INTO transactions (ingredient_id, type, quantity, user_id, note, branch_id)
       VALUES (?, 'deposit', ?, ?, ?, ?)`,
      [targetIngredientId, portions, userId, `إنتاج دفعة تحضيرية جاهزة #${batchNumber} (${portions} ${unit})`, branchId]
    );

    await connection.commit();

    cacheService.invalidate(['inventory', 'branches']);

    res.json({
      status: 'success',
      message: `تم تحضير الدفعة #${batchNumber} بنجاح (${portions} ${unit}) وتوليد ملصقات الباركود.`,
      data: {
        batchId,
        batchNumber,
        recipeName,
        portions,
        portionSize: size,
        unit,
        expiryDate: expiryDate.toISOString().split('T')[0],
        labels
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في producePrepBatch:', err);
    res.status(400).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ======================================================================
// 3) المسح السريع للباركود وإيداع العلبة بالسكشن (Scan Item to Station)
// ======================================================================
exports.scanItemToStation = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const { label_code, station_code, station_id } = req.body;
    const userId = req.user?.id || null;

    if (!label_code) {
      throw new Error('يرجى قراءة باركود العلبة أو الصنف أولاً');
    }

    // 1. جلب بيانات العلبة من prep_batch_items
    const [items] = await connection.query(`
      SELECT pbi.*, pb.ingredient_id, pb.unit, pb.recipe_id, pb.batch_number, i.name AS ingredient_name
      FROM prep_batch_items pbi
      JOIN prep_batches pb ON pbi.batch_id = pb.id
      JOIN ingredients i ON pb.ingredient_id = i.id
      WHERE pbi.label_code = ? FOR UPDATE
    `, [label_code.trim()]);

    if (!items.length) {
      throw new Error(`كود الباركود [ ${label_code} ] غير مسجل بالنظام`);
    }

    const item = items[0];
    if (item.status === 'consumed') {
      throw new Error(`هذه العلبة [ ${label_code} ] مستهلكة بالكامل سابقاً!`);
    }
    if (item.status === 'at_station') {
      throw new Error(`هذه العلبة موجودة بالفعل في عهدة سكشن #${item.current_station_id}`);
    }

    // 2. تحديد المحطة / السكشن المستهدف (بالكود أو بالـ ID)
    let targetStation;
    if (station_code) {
      const [stRows] = await connection.query('SELECT * FROM pos_stations WHERE station_code = ?', [station_code.trim()]);
      targetStation = stRows[0];
    } else if (station_id) {
      const [stRows] = await connection.query('SELECT * FROM pos_stations WHERE id = ?', [station_id]);
      targetStation = stRows[0];
    }

    if (!targetStation) {
      throw new Error('يرجى تحديد أو مسح باركود السكشن المستلم');
    }

    // 3. خصم العلبة من رصيد المخزن الرئيسي العام
    await connection.query(
      'UPDATE ingredients SET stock_quantity = GREATEST(0, stock_quantity - 1) WHERE id = ?',
      [item.ingredient_id]
    );

    // 4. تحديث حالة العلبة لتصبح في السكشن
    await connection.query(
      `UPDATE prep_batch_items SET 
        status = 'at_station',
        current_station_id = ?,
        transferred_at = NOW(),
        transferred_by = ?
       WHERE id = ?`,
      [targetStation.id, userId, item.id]
    );

    // 5. إضافة كمية البورشن إلى عهدة السكشن في station_inventory
    const qtyToAdd = parseFloat(item.portion_qty) || 1;
    await connection.query(`
      INSERT INTO station_inventory (station_id, ingredient_id, quantity, last_assigned_user_id, last_transferred_at)
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE 
        quantity = quantity + VALUES(quantity),
        last_assigned_user_id = VALUES(last_assigned_user_id),
        last_transferred_at = NOW()
    `, [targetStation.id, item.ingredient_id, qtyToAdd, userId]);

    // 6. تسجيل حركة تحويل لسكشن المطبخ في station_stock_moves
    await connection.query(`
      INSERT INTO station_stock_moves (station_id, ingredient_id, user_id, type, quantity, notes)
      VALUES (?, ?, ?, 'transfer_in', ?, ?)
    `, [
      targetStation.id,
      item.ingredient_id,
      userId,
      qtyToAdd,
      `مسح باركود [${item.label_code}] من دفعة #${item.batch_number}`
    ]);

    await connection.commit();

    // جلب الرصيد الإجمالي المحدث للسكشن
    const [currStock] = await appPool.query(
      'SELECT quantity FROM station_inventory WHERE station_id = ? AND ingredient_id = ?',
      [targetStation.id, item.ingredient_id]
    );

    res.json({
      status: 'success',
      message: `✅ تم مسح العلبة بنجاح وإيداع (${qtyToAdd} ${item.unit}) في رصيد [ ${targetStation.station_name} ]`,
      data: {
        labelCode: item.label_code,
        ingredientName: item.ingredient_name,
        portionQty: qtyToAdd,
        stationName: targetStation.station_name,
        newStationBalance: parseFloat(currStock[0]?.quantity || 0)
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في scanItemToStation:', err);
    res.status(400).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ======================================================================
// 4) كشف المطابقة والجرد بنهاية الشفت ومبيعات الويترية (Reconciliation Report)
// ======================================================================
exports.getStationAuditSummary = async (req, res) => {
  try {
    const { station_id, date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const stationId = parseInt(station_id);

    if (!stationId) {
      return res.status(400).json({ status: 'error', message: 'رقم السكشن مطلوب' });
    }

    // جلب معلومات السكشن
    const [stRows] = await appPool.query('SELECT * FROM pos_stations WHERE id = ?', [stationId]);
    if (!stRows.length) return res.status(404).json({ status: 'error', message: 'السكشن غير موجود' });
    const station = stRows[0];

    // جلب جميع المواد المسجلة أو المسحوبة لهذا السكشن
    const [ingredients] = await appPool.query(`
      SELECT DISTINCT i.id, i.name, i.unit, COALESCE(si.quantity, 0) AS current_stock
      FROM ingredients i
      LEFT JOIN station_inventory si ON i.id = si.ingredient_id AND si.station_id = ?
      WHERE si.station_id = ? OR i.id IN (
        SELECT DISTINCT ingredient_id FROM station_stock_moves 
        WHERE station_id = ? AND DATE(created_at) = ?
      )
    `, [stationId, stationId, stationId, targetDate]);

    const auditLines = [];

    for (const ing of ingredients) {
      // 1. الكمية المحولة / المسحوبة اليوم (Transferred In)
      const [transIn] = await appPool.query(`
        SELECT COALESCE(SUM(quantity), 0) AS total_in
        FROM station_stock_moves
        WHERE station_id = ? AND ingredient_id = ? AND type = 'transfer_in' AND DATE(created_at) = ?
      `, [stationId, ing.id, targetDate]);

      // 2. الكمية المستهلكة من مبيعات الويترية (Consumed via POS)
      const [consumed] = await appPool.query(`
        SELECT COALESCE(SUM(quantity), 0) AS total_consumed
        FROM station_stock_moves
        WHERE station_id = ? AND ingredient_id = ? AND type = 'order_consumption' AND DATE(created_at) = ?
      `, [stationId, ing.id, targetDate]);

      // 3. الهدر المسجل (Waste)
      const [waste] = await appPool.query(`
        SELECT COALESCE(SUM(quantity), 0) AS total_waste
        FROM station_stock_moves
        WHERE station_id = ? AND ingredient_id = ? AND type = 'waste_loss' AND DATE(created_at) = ?
      `, [stationId, ing.id, targetDate]);

      // 4. تفصيل مبيعات كل ويتر لهذا الصنف بالذات (Waiter Breakdown)
      const [waiterRows] = await appPool.query(`
        SELECT 
          COALESCE(o.waiter_name, 'ويتر غير مسمى') AS waiter_name,
          oi.item_name,
          SUM(oi.quantity) AS orders_count,
          SUM(sm.quantity) AS total_consumed_qty
        FROM station_stock_moves sm
        JOIN pos_orders o ON sm.ref_order_id = o.id
        JOIN pos_order_items oi ON o.id = oi.order_id
        WHERE sm.station_id = ? AND sm.ingredient_id = ? AND sm.type = 'order_consumption' AND DATE(sm.created_at) = ?
        GROUP BY o.waiter_name, oi.item_name
        ORDER BY total_consumed_qty DESC
      `, [stationId, ing.id, targetDate]);

      const transferredInQty = parseFloat(transIn[0]?.total_in) || 0;
      const consumedQty = parseFloat(consumed[0]?.total_consumed) || 0;
      const wasteQty = parseFloat(waste[0]?.total_waste) || 0;
      const currentStock = parseFloat(ing.current_stock) || 0;

      // الرصيد الافتتاحي التقريبي لليوم = (الرصيد الحالي + المستهلك + الهدر - المحول)
      const openingQty = Math.max(0, parseFloat((currentStock + consumedQty + wasteQty - transferredInQty).toFixed(3)));
      const theoreticalQty = parseFloat((openingQty + transferredInQty - consumedQty - wasteQty).toFixed(3));

      auditLines.push({
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        openingQty,
        transferredInQty,
        consumedQty,
        wasteQty,
        theoreticalQty,
        actualQty: theoreticalQty, // قيمة افتراضية لتسهيل الإدخال على الشيف
        isMatched: true,
        waiterBreakdown: waiterRows.map(w => ({
          waiterName: w.waiter_name,
          itemName: w.item_name,
          ordersCount: parseFloat(w.orders_count),
          consumedQty: parseFloat(w.total_consumed_qty)
        }))
      });
    }

    res.json({
      status: 'success',
      data: {
        stationId: station.id,
        stationCode: station.station_code,
        stationName: station.station_name,
        auditDate: targetDate,
        items: auditLines
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getStationAuditSummary:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};

// ======================================================================
// 5) حفظ وإرسال كشف المطابقة والجرد (Submit Station Audit)
// ======================================================================
exports.submitStationAudit = async (req, res) => {
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      station_id,
      audit_date,
      shift_name = 'الشفت المسائي',
      lines = []
    } = req.body;

    const stationId = parseInt(station_id);
    const userId = req.user?.id || null;
    const userRole = req.user?.role || 'employee';

    if (!stationId || !lines.length) {
      throw new Error('يرجى تحديد السكشن وبنود المطابقة');
    }

    const [stations] = await connection.query('SELECT station_name, branch_id FROM pos_stations WHERE id = ?', [stationId]);
    const station = stations[0];

    // تحديد ما إذا كان هناك فروقات بين الفعلي والمفروض
    let hasVariance = false;
    let varianceDetails = [];

    // إنشاء سجل الجلسة الرئيسية
    const [auditResult] = await connection.query(
      `INSERT INTO station_audits (station_id, branch_id, audit_date, shift_name, chef_user_id, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [stationId, station.branch_id || 1, audit_date || new Date(), shift_name, userId]
    );
    const auditId = auditResult.insertId;

    // إدراج بنود المطابقة
    for (const line of lines) {
      const theo = parseFloat(line.theoretical_qty) || 0;
      const act = parseFloat(line.actual_qty) !== undefined ? parseFloat(line.actual_qty) : theo;
      const diff = parseFloat((act - theo).toFixed(3));
      const isMatched = Math.abs(diff) < 0.001 ? 1 : 0;

      if (!isMatched) {
        hasVariance = true;
        varianceDetails.push(`${line.name || 'مادة'}: الفارق (${diff > 0 ? '+' : ''}${diff}) [التبرير: ${line.chef_explanation || 'بدون تبرير'}]`);
      }

      await connection.query(
        `INSERT INTO station_audit_lines 
         (audit_id, ingredient_id, opening_qty, transferred_in_qty, consumed_qty, waste_qty, theoretical_qty, actual_qty, variance_qty, is_matched, chef_explanation, waiter_breakdown)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          auditId,
          line.ingredient_id || line.ingredientId,
          parseFloat(line.opening_qty) || 0,
          parseFloat(line.transferred_in_qty) || 0,
          parseFloat(line.consumed_qty) || 0,
          parseFloat(line.waste_qty) || 0,
          theo,
          act,
          diff,
          isMatched,
          line.chef_explanation || null,
          JSON.stringify(line.waiterBreakdown || [])
        ]
      );

      // تحديث رصيد السكشن إلى الرصيد الفعلي المعدل
      await connection.query(
        'UPDATE station_inventory SET quantity = ? WHERE station_id = ? AND ingredient_id = ?',
        [act, stationId, line.ingredient_id || line.ingredientId]
      );
    }

    const finalStatus = hasVariance ? 'has_variance' : 'matched';
    await connection.query('UPDATE station_audits SET status = ? WHERE id = ?', [finalStatus, auditId]);

    await connection.commit();

    // إرسال إشعار فوري لمدير المطبخ في حال وجود فروقات
    if (hasVariance) {
      await notifyKitchenAdmins(
        'station_audit_variance',
        auditId,
        `⚠️ فروقات جرد في سكشن: ${station.station_name}`,
        `قام الشيف بإنهاء جرد الشفت وتوجد فروقات في (${varianceDetails.length}) أصناف: ${varianceDetails.join(' | ')}`
      );
    }

    res.json({
      status: 'success',
      message: hasVariance 
        ? '⚠️ تم حفظ الجرد مع تسجيل الفروقات وإرسال تقرير فوري للإدارة للمراجعة.' 
        : '✅ تم تأكيد مطابقة الجرد بنجاح بنسبة 100% وإغلاق الشفت.',
      data: {
        auditId,
        status: finalStatus,
        hasVariance
      }
    });
  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في submitStationAudit:', err);
    res.status(400).json({ status: 'error', message: err.message });
  } finally {
    connection.release();
  }
};

// ======================================================================
// 6) جلب سجل جرد السكاشن لمدير المطبخ (List Audits)
// ======================================================================
exports.listStationAudits = async (req, res) => {
  try {
    const { branchId, stationId } = req.query;
    let filter = "WHERE 1=1";
    const params = [];

    if (stationId) {
      filter += " AND sa.station_id = ?";
      params.push(stationId);
    }
    if (branchId && branchId !== 'all') {
      filter += " AND sa.branch_id = ?";
      params.push(branchId);
    }

    const [rows] = await appPool.query(`
      SELECT 
        sa.*,
        s.station_name,
        s.station_code,
        COUNT(sal.id) AS total_items,
        SUM(CASE WHEN sal.is_matched = 0 THEN 1 ELSE 0 END) AS variance_items_count
      FROM station_audits sa
      JOIN pos_stations s ON sa.station_id = s.id
      LEFT JOIN station_audit_lines sal ON sa.id = sal.audit_id
      ${filter}
      GROUP BY sa.id
      ORDER BY sa.created_at DESC
      LIMIT 50
    `, params);

    res.json({ status: 'success', data: rows });
  } catch (err) {
    console.error('❌ خطأ في listStationAudits:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
};
