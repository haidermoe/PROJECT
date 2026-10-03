/**
 * ======================================================
 * Recipes Controller - معالجة بيانات الوصفات
 * ======================================================
 * 
 * يستخدم اتصال معزول لقاعدة البيانات الرئيسية
 */

// استيراد اتصال قاعدة البيانات الرئيسية (معزول)
const { appPool } = require('../database/appConnection');
// استيراد اتصال قاعدة بيانات المصادقة (للمستخدمين)
const { authPool } = require('../database/authConnection');
// استيراد مكتبة QR Code
const QRCode = require('qrcode');

// ===============================
//      دالة مساعدة: التأكد من وجود الأعمدة المطلوبة
// ===============================
async function ensureRecipeColumnsExist(connection) {
  try {
    const dbName = process.env.APP_DB_NAME || 'kitchen_inventory';
    const tableName = 'recipes';
    
    // محاولة إزالة Foreign Key constraint من created_by إذا كان موجوداً
    // لأن المستخدمين موجودون في auth_db (قاعدة بيانات معزولة)
    try {
      const [constraints] = await connection.execute(
        `SELECT CONSTRAINT_NAME 
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = ? 
           AND TABLE_NAME = 'recipes' 
           AND COLUMN_NAME = 'created_by'
           AND REFERENCED_TABLE_NAME = 'users'`,
        [dbName]
      );
      
      if (constraints.length > 0) {
        const constraintName = constraints[0].CONSTRAINT_NAME;
        console.log(`⚠️ إزالة Foreign Key constraint: ${constraintName}`);
        await connection.execute(`ALTER TABLE recipes DROP FOREIGN KEY ${constraintName}`);
        console.log('✅ تم إزالة Foreign Key constraint من recipes.created_by بنجاح');
      }
    } catch (fkErr) {
      // تجاهل الخطأ إذا كان constraint غير موجود
      if (fkErr.code !== 'ER_CANT_DROP_FIELD_OR_KEY' && fkErr.code !== 'ER_BAD_FIELD_ERROR') {
        console.log('⚠️ تحذير: لم يتم إزالة Foreign Key constraint:', fkErr.message);
      }
    }
    
    // قائمة الأعمدة المطلوبة
    const requiredColumns = [
      { name: 'item_name', sql: 'ALTER TABLE recipes ADD COLUMN item_name VARCHAR(150) AFTER id' },
      { name: 'yield', sql: 'ALTER TABLE recipes ADD COLUMN yield VARCHAR(50) AFTER item_name' },
      { name: 'portions', sql: 'ALTER TABLE recipes ADD COLUMN portions INT AFTER yield' },
      { name: 'shelf_life', sql: 'ALTER TABLE recipes ADD COLUMN shelf_life VARCHAR(100) AFTER portions' },
      { name: 'procedure', sql: 'ALTER TABLE recipes ADD COLUMN `procedure` TEXT AFTER shelf_life' },
      { name: 'reference', sql: 'ALTER TABLE recipes ADD COLUMN reference VARCHAR(50) AFTER `procedure`' },
      { name: 'version', sql: 'ALTER TABLE recipes ADD COLUMN version VARCHAR(20) DEFAULT \'001\' AFTER reference' },
      { name: 'edition', sql: 'ALTER TABLE recipes ADD COLUMN edition INT DEFAULT 1 AFTER version' },
      { name: 'status', sql: 'ALTER TABLE recipes ADD COLUMN status ENUM(\'draft\', \'active\', \'pending_approval\') DEFAULT \'active\' AFTER edition' }
    ];

    for (const column of requiredColumns) {
      try {
        const [rows] = await connection.execute(
          `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [dbName, tableName, column.name]
        );
        
        if (rows[0].count === 0) {
          console.log(`⚠️ العمود ${column.name} غير موجود، جاري إضافته...`);
          await connection.execute(column.sql);
          console.log(`✅ تم إضافة العمود ${column.name} بنجاح`);
        }
      } catch (colErr) {
        // تجاهل الأخطاء إذا كان العمود موجوداً بالفعل
        if (colErr.code !== 'ER_DUP_FIELDNAME') {
          console.error(`❌ خطأ في التحقق من العمود ${column.name}:`, colErr.message);
        }
      }
    }

    // إنشاء جدول recipe_ingredients_new إذا لم يكن موجوداً
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS recipe_ingredients_new (
          id INT AUTO_INCREMENT PRIMARY KEY,
          recipe_id INT NOT NULL,
          ingredient_name VARCHAR(200) NOT NULL,
          quantity VARCHAR(100) NOT NULL,
          display_order INT DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
          INDEX idx_recipe_id (recipe_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    } catch (tableErr) {
      // تجاهل الخطأ إذا كان الجدول موجوداً بالفعل
      if (tableErr.code !== 'ER_TABLE_EXISTS_ERROR') {
        console.error('❌ خطأ في إنشاء جدول recipe_ingredients_new:', tableErr.message);
      }
    }
  } catch (err) {
    console.error('❌ خطأ في ensureRecipeColumnsExist:', err.message);
    // لا نرمي الخطأ، نستمر في المحاولة
  }
}

// ===============================
//      جلب جميع الوصفات (مع الصلاحيات)
// ===============================
exports.getRecipes = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.id;

    // بناء الاستعلام مع حساب عدد المكونات من الجدول الجديد
    // ⚠️ procedure كلمة محجوزة في MySQL، يجب استخدام backticks
    const backtick = String.fromCharCode(96);
    const procedureCol = 'r.' + backtick + 'procedure' + backtick;
    let query = 'SELECT r.id, r.item_name, r.name, r.yield, r.portions, r.shelf_life, ' + procedureCol + ', ' +
                'r.reference, r.version, r.edition, r.created_by, r.status, r.created_at, ' +
                '(SELECT COUNT(*) FROM recipe_ingredients_new WHERE recipe_id = r.id) AS ingredient_count ' +
                'FROM recipes r';

    // إذا كان موظف عادي، يرى فقط الوصفات المسموح له برؤيتها
    if (userRole === 'employee') {
      query += `
        LEFT JOIN recipe_employee_permissions rep ON r.id = rep.recipe_id AND rep.employee_id = ?
        WHERE (r.visible_to_employees = 1 OR rep.can_view = 1)
        AND r.status = 'active'
      `;
    } else {
      // المدير والشيف يروا كل الوصفات
      query += ` WHERE 1=1 `;
    }

    query += ` ORDER BY r.id DESC `;

    const [rows] = userRole === 'employee' 
      ? await appPool.query(query, [userId])
      : await appPool.query(query);

    res.json({ status: "success", data: rows });
  } catch (err) {
    res.json({ status: "error", message: err.message });
  }
};

// ===============================
//      جلب وصفة واحدة
// ===============================
exports.getRecipe = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔵 getRecipe: جلب الوصفة رقم', id);
    
    // ⚠️ procedure كلمة محجوزة في MySQL، يجب استخدام backticks
    const backtick = String.fromCharCode(96);
    const procedureCol = backtick + 'procedure' + backtick;
    const selectQuery = 'SELECT id, item_name, name, yield, portions, shelf_life, ' + procedureCol + 
                        ', reference, version, edition, created_by, status, created_at ' +
                        'FROM recipes WHERE id = ?';
    const [rows] = await appPool.query(selectQuery, [id]);
    
    if (rows.length === 0) {
      console.log('❌ getRecipe: الوصفة غير موجودة');
      return res.json({ status: "error", message: "الوصفة غير موجودة" });
    }

    const recipe = rows[0];
    console.log('✅ getRecipe: تم جلب الوصفة:', recipe.item_name || recipe.name);

    // جلب المكونات من الجدول الجديد أو القديم
    let ingredients = [];
    try {
      const [ingredientsRows] = await appPool.query(
        `SELECT ingredient_name, quantity, display_order 
         FROM recipe_ingredients_new 
         WHERE recipe_id = ? 
         ORDER BY display_order ASC, id ASC`,
        [id]
      );
      if (ingredientsRows.length > 0) {
        ingredients = ingredientsRows.map(ing => {
          // استخراج الكمية والوحدة
          const parts = (ing.quantity || '').toString().trim().split(' ');
          const qty = parts[0] || '0';
          const unit = parts.slice(1).join(' ') || '';
          return {
            ingredient_name: ing.ingredient_name,
            quantity: qty,
            unit: unit,
            display_order: ing.display_order
          };
        });
        console.log('✅ getRecipe: تم جلب', ingredients.length, 'مكون من الجدول الجديد');
      } else {
        const [oldIngredients] = await appPool.query(`
          SELECT ri.ingredient_id, i.name AS ingredient_name, ri.quantity, i.unit
          FROM recipe_ingredients ri
          JOIN ingredients i ON ri.ingredient_id = i.id
          WHERE ri.recipe_id = ?
        `, [id]);
        ingredients = oldIngredients.map((ing, idx) => ({
          ingredient_id: ing.ingredient_id,
          ingredient_name: ing.ingredient_name,
          quantity: ing.quantity,
          unit: ing.unit || '',
          display_order: idx + 1
        }));
        console.log('✅ getRecipe: تم جلب', ingredients.length, 'مكون من recipe_ingredients');
      }
    } catch (ingErr) {
      console.error('❌ getRecipe: خطأ في جلب المكونات:', ingErr.message);
    }

    res.json({ 
      status: "success", 
      data: {
        recipe: recipe,
        ingredients: ingredients
      }
    });
  } catch (err) {
    console.error('❌ getRecipe: خطأ:', err);
    res.status(500).json({ status: "error", message: err.message });
  }
};

// ===============================
//      KPI للوصفات
// ===============================
exports.getKPI = async (req, res) => {
  try {
    const [[total]] = await appPool.query("SELECT COUNT(*) AS total_recipes FROM recipes");
    const [[active]] = await appPool.query("SELECT COUNT(*) AS active_recipes FROM recipes WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
    const [[today]] = await appPool.query("SELECT COUNT(*) AS today_recipes FROM recipes WHERE DATE(created_at) = CURDATE()");
    
    // متوسط التكلفة (سيتم حسابه لاحقاً عند إضافة التكلفة)
    const avgCost = 0;

    res.json({
      status: "success",
      data: {
        total_recipes: total.total_recipes || 0,
        active_recipes: active.active_recipes || 0,
        today_recipes: today.today_recipes || 0,
        avg_cost: avgCost
      }
    });
  } catch (err) {
    res.json({ status: "error", message: err.message });
  }
};

// ===============================
//      إضافة وصفة (Standard Recipe Template)
// ===============================
exports.addRecipe = async (req, res) => {
  try {
    console.log('🔵 addRecipe: بدء إضافة وصفة جديدة');
    console.log('🔵 addRecipe: req.user =', req.user);
    
    const { 
      item_name, 
      yield, 
      portions, 
      shelf_life, 
      procedure, 
      reference, 
      version, 
      edition,
      ingredients 
    } = req.body;
    
    console.log('🔵 addRecipe: البيانات المستلمة:', {
      item_name,
      yield,
      portions,
      shelf_life,
      procedure_length: procedure?.length,
      reference,
      version,
      edition,
      ingredients_count: ingredients?.length
    });
    
    const userRole = req.user?.role;
    const userId = req.user?.id;

    console.log('🔵 addRecipe: المستخدم:', userId, 'الرتبة:', userRole);

    // فقط المدير والشيف يمكنهم إضافة وصفات
    if (userRole !== 'admin' && userRole !== 'kitchen_manager') {
      console.log('❌ addRecipe: المستخدم ليس لديه صلاحية');
      return res.status(403).json({ status: "error", message: "ليس لديك صلاحية لإضافة وصفات" });
    }

    // التحقق من الحقول المطلوبة
    if (!item_name || !yield || !procedure) {
      console.log('❌ addRecipe: الحقول المطلوبة مفقودة');
      return res.status(400).json({ 
        status: "error", 
        message: "الحقول المطلوبة: اسم الوصفة (item_name), Yield, و خطوات التحضير (procedure)" 
      });
    }

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      console.log('❌ addRecipe: لا توجد مكونات');
      return res.status(400).json({ 
        status: "error", 
        message: "يجب إضافة مكون واحد على الأقل" 
      });
    }

    console.log('🔵 addRecipe: جاري الاتصال بقاعدة البيانات...');
    const connection = await appPool.getConnection();
    
    try {
      console.log('🔵 addRecipe: بدء Transaction...');
      await connection.beginTransaction();

      // التحقق من وجود الأعمدة المطلوبة وإضافتها إذا لم تكن موجودة
      await ensureRecipeColumnsExist(connection);

      // إدراج الوصفة
      // ملاحظة: نستخدم name أيضاً للتوافق مع النظام القديم
      // ⚠️ مهم: procedure كلمة محجوزة في MySQL، يجب استخدام backticks
      // استخدام String.fromCharCode لضمان ظهور backticks بشكل صحيح
      const backtick = String.fromCharCode(96);
      const procedureCol = backtick + 'procedure' + backtick;
      const insertQuery = 'INSERT INTO recipes (' +
        'item_name, name, yield, portions, shelf_life, ' + procedureCol + ', ' +
        'reference, version, edition, created_by, status' +
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
      
      // ⚠️ مهم: userId يأتي من auth_db (قاعدة بيانات معزولة)
      // لا يمكن استخدام Foreign Key constraint لأن المستخدمين في قاعدة بيانات مختلفة
      // لذلك نستخدم userId مباشرة بدون constraint
      // إذا كان userId غير موجود في kitchen_inventory.users، نستخدم NULL
      const finalUserId = userId || null;
      
      console.log('🔵 addRecipe: محاولة إدراج الوصفة مع created_by:', finalUserId);
      console.log('🔵 addRecipe: الاستعلام:', insertQuery);
      
      const [result] = await connection.execute(insertQuery,
        [
          item_name,
          item_name, // name للتوافق مع النظام القديم
          yield || null,
          portions || null,
          shelf_life || null,
          procedure,
          reference || null,
          version || '001',
          edition || 1,
          finalUserId, // قد يكون NULL إذا كان المستخدم غير موجود في kitchen_inventory
          'active'
        ]
      );

      const recipeId = result.insertId;
      console.log('✅ addRecipe: تم إدراج الوصفة بنجاح، ID:', recipeId);

      // إدراج المكونات
      console.log('🔵 addRecipe: جاري إدراج', ingredients.length, 'مكون...');
      for (const ingredient of ingredients) {
        await connection.execute(
          `INSERT INTO recipe_ingredients_new 
           (recipe_id, ingredient_name, quantity, display_order) 
           VALUES (?, ?, ?, ?)`,
          [
            recipeId,
            ingredient.ingredient_name,
            ingredient.quantity,
            ingredient.display_order || 0
          ]
        );
      }
      console.log('✅ addRecipe: تم إدراج جميع المكونات بنجاح');

      // إذا كانت الوصفة مصنفة كوصفة تحضير مسبق لمادة مصنعة
      if (req.body.is_sub_recipe) {
        const [existingIng] = await connection.query("SELECT id FROM ingredients WHERE name = ?", [item_name]);
        if (existingIng.length) {
          await connection.query(
            "UPDATE ingredients SET material_type = 'manufactured', recipe_id = ? WHERE id = ?",
            [recipeId, existingIng[0].id]
          );
        } else {
          await connection.query(
            "INSERT INTO ingredients (name, unit, stock_quantity, material_type, recipe_id) VALUES (?, 'وحدة', 0, 'manufactured', ?)",
            [item_name, recipeId]
          );
        }
        console.log('🥫 addRecipe: تم ربط الوصفة بمادة مصنعة في المخزن بنجاح');
      }

      await connection.commit();
      console.log('✅ addRecipe: تم commit Transaction بنجاح');

      console.log('✅ addRecipe: تم إضافة الوصفة بنجاح:', recipeId);

      res.json({ 
        status: "success", 
        message: "تم إضافة الوصفة بنجاح",
        data: { id: recipeId }
      });
    } catch (dbErr) {
      await connection.rollback();
      console.error('❌ addRecipe: خطأ في قاعدة البيانات:', dbErr);
      console.error('❌ تفاصيل الخطأ:', dbErr.message);
      console.error('❌ SQL State:', dbErr.sqlState);
      console.error('❌ Error Code:', dbErr.code);
      throw dbErr; // نرمي الخطأ للـ catch الخارجي
    } finally {
      connection.release();
      console.log('🔵 addRecipe: تم إغلاق الاتصال');
    }
  } catch (err) {
    console.error('❌ addRecipe: خطأ عام:', err);
    console.error('❌ تفاصيل الخطأ:', err.message);
    console.error('❌ SQL State:', err.sqlState);
    console.error('❌ Error Code:', err.code);
    console.error('❌ Stack:', err.stack);
    
    // رسالة خطأ أوضح للمستخدم
    let errorMessage = err.message;
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      errorMessage = 'خطأ في قاعدة البيانات: Foreign Key constraint. يرجى التحقق من إعدادات قاعدة البيانات.';
    } else if (err.code === 'ER_PARSE_ERROR') {
      errorMessage = 'خطأ في SQL: ' + err.message;
    } else if (err.code === 'ER_DUP_ENTRY') {
      errorMessage = 'الوصفة موجودة بالفعل';
    }
    
    res.status(500).json({ 
      status: "error", 
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ===============================
//      تعديل وصفة (مع نظام الموافقات)
// ===============================
exports.editRecipe = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    item_name,
    yield: recipeYield,
    portions,
    shelf_life,
    reference,
    version,
    edition,
    procedure,
    description,
    visible_to_employees,
    ingredients,
    is_sub_recipe
  } = req.body;

  const userRole = req.user?.role;
  const userId = req.user?.id;

  const finalName = item_name || name;
  if (!finalName) {
    return res.status(400).json({ status: "error", message: "اسم الوصفة مطلوب" });
  }

  // المدير العام والمدراء ومدراء المطبخ يمكنهم التعديل المباشر
  const connection = await appPool.getConnection();
  try {
    await connection.beginTransaction();

    const backtick = String.fromCharCode(96);
    const procedureCol = backtick + 'procedure' + backtick;

    const updateQuery = `
      UPDATE recipes SET 
        name = COALESCE(?, name),
        item_name = COALESCE(?, item_name),
        yield = COALESCE(?, yield),
        portions = COALESCE(?, portions),
        shelf_life = COALESCE(?, shelf_life),
        reference = COALESCE(?, reference),
        version = COALESCE(?, version),
        edition = COALESCE(?, edition),
        ${procedureCol} = COALESCE(?, ${procedureCol}),
        description = COALESCE(?, description),
        visible_to_employees = COALESCE(?, visible_to_employees)
      WHERE id = ?
    `;

    await connection.query(updateQuery, [
      finalName,
      finalName,
      recipeYield || null,
      portions ? parseInt(portions) : null,
      shelf_life || null,
      reference || null,
      version || '001',
      edition ? parseInt(edition) : 1,
      procedure || null,
      description || null,
      visible_to_employees !== undefined ? (visible_to_employees ? 1 : 0) : null,
      id
    ]);

    // إذا تم تمرير مكونات جديدة لتحديث كرت الوصفة
    if (Array.isArray(ingredients) && ingredients.length > 0) {
      await connection.query('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [id]);
      await connection.query('DELETE FROM recipe_ingredients_new WHERE recipe_id = ?', [id]);

      for (let idx = 0; idx < ingredients.length; idx++) {
        const ing = ingredients[idx];
        const ingName = (ing.ingredient_name || ing.name || '').trim();
        const ingQty = parseFloat(ing.quantity) || 0;
        const ingUnit = (ing.unit || 'وحدة').trim();

        if (!ingName || ingQty <= 0) continue;

        // البحث عن المادة في المخزن أو إضافتها تلقائياً
        const [ingRows] = await connection.query('SELECT id FROM ingredients WHERE name = ?', [ingName]);
        let ingId;
        if (ingRows.length > 0) {
          ingId = ingRows[0].id;
        } else {
          const [newIngRes] = await connection.query(
            'INSERT INTO ingredients (name, unit, stock_quantity) VALUES (?, ?, 0)',
            [ingName, ingUnit]
          );
          ingId = newIngRes.insertId;
        }

        // إدراج في recipe_ingredients للخصم الآلي للسكاشن
        await connection.query(
          'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES (?, ?, ?)',
          [id, ingId, ingQty]
        );

        // إدراج في recipe_ingredients_new للعرض والتوافقية
        await connection.query(
          'INSERT INTO recipe_ingredients_new (recipe_id, ingredient_name, quantity, display_order) VALUES (?, ?, ?, ?)',
          [id, ingName, `${ingQty} ${ingUnit}`, idx + 1]
        );
      }
    }

    // إذا كانت وصفة تحضير مسبق لمادة مصنعة
    if (is_sub_recipe) {
      const [existingIng] = await connection.query("SELECT id FROM ingredients WHERE name = ?", [finalName]);
      if (existingIng.length) {
        await connection.query(
          "UPDATE ingredients SET material_type = 'manufactured', recipe_id = ? WHERE id = ?",
          [id, existingIng[0].id]
        );
      } else {
        await connection.query(
          "INSERT INTO ingredients (name, unit, stock_quantity, material_type, recipe_id) VALUES (?, 'وحدة', 0, 'manufactured', ?)",
          [finalName, id]
        );
      }
    }

    await connection.commit();
    return res.json({ status: "success", message: "تم تحديث كرت الوصفة ومقاديرها بنجاح" });

  } catch (err) {
    await connection.rollback();
    console.error('❌ خطأ في editRecipe:', err);
    return res.status(500).json({ status: "error", message: err.message });
  } finally {
    connection.release();
  }
};

// ===============================
//      حذف وصفة (فقط المدير)
// ===============================
exports.deleteRecipe = async (req, res) => {
  const { id } = req.params;
  const userRole = req.user?.role;

  // فقط المدير يمكنه الحذف
  if (userRole !== 'admin') {
    return res.json({ status: "error", message: "ليس لديك صلاحية لحذف الوصفات" });
  }

  try {
    await appPool.query("DELETE FROM recipes WHERE id = ?", [id]);
    res.json({ status: "success", message: "تم حذف الوصفة بنجاح" });
  } catch (err) {
    res.json({ status: "error", message: err.message });
  }
};

// ===============================
//      الوصفات الشائعة
// ===============================
exports.getPopularRecipes = async (req, res) => {
  try {
    // ⚠️ procedure كلمة محجوزة في MySQL، يجب استخدام backticks
    const backtick = String.fromCharCode(96);
    const procedureCol = 'r.' + backtick + 'procedure' + backtick;
    const query = 'SELECT r.id, r.item_name, r.name, r.yield, r.portions, r.shelf_life, ' + procedureCol + 
                  ', r.reference, r.version, r.edition, r.created_by, r.status, r.created_at, ' +
                  'COUNT(ri.ingredient_id) AS ingredient_count ' +
                  'FROM recipes r ' +
                  'LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id ' +
                  'GROUP BY r.id ' +
                  'ORDER BY r.created_at DESC ' +
                  'LIMIT 5';
    const [rows] = await appPool.query(query);
    res.json({ status: "success", data: rows });
  } catch (err) {
    console.error('❌ خطأ في getPopularRecipes:', err);
    res.json({ status: "error", message: err.message });
  }
};

// ===============================
//      آخر الإضافات
// ===============================
exports.getRecentRecipes = async (req, res) => {
  try {
    // ⚠️ procedure كلمة محجوزة في MySQL، يجب استخدام backticks
    const backtick = String.fromCharCode(96);
    const procedureCol = 'r.' + backtick + 'procedure' + backtick;
    const query = 'SELECT r.id, r.item_name, r.name, r.yield, r.portions, r.shelf_life, ' + procedureCol + 
                  ', r.reference, r.version, r.edition, r.created_by, r.status, r.created_at, ' +
                  'u.username AS created_by_name ' +
                  'FROM recipes r ' +
                  'LEFT JOIN users u ON r.created_by = u.id ' +
                  'ORDER BY r.created_at DESC ' +
                  'LIMIT 5';
    const [rows] = await appPool.query(query);
    res.json({ status: "success", data: rows });
  } catch (err) {
    console.error('❌ خطأ في getRecentRecipes:', err);
    res.json({ status: "error", message: err.message });
  }
};

// ===============================
//      إنتاج وصفة (إنشاء إنتاج جديد مع QR Code)
// ===============================
exports.produceRecipe = async (req, res) => {
  try {
    console.log('🔵 produceRecipe: بدء إنتاج وصفة جديدة');
    const { id } = req.params;
    const { production_quantity, portion_weight, production_date } = req.body;
    const userId = req.user?.id;

    // التحقق من البيانات المطلوبة
    if (!production_quantity || !portion_weight || !production_date) {
      return res.status(400).json({
        status: "error",
        message: "الحقول المطلوبة: production_quantity, portion_weight, production_date"
      });
    }

    // التحقق من صحة القيم الرقمية
    const productionQty = parseFloat(production_quantity);
    const portionWeight = parseFloat(portion_weight);

    if (isNaN(productionQty) || productionQty <= 0) {
      return res.status(400).json({
        status: "error",
        message: "الكمية المنتجة يجب أن تكون رقم صحيح أكبر من صفر"
      });
    }

    if (isNaN(portionWeight) || portionWeight <= 0) {
      return res.status(400).json({
        status: "error",
        message: "وزن البورشن يجب أن يكون رقم صحيح أكبر من صفر"
      });
    }

    // التحقق من صحة التاريخ
    const productionDate = new Date(production_date);
    if (isNaN(productionDate.getTime())) {
      return res.status(400).json({
        status: "error",
        message: "تاريخ الإنتاج غير صحيح"
      });
    }

    // جلب الوصفة
    const backtick = String.fromCharCode(96);
    const procedureCol = backtick + 'procedure' + backtick;
    const [recipeRows] = await appPool.query(
      `SELECT id, item_name, name, yield, portions, shelf_life, ${procedureCol}, reference, version, edition 
       FROM recipes WHERE id = ?`,
      [id]
    );

    if (recipeRows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "الوصفة غير موجودة"
      });
    }

    const recipe = recipeRows[0];

    // جلب المكونات الأصلية
    const [ingredientsRows] = await appPool.query(
      `SELECT ingredient_name, quantity, display_order 
       FROM recipe_ingredients_new 
       WHERE recipe_id = ? 
       ORDER BY display_order ASC`,
      [id]
    );

    // حساب المقادير للكمية المطلوبة
    // استخراج الرقم من yield (مثلاً "5 KG" -> 5)
    const originalYield = parseFloat(recipe.yield?.toString().replace(/[^0-9.]/g, '')) || 1;
    
    if (originalYield <= 0) {
      return res.status(400).json({
        status: "error",
        message: "Yield الوصفة غير صحيح"
      });
    }
    
    const multiplier = productionQty / originalYield;

    const calculatedIngredients = ingredientsRows.map(ing => {
      // استخراج الرقم من الكمية (مثلاً "100 GR" -> 100)
      const originalQty = parseFloat(ing.quantity?.toString().replace(/[^0-9.]/g, '')) || 0;
      const unit = ing.quantity?.toString().replace(/[0-9.]/g, '').trim() || '';
      const newQty = (originalQty * multiplier).toFixed(2);
      return {
        ingredient_name: ing.ingredient_name,
        original_quantity: ing.quantity,
        calculated_quantity: `${newQty} ${unit}`.trim(),
        calculated_quantity_value: parseFloat(newQty), // القيمة الرقمية للخصم
        calculated_quantity_unit: unit, // الوحدة
        display_order: ing.display_order
      };
    });

    // حساب تاريخ الانتهاء من shelf_life
    let expiryDate = new Date(productionDate);
    
    if (recipe.shelf_life) {
      const shelfLifeStr = recipe.shelf_life.toString().toLowerCase();
      // استخراج الأيام (مثلاً "DAY 30" -> 30, "3 أيام" -> 3)
      const daysMatch = shelfLifeStr.match(/(\d+)/);
      if (daysMatch) {
        const days = parseInt(daysMatch[1]);
        if (!isNaN(days) && days > 0) {
          expiryDate.setDate(expiryDate.getDate() + days);
        }
      }
    }

    // حساب عدد البورتشنات
    const numberOfPortions = Math.floor(productionQty / portionWeight);
    
    if (numberOfPortions <= 0) {
      return res.status(400).json({
        status: "error",
        message: `عدد البورتشنات غير صحيح. الكمية المنتجة (${productionQty}) يجب أن تكون أكبر من وزن البورشن (${portionWeight})`
      });
    }

    if (numberOfPortions > 1000) {
      return res.status(400).json({
        status: "error",
        message: "عدد البورتشنات كبير جداً (أكثر من 1000). يرجى التحقق من البيانات"
      });
    }

    console.log('🔵 produceRecipe: معلومات الحساب:', {
      productionQty,
      portionWeight,
      numberOfPortions,
      originalYield,
      multiplier
    });
    
    // إنشاء QR Codes متعددة (واحد لكل بورشن)
    const qrCodes = [];
    for (let i = 1; i <= numberOfPortions; i++) {
      const qrCodeData = {
        production_id: null, // سيتم تعبئته بعد الإدراج
        portion_number: i, // رقم البورشن
        total_portions: numberOfPortions, // إجمالي البورتشنات
        recipe_id: recipe.id,
        recipe_name: recipe.item_name || recipe.name,
        production_quantity: productionQty,
        portion_weight: portionWeight,
        production_date: productionDate.toISOString(),
        expiry_date: expiryDate.toISOString(),
        reference: recipe.reference || null,
        version: recipe.version || '001',
        edition: recipe.edition || 1
      };
      qrCodes.push(qrCodeData);
    }

    // إزالة Foreign Key constraint من transactions.user_id إذا كان موجوداً
    // لأن المستخدمين في auth_db وليس kitchen_inventory
    // يجب أن يكون خارج transaction لأنها عملية DDL
    const connection = await appPool.getConnection();
    try {
      try {
        const [constraints] = await connection.execute(
          `SELECT CONSTRAINT_NAME 
           FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
           WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'transactions' 
             AND COLUMN_NAME = 'user_id'
             AND REFERENCED_TABLE_NAME = 'users'`
        );
        
        if (constraints.length > 0) {
          const constraintName = constraints[0].CONSTRAINT_NAME;
          console.log(`⚠️ إزالة Foreign Key constraint: ${constraintName}`);
          try {
            // DDL operations commit automatically, so we don't need transaction
            await connection.execute(`ALTER TABLE transactions DROP FOREIGN KEY ${constraintName}`);
            console.log('✅ تم إزالة Foreign Key constraint من transactions.user_id');
          } catch (dropErr) {
            console.log('⚠️ تحذير: لم يتم إزالة Foreign Key constraint:', dropErr.message);
            // لا نوقف العملية، نكمل محاولة الإدراج
          }
        }
      } catch (fkCheckErr) {
        console.log('⚠️ تحذير: خطأ في التحقق من Foreign Key:', fkCheckErr.message);
        // لا نوقف العملية
      }

      // الآن نبدأ Transaction للإدراج
      await connection.beginTransaction();

      // التحقق من وجود جدول recipe_productions وإنشاؤه إذا لم يكن موجوداً
      try {
        await connection.execute('SELECT 1 FROM recipe_productions LIMIT 1');
      } catch (tableErr) {
        if (tableErr.code === 'ER_NO_SUCH_TABLE') {
          console.log('⚠️ جدول recipe_productions غير موجود، جاري إنشاؤه...');
          try {
            // إنشاء جدول recipe_productions
            await connection.execute(`
              CREATE TABLE IF NOT EXISTS recipe_productions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                recipe_id INT NOT NULL,
                production_quantity DECIMAL(12,3) NOT NULL,
                portion_weight DECIMAL(12,3) NOT NULL,
                production_date DATETIME NOT NULL,
                expiry_date DATETIME NOT NULL,
                qr_code_data JSON,
                calculated_ingredients JSON,
                created_by INT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
                INDEX idx_recipe_id (recipe_id),
                INDEX idx_production_date (production_date),
                INDEX idx_expiry_date (expiry_date)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            
            // إنشاء جدول production_statistics
            await connection.execute(`
              CREATE TABLE IF NOT EXISTS production_statistics (
                id INT AUTO_INCREMENT PRIMARY KEY,
                production_id INT NOT NULL UNIQUE,
                total_withdrawn DECIMAL(12,3) NOT NULL DEFAULT 0.000,
                remaining_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
                withdrawal_count INT NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (production_id) REFERENCES recipe_productions(id) ON DELETE CASCADE,
                INDEX idx_production_id (production_id)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            
            // إنشاء جدول recipe_withdrawals
            await connection.execute(`
              CREATE TABLE IF NOT EXISTS recipe_withdrawals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                production_id INT NOT NULL,
                user_id INT,
                withdrawal_quantity DECIMAL(12,3) NOT NULL,
                notes VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (production_id) REFERENCES recipe_productions(id) ON DELETE CASCADE,
                INDEX idx_production_id (production_id),
                INDEX idx_user_id (user_id),
                INDEX idx_created_at (created_at)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            
            console.log('✅ تم إنشاء جداول إنتاج الوصفات بنجاح');
          } catch (createErr) {
            await connection.rollback();
            connection.release();
            console.error('❌ خطأ في إنشاء الجداول:', createErr);
            return res.status(500).json({
              status: "error",
              message: "خطأ في إنشاء جداول قاعدة البيانات. يرجى تشغيل ملف database/sql/create_production_tables.sql يدوياً",
              details: process.env.NODE_ENV === 'development' ? createErr.message : undefined
            });
          }
        } else {
          throw tableErr;
        }
      }

      // التحقق من توفر المكونات في المخزن وخصمها
      console.log('🔵 التحقق من توفر المكونات في المخزن...');
      const ingredientDeductions = [];
      
      for (const ing of calculatedIngredients) {
        // البحث عن المكون في جدول ingredients بالاسم
        const [ingredientRows] = await connection.query(
          `SELECT id, name, unit, stock_quantity FROM ingredients WHERE name = ? LIMIT 1`,
          [ing.ingredient_name]
        );

        if (ingredientRows.length > 0) {
          const ingredient = ingredientRows[0];
          const requiredQty = ing.calculated_quantity_value;
          const availableQty = parseFloat(ingredient.stock_quantity || 0);

          if (availableQty < requiredQty) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
              status: "error",
              message: `الكمية غير كافية في المخزن: ${ing.ingredient_name}. المطلوب: ${requiredQty} ${ing.calculated_quantity_unit || ingredient.unit}, المتوفر: ${availableQty} ${ingredient.unit}`
            });
          }

          ingredientDeductions.push({
            ingredient_id: ingredient.id,
            ingredient_name: ingredient.name,
            quantity: requiredQty,
            unit: ing.calculated_quantity_unit || ingredient.unit
          });
        } else {
          console.log(`⚠️ المكون ${ing.ingredient_name} غير موجود في المخزن - سيتم تخطيه`);
        }
      }

      const [result] = await connection.execute(
        `INSERT INTO recipe_productions 
         (recipe_id, production_quantity, portion_weight, production_date, expiry_date, 
          qr_code_data, calculated_ingredients, created_by) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recipe.id,
          productionQty,
          portionWeight,
          productionDate,
          expiryDate,
          JSON.stringify(qrCodes[0]), // حفظ أول QR Code كمرجع
          JSON.stringify(calculatedIngredients),
          userId || null
        ]
      );

      const productionId = result.insertId;

      // تحديث production_id في جميع QR Codes
      const updatedQRCodes = qrCodes.map(qr => {
        qr.production_id = productionId;
        return qr;
      });

      // إنشاء QR Code images لجميع البورتشنات
      const qrCodeImages = [];
      for (const qrData of updatedQRCodes) {
        const qrCodeString = JSON.stringify(qrData);
        const qrCodeImage = await QRCode.toDataURL(qrCodeString, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          width: 300
        });
        qrCodeImages.push({
          portion_number: qrData.portion_number,
          qr_code_data: qrData,
          qr_code_image: qrCodeImage
        });
      }

      // تحديث QR Code في قاعدة البيانات (أول QR Code)
      await connection.execute(
        `UPDATE recipe_productions 
         SET qr_code_data = ? 
         WHERE id = ?`,
        [JSON.stringify(updatedQRCodes[0]), productionId]
      );

      // خصم المكونات من المخزن
      console.log('🔵 خصم المكونات من المخزن...');
      for (const deduction of ingredientDeductions) {
        // خصم الكمية من المخزن
        await connection.execute(
          `UPDATE ingredients 
           SET stock_quantity = stock_quantity - ? 
           WHERE id = ?`,
          [deduction.quantity, deduction.ingredient_id]
        );

        // تسجيل المعاملة
        // ⚠️ ملاحظة: user_id يأتي من auth_db، لذلك نستخدم NULL بدلاً من userId
        // لأن Foreign Key constraint يشير إلى kitchen_inventory.users
        await connection.execute(
          `INSERT INTO transactions (ingredient_id, user_id, type, quantity, note) 
           VALUES (?, NULL, 'withdraw', ?, ?)`,
          [
            deduction.ingredient_id,
            deduction.quantity,
            `إنتاج وصفة: ${recipe.item_name || recipe.name} - Production ID: ${productionId} - User ID: ${userId || 'N/A'}`
          ]
        );

        console.log(`✅ تم خصم ${deduction.quantity} ${deduction.unit} من ${deduction.ingredient_name}`);
      }

      // إضافة المنتج المنتج إلى المخزن (إذا لم يكن موجوداً)
      const productName = recipe.item_name || recipe.name;
      const [existingProduct] = await connection.query(
        `SELECT id, stock_quantity FROM ingredients WHERE name = ? LIMIT 1`,
        [productName]
      );

      if (existingProduct.length > 0) {
        // المنتج موجود - إضافة الكمية المنتجة
        await connection.execute(
          `UPDATE ingredients 
           SET stock_quantity = stock_quantity + ? 
           WHERE id = ?`,
          [productionQty, existingProduct[0].id]
        );

        // تسجيل المعاملة
        // ⚠️ ملاحظة: user_id يأتي من auth_db، لذلك نستخدم NULL
        await connection.execute(
          `INSERT INTO transactions (ingredient_id, user_id, type, quantity, note) 
           VALUES (?, NULL, 'deposit', ?, ?)`,
          [
            existingProduct[0].id,
            productionQty,
            `إنتاج وصفة - Production ID: ${productionId} - User ID: ${userId || 'N/A'}`
          ]
        );

        console.log(`✅ تم إضافة ${productionQty} إلى المخزن للمنتج: ${productName}`);
      } else {
        // المنتج غير موجود - إنشاء مادة جديدة في المخزن
        const [newProductResult] = await connection.execute(
          `INSERT INTO ingredients (name, unit, stock_quantity) 
           VALUES (?, ?, ?)`,
          [productName, 'KG', productionQty] // افتراضياً KG
        );

        // تسجيل المعاملة
        // ⚠️ ملاحظة: user_id يأتي من auth_db، لذلك نستخدم NULL
        await connection.execute(
          `INSERT INTO transactions (ingredient_id, user_id, type, quantity, note) 
           VALUES (?, NULL, 'deposit', ?, ?)`,
          [
            newProductResult.insertId,
            productionQty,
            `إنتاج وصفة - Production ID: ${productionId} - User ID: ${userId || 'N/A'}`
          ]
        );

        console.log(`✅ تم إنشاء مادة جديدة في المخزن: ${productName} بكمية ${productionQty}`);
      }

      // إنشاء سجل في production_statistics
      try {
        await connection.execute(
          `INSERT INTO production_statistics (production_id, remaining_quantity) 
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE 
           remaining_quantity = ?,
           updated_at = CURRENT_TIMESTAMP`,
          [productionId, productionQty, productionQty]
        );
      } catch (statErr) {
        // إذا فشل إنشاء statistics، نكمل بدونها (ليس ضرورياً)
        console.log('⚠️ تحذير: لم يتم إنشاء إحصائيات الإنتاج:', statErr.message);
      }

      await connection.commit();

      console.log('✅ produceRecipe: تم إنشاء الإنتاج بنجاح:', productionId);
      console.log('✅ عدد البورتشنات:', numberOfPortions);

      res.json({
        status: "success",
        message: `تم إنشاء الإنتاج بنجاح (${numberOfPortions} بورشن)`,
        data: {
          production_id: productionId,
          recipe: {
            id: recipe.id,
            name: recipe.item_name || recipe.name,
            reference: recipe.reference,
            version: recipe.version,
            edition: recipe.edition
          },
          production_quantity: productionQty,
          portion_weight: portionWeight,
          number_of_portions: numberOfPortions,
          production_date: productionDate.toISOString(),
          expiry_date: expiryDate.toISOString(),
          calculated_ingredients: calculatedIngredients,
          qr_codes: qrCodeImages // جميع QR Codes للبورتشنات
        }
      });
    } catch (dbErr) {
      await connection.rollback();
      console.error('❌ produceRecipe: خطأ في قاعدة البيانات:', dbErr);
      console.error('❌ تفاصيل الخطأ:', dbErr.message);
      console.error('❌ SQL State:', dbErr.sqlState);
      console.error('❌ Error Code:', dbErr.code);
      console.error('❌ Stack:', dbErr.stack);
      throw dbErr;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error('❌ خطأ في produceRecipe:', err);
    console.error('❌ تفاصيل الخطأ:', err.message);
    console.error('❌ SQL State:', err.sqlState);
    console.error('❌ Error Code:', err.code);
    console.error('❌ Stack:', err.stack);
    
    let errorMessage = err.message || 'خطأ في إنشاء الإنتاج';
    
    // رسائل خطأ واضحة للمستخدم
    if (err.code === 'ER_NO_SUCH_TABLE') {
      errorMessage = 'جدول recipe_productions غير موجود. يرجى تشغيل ملف database_updates_production.sql أولاً';
    } else if (err.code === 'ER_BAD_FIELD_ERROR') {
      errorMessage = 'عمود غير موجود في الجدول. يرجى التحقق من قاعدة البيانات';
    } else if (err.code === 'ER_PARSE_ERROR') {
      errorMessage = 'خطأ في SQL: ' + err.message;
    }
    
    res.status(500).json({
      status: "error",
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// ===============================
//      جلب إنتاج معين
// ===============================
exports.getProduction = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await appPool.query(
      `SELECT rp.*, r.item_name, r.name, r.reference, r.version, r.edition 
       FROM recipe_productions rp
       LEFT JOIN recipes r ON rp.recipe_id = r.id
       WHERE rp.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "الإنتاج غير موجود"
      });
    }

    const production = rows[0];
    
    // تحليل JSON fields
    if (production.calculated_ingredients) {
      production.calculated_ingredients = JSON.parse(production.calculated_ingredients);
    }
    if (production.qr_code_data) {
      production.qr_code_data = JSON.parse(production.qr_code_data);
    }

    // إنشاء QR Code image
    let qrCodeImage = null;
    if (production.qr_code_data) {
      qrCodeImage = await QRCode.toDataURL(JSON.stringify(production.qr_code_data), {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        width: 300
      });
    }

    res.json({
      status: "success",
      data: {
        ...production,
        qr_code_image: qrCodeImage
      }
    });
  } catch (err) {
    console.error('❌ خطأ في getProduction:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//      جلب جميع الإنتاجات
// ===============================
exports.getProductions = async (req, res) => {
  try {
    const { recipe_id, limit = 50, offset = 0 } = req.query;
    
    let query = `SELECT rp.*, r.item_name, r.name, r.reference, r.version, r.edition,
                 ps.total_withdrawn, ps.remaining_quantity, ps.withdrawal_count
                 FROM recipe_productions rp
                 LEFT JOIN recipes r ON rp.recipe_id = r.id
                 LEFT JOIN production_statistics ps ON rp.id = ps.production_id
                 WHERE 1=1`;
    const params = [];

    if (recipe_id) {
      query += ' AND rp.recipe_id = ?';
      params.push(recipe_id);
    }

    query += ' ORDER BY rp.production_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await appPool.query(query, params);

    // تحليل JSON fields
    const productions = rows.map(row => {
      if (row.calculated_ingredients) {
        try {
          row.calculated_ingredients = JSON.parse(row.calculated_ingredients);
        } catch (e) {
          row.calculated_ingredients = [];
        }
      }
      if (row.qr_code_data) {
        try {
          row.qr_code_data = JSON.parse(row.qr_code_data);
        } catch (e) {
          row.qr_code_data = null;
        }
      }
      return row;
    });

    res.json({
      status: "success",
      data: productions
    });
  } catch (err) {
    console.error('❌ خطأ في getProductions:', err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
};

// ===============================
//   إعدادات ترويسة وشعار كرت الوصفة القياسي
// ===============================
exports.getHeaderSettings = async (req, res) => {
  try {
    const [rows] = await appPool.query(
      `SELECT setting_key, setting_value FROM settings 
       WHERE setting_key IN ('recipe_card_brand_name', 'recipe_card_sub_header', 'recipe_card_logo_url', 'recipe_card_show_logo')`
    );

    const settings = {
      brand_name: 'أركاف سبيشالتي كافيه ومطعم',
      sub_header: 'Central Kitchen • Standard Formulation & Recipe Control',
      logo_url: '',
      show_logo: '1'
    };

    rows.forEach(r => {
      if (r.setting_key === 'recipe_card_brand_name' && r.setting_value !== null) settings.brand_name = r.setting_value;
      if (r.setting_key === 'recipe_card_sub_header' && r.setting_value !== null) settings.sub_header = r.setting_value;
      if (r.setting_key === 'recipe_card_logo_url' && r.setting_value !== null) settings.logo_url = r.setting_value;
      if (r.setting_key === 'recipe_card_show_logo' && r.setting_value !== null) settings.show_logo = r.setting_value;
    });

    return res.json({ status: "success", data: settings });
  } catch (err) {
    console.error('❌ خطأ في getHeaderSettings:', err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};

exports.updateHeaderSettings = async (req, res) => {
  try {
    const { brand_name, sub_header, logo_url, show_logo } = req.body;
    const userId = req.user?.id || null;

    const items = [
      ['recipe_card_brand_name', brand_name !== undefined ? String(brand_name) : 'أركاف سبيشالتي كافيه ومطعم', 'اسم المنشأة في كرت الوصفة القياسي'],
      ['recipe_card_sub_header', sub_header !== undefined ? String(sub_header) : 'Central Kitchen • Standard Formulation & Recipe Control', 'الترويسة الفرعية في كرت الوصفة'],
      ['recipe_card_logo_url', logo_url !== undefined ? String(logo_url) : '', 'رابط أو كود صورة شعار المنشأة'],
      ['recipe_card_show_logo', (show_logo === '1' || show_logo === 1 || show_logo === true) ? '1' : '0', 'إظهار الشعار في كرت الوصفة']
    ];

    for (const [key, val, desc] of items) {
      await appPool.query(
        `INSERT INTO settings (setting_key, setting_value, description, updated_by, updated_at)
         VALUES (?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           setting_value = VALUES(setting_value),
           updated_by = VALUES(updated_by),
           updated_at = NOW()`,
        [key, val, desc, userId]
      );
    }

    return res.json({
      status: "success",
      message: "تم حفظ إعدادات ترويسة وشعار كرت الوصفة بنجاح",
      data: {
        brand_name: brand_name || 'أركاف سبيشالتي كافيه ومطعم',
        sub_header: sub_header || 'Central Kitchen • Standard Formulation & Recipe Control',
        logo_url: logo_url || '',
        show_logo: (show_logo === '1' || show_logo === 1 || show_logo === true) ? '1' : '0'
      }
    });
  } catch (err) {
    console.error('❌ خطأ في updateHeaderSettings:', err);
    return res.status(500).json({ status: "error", message: err.message });
  }
};



