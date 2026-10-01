/**
 * Seed Full POS Menu, Recipes, Ingredients, and Station Linkages
 */
const { appPool } = require('../database/appConnection');

async function seed() {
  const conn = await appPool.getConnection();
  try {
    console.log('🚀 بدء تجهيز قائمة الطعام والوصفات والمكونات...');
    await conn.beginTransaction();

    // 1. التأكد من وجود عمود category في pos_items
    const [cols] = await conn.query('DESCRIBE pos_items');
    const colNames = cols.map(c => c.Field);
    if (!colNames.includes('category')) {
      console.log('➕ إضافة عمود category لجدول pos_items...');
      await conn.query('ALTER TABLE pos_items ADD COLUMN category VARCHAR(100) DEFAULT "عام" AFTER item_name');
    }
    if (!colNames.includes('image_url')) {
      console.log('➕ إضافة عمود image_url لجدول pos_items...');
      await conn.query('ALTER TABLE pos_items ADD COLUMN image_url VARCHAR(255) NULL AFTER is_active');
    }

    // 2. التحقق من السكاشن (pos_stations)
    const [stations] = await conn.query('SELECT * FROM pos_stations');
    console.log(`✅ السكاشن المتوفرة: ${stations.length} سكشن`);

    // 3. إضافة المكونات الخام الرئيسية (ingredients)
    const initialIngredients = [
      { name: 'لحم برجر مفروم متبل', unit: 'كغم', stock: 50.0, type: 'raw' },
      { name: 'خبز برجر بريوش طازج', unit: 'قطعة', stock: 200.0, type: 'raw' },
      { name: 'بطاطا بلجيكية نصف مقلية', unit: 'كغم', stock: 80.0, type: 'raw' },
      { name: 'زيت ذرة نقي للقلي', unit: 'لتر', stock: 100.0, type: 'raw' },
      { name: 'جبنة شيدر سلايس أمريكية', unit: 'كغم', stock: 30.0, type: 'raw' },
      { name: 'صدر دجاج كرسبي متبل', unit: 'كغم', stock: 40.0, type: 'raw' },
      { name: 'مايونيز خام ممتاز', unit: 'كغم', stock: 60.0, type: 'raw' },
      { name: 'كاتشب هاينز', unit: 'كغم', stock: 40.0, type: 'raw' },
      { name: 'خردل أصفر ديجون', unit: 'كغم', stock: 20.0, type: 'raw' },
      { name: 'مخلل خيار شرائح', unit: 'كغم', stock: 25.0, type: 'raw' },
      { name: 'صوص برجر خاص (علب)', unit: 'علبة', stock: 35.0, type: 'manufactured' },
      { name: 'صوص شيدر ذائب (علب)', unit: 'علبة', stock: 25.0, type: 'manufactured' },
      { name: 'بيبسي كانز 330 مل', unit: 'علبة', stock: 240.0, type: 'raw' },
      { name: 'سفن اب كانز 330 مل', unit: 'علبة', stock: 180.0, type: 'raw' },
      { name: 'سيروب موهيتو ونعناع', unit: 'لتر', stock: 15.0, type: 'raw' },
      { name: 'ليمون ونعناع فريش', unit: 'كغم', stock: 20.0, type: 'raw' },
      { name: 'برتقال طبيعي للعصير', unit: 'كغم', stock: 50.0, type: 'raw' },
      { name: 'مياه معدنية 500 مل', unit: 'علبة', stock: 300.0, type: 'raw' }
    ];

    for (const ing of initialIngredients) {
      const [existing] = await conn.query('SELECT id FROM ingredients WHERE name = ?', [ing.name]);
      if (existing.length === 0) {
        await conn.query(`
          INSERT INTO ingredients (name, unit, stock_quantity, material_type, branch_id)
          VALUES (?, ?, ?, ?, 1)
        `, [ing.name, ing.unit, ing.stock, ing.type]);
      } else {
        await conn.query(`
          UPDATE ingredients SET stock_quantity = GREATEST(stock_quantity, ?) WHERE id = ?
        `, [ing.stock, existing[0].id]);
      }
    }

    // جلب خريطة المكونات بالاسم
    const [allIngs] = await conn.query('SELECT id, name FROM ingredients');
    const ingMap = {};
    allIngs.forEach(i => { ingMap[i.name] = i.id; });

    // 4. إنشاء الوصفات الأساسية (recipes)
    const baseRecipes = [
      {
        name: 'صوص برجر خاص',
        yield: 'علبة',
        portions: 10,
        ingredients: [
          { name: 'مايونيز خام ممتاز', qty: 0.500 },
          { name: 'كاتشب هاينز', qty: 0.300 },
          { name: 'خردل أصفر ديجون', qty: 0.100 },
          { name: 'مخلل خيار شرائح', qty: 0.100 }
        ]
      },
      {
        name: 'صوص شيدر ذائب',
        yield: 'علبة',
        portions: 10,
        ingredients: [
          { name: 'جبنة شيدر سلايس أمريكية', qty: 0.800 }
        ]
      },
      {
        name: 'برجر كلاسيك لحم',
        yield: 'وجبة',
        portions: 1,
        ingredients: [
          { name: 'خبز برجر بريوش طازج', qty: 1.000 },
          { name: 'لحم برجر مفروم متبل', qty: 0.160 },
          { name: 'جبنة شيدر سلايس أمريكية', qty: 0.030 },
          { name: 'صوص برجر خاص (علب)', qty: 0.050 }
        ]
      },
      {
        name: 'برجر دبل لحم وجبن',
        yield: 'وجبة',
        portions: 1,
        ingredients: [
          { name: 'خبز برجر بريوش طازج', qty: 1.000 },
          { name: 'لحم برجر مفروم متبل', qty: 0.320 },
          { name: 'جبنة شيدر سلايس أمريكية', qty: 0.060 },
          { name: 'صوص برجر خاص (علب)', qty: 0.080 }
        ]
      },
      {
        name: 'برجر كرسبي تشيكن',
        yield: 'وجبة',
        portions: 1,
        ingredients: [
          { name: 'خبز برجر بريوش طازج', qty: 1.000 },
          { name: 'صدر دجاج كرسبي متبل', qty: 0.180 },
          { name: 'جبنة شيدر سلايس أمريكية', qty: 0.030 },
          { name: 'مايونيز خام ممتاز', qty: 0.040 }
        ]
      },
      {
        name: 'بطاطا مقلية كرسبي',
        yield: 'وجبة',
        portions: 1,
        ingredients: [
          { name: 'بطاطا بلجيكية نصف مقلية', qty: 0.250 },
          { name: 'زيت ذرة نقي للقلي', qty: 0.040 }
        ]
      },
      {
        name: 'بطاطا مع صوص شيدر',
        yield: 'وجبة',
        portions: 1,
        ingredients: [
          { name: 'بطاطا بلجيكية نصف مقلية', qty: 0.250 },
          { name: 'زيت ذرة نقي للقلي', qty: 0.040 },
          { name: 'صوص شيدر ذائب (علب)', qty: 0.080 }
        ]
      },
      {
        name: 'كرانشي تشيكن تندرز',
        yield: 'وجبة',
        portions: 1,
        ingredients: [
          { name: 'صدر دجاج كرسبي متبل', qty: 0.250 },
          { name: 'زيت ذرة نقي للقلي', qty: 0.050 }
        ]
      },
      {
        name: 'موهيتو ليمون ونعناع',
        yield: 'كأس',
        portions: 1,
        ingredients: [
          { name: 'سفن اب كانز 330 مل', qty: 1.000 },
          { name: 'سيروب موهيتو ونعناع', qty: 0.040 },
          { name: 'ليمون ونعناع فريش', qty: 0.050 }
        ]
      },
      {
        name: 'عصير برتقال فريش',
        yield: 'كأس',
        portions: 1,
        ingredients: [
          { name: 'برتقال طبيعي للعصير', qty: 0.400 }
        ]
      }
    ];

    const recipeMap = {};

    for (const r of baseRecipes) {
      let recipeId;
      const [existing] = await conn.query('SELECT id FROM recipes WHERE name = ?', [r.name]);
      if (existing.length === 0) {
        const [res] = await conn.query(`
          INSERT INTO recipes (name, item_name, yield, portions, status, version)
          VALUES (?, ?, ?, ?, 'active', '001')
        `, [r.name, r.name, r.yield, r.portions]);
        recipeId = res.insertId;
      } else {
        recipeId = existing[0].id;
      }
      recipeMap[r.name] = recipeId;

      // إضافة المكونات في recipe_ingredients
      await conn.query('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [recipeId]);
      for (const ring of r.ingredients) {
        const ingId = ingMap[ring.name];
        if (ingId) {
          await conn.query(`
            INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity)
            VALUES (?, ?, ?)
          `, [recipeId, ingId, ring.qty]);
        }
      }
    }

    // 5. مسح وتجهيز قائمة طعام الويترية (pos_items) بأسعار واقعية بالدينار العراقي
    // stations:
    // 1: سكشن الشوي والبرجر (Grill & Burger)
    // 2: سكشن التحضير والصوصات (Sauce & Prep)
    // 3: سكشن القلي والمقبلات (Fryer & Appetizers)
    // 4: سكشن المشروبات والبار (Beverages & Bar)

    const menuItems = [
      // برجر وشوي (Station 1)
      { name: 'برجر كلاسيك لحم', category: '🍔 برجر وسندويشات', price: 7000, station_id: 1, recipe: 'برجر كلاسيك لحم' },
      { name: 'برجر دبل لحم وجبن', category: '🍔 برجر وسندويشات', price: 9500, station_id: 1, recipe: 'برجر دبل لحم وجبن' },
      { name: 'برجر كرسبي تشيكن', category: '🍔 برجر وسندويشات', price: 6500, station_id: 1, recipe: 'برجر كرسبي تشيكن' },
      { name: 'برجر مشروم سويسري', category: '🍔 برجر وسندويشات', price: 8000, station_id: 1, recipe: 'برجر كلاسيك لحم' },
      { name: 'سندويش فاهيتا لحم مكسيكي', category: '🍔 برجر وسندويشات', price: 7500, station_id: 1, recipe: 'برجر كلاسيك لحم' },

      // مقبلات وقلي (Station 3)
      { name: 'بطاطا مقلية كرسبي', category: '🍟 مقبلات وبطاطا', price: 3000, station_id: 3, recipe: 'بطاطا مقلية كرسبي' },
      { name: 'بطاطا مع صوص شيدر ذائب', category: '🍟 مقبلات وبطاطا', price: 4500, station_id: 3, recipe: 'بطاطا مع صوص شيدر' },
      { name: 'كرانشي تشيكن تندرز (4 قطع)', category: '🍟 مقبلات وبطاطا', price: 6000, station_id: 3, recipe: 'كرانشي تشيكن تندرز' },
      { name: 'حلقات بصل مقرمشة (6 قطع)', category: '🍟 مقبلات وبطاطا', price: 3500, station_id: 3, recipe: 'بطاطا مقلية كرسبي' },
      { name: 'أصابع جبنة موزاريلا مشوية', category: '🍟 مقبلات وبطاطا', price: 4000, station_id: 3, recipe: 'بطاطا مقلية كرسبي' },

      // صوصات وإضافات (Station 2)
      { name: 'صوص برجر خاص إضافي', category: '🥗 صوصات وإضافات', price: 1000, station_id: 2, recipe: 'صوص برجر خاص' },
      { name: 'صوص جبنة شيدر سائل', category: '🥗 صوصات وإضافات', price: 1500, station_id: 2, recipe: 'صوص شيدر ذائب' },
      { name: 'صوص باربكيو مدخن', category: '🥗 صوصات وإضافات', price: 1000, station_id: 2, recipe: 'صوص برجر خاص' },
      { name: 'سلطة كول سلو طازجة', category: '🥗 صوصات وإضافات', price: 2000, station_id: 2, recipe: 'صوص برجر خاص' },

      // مشروبات وبار (Station 4)
      { name: 'بيبسي كانز بارد 330مل', category: '🥤 مشروبات وبار', price: 1000, station_id: 4, recipe: null },
      { name: 'سفن اب كانز بارد 330مل', category: '🥤 مشروبات وبار', price: 1000, station_id: 4, recipe: null },
      { name: 'موهيتو ليمون ونعناع منعش', category: '🥤 مشروبات وبار', price: 3500, station_id: 4, recipe: 'موهيتو ليمون ونعناع' },
      { name: 'عصير برتقال طبيعي فريش', category: '🥤 مشروبات وبار', price: 3500, station_id: 4, recipe: 'عصير برتقال فريش' },
      { name: 'مياه معدنية نقية 500مل', category: '🥤 مشروبات وبار', price: 500, station_id: 4, recipe: null }
    ];

    // مسح pos_items الحالي وإعادة بنائه بالكامل
    await conn.query('DELETE FROM pos_items');
    for (const item of menuItems) {
      const recId = item.recipe ? recipeMap[item.recipe] || null : null;
      await conn.query(`
        INSERT INTO pos_items (item_name, category, price, station_id, recipe_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
      `, [item.name, item.category, item.price, item.station_id, recId]);
    }

    console.log(`✅ تم إدخال ${menuItems.length} صنف في منيو الويترية بأسعارها المعتمدة!`);

    // 6. تزويد عهدة السكاشن الأولية بالمواد لتكون جاهزة للمطابقة
    // سكشن 1: شوي وبرجر
    if (ingMap['لحم برجر مفروم متبل']) {
      await conn.query(`
        INSERT INTO station_inventory (station_id, ingredient_id, quantity, last_transferred_at)
        VALUES (1, ?, 15.000, NOW())
        ON DUPLICATE KEY UPDATE quantity = 15.000
      `, [ingMap['لحم برجر مفروم متبل']]);
    }
    if (ingMap['خبز برجر بريوش طازج']) {
      await conn.query(`
        INSERT INTO station_inventory (station_id, ingredient_id, quantity, last_transferred_at)
        VALUES (1, ?, 50.000, NOW())
        ON DUPLICATE KEY UPDATE quantity = 50.000
      `, [ingMap['خبز برجر بريوش طازج']]);
    }

    // سكشن 2: صوصات وتحضير
    if (ingMap['صوص برجر خاص (علب)']) {
      await conn.query(`
        INSERT INTO station_inventory (station_id, ingredient_id, quantity, last_transferred_at)
        VALUES (2, ?, 20.000, NOW())
        ON DUPLICATE KEY UPDATE quantity = 20.000
      `, [ingMap['صوص برجر خاص (علب)']]);
    }
    if (ingMap['صوص شيدر ذائب (علب)']) {
      await conn.query(`
        INSERT INTO station_inventory (station_id, ingredient_id, quantity, last_transferred_at)
        VALUES (2, ?, 15.000, NOW())
        ON DUPLICATE KEY UPDATE quantity = 15.000
      `, [ingMap['صوص شيدر ذائب (علب)']]);
    }

    // سكشن 3: قلي ومقبلات
    if (ingMap['بطاطا بلجيكية نصف مقلية']) {
      await conn.query(`
        INSERT INTO station_inventory (station_id, ingredient_id, quantity, last_transferred_at)
        VALUES (3, ?, 25.000, NOW())
        ON DUPLICATE KEY UPDATE quantity = 25.000
      `, [ingMap['بطاطا بلجيكية نصف مقلية']]);
    }

    // سكشن 4: مشروبات
    if (ingMap['بيبسي كانز 330 مل']) {
      await conn.query(`
        INSERT INTO station_inventory (station_id, ingredient_id, quantity, last_transferred_at)
        VALUES (4, ?, 48.000, NOW())
        ON DUPLICATE KEY UPDATE quantity = 48.000
      `, [ingMap['بيبسي كانز 330 مل']]);
    }

    await conn.commit();
    console.log('🎉 اكتملت عملية التجهيز بنجاح!');
  } catch (err) {
    await conn.rollback();
    console.error('❌ خطأ أثناء التجهيز:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
