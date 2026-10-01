/**
 * Test Complete Restaurant Flow:
 * 1. Batch Preparation & Barcode Generation
 * 2. Barcode Scan & Station Stock Inflow
 * 3. Waiter POS Order with Real Prices (IQD)
 * 4. Automatic Recipe Depletion from Kitchen Stations
 * 5. Kitchen Shift Reconciliation (Audit) with Waiter Sales Breakdown
 */
const { appPool } = require('../database/appConnection');
const kitchenOps = require('../api/kitchenOperationsController');
const posOps = require('../api/posRestaurantController');

// Mock req and res helper
function mockReqRes(body = {}, query = {}, params = {}, user = { id: 1, username: 'علي الويتر', role: 'admin' }) {
  const req = {
    body,
    query,
    params,
    user,
    headers: { 'x-branch-id': 1 }
  };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    }
  };

  return { req, res, getResult: () => ({ statusCode, responseData }) };
}

async function runTest() {
  console.log('====================================================');
  console.log('🧪 بدء فحص دورة العمليات الكاملة للمطعم والمطبخ...');
  console.log('====================================================\n');

  try {
    // ----------------------------------------------------
    // الخطوة 1: احتساب مقادير تحضير دفعة صوص برجر خاص (20 علبة)
    // ----------------------------------------------------
    console.log('🍳 1. فحص حاسبة مقادير التحضير (Prep Calculator)...');
    const { req: req1, res: res1, getResult: getRes1 } = mockReqRes({
      recipe_id: 1, // صوص برجر خاص
      planned_portions: 20,
      portion_size: 0.250
    });
    await kitchenOps.calculatePrepPlan(req1, res1);
    const r1 = getRes1();
    console.log('✅ استجابة الحاسبة:', r1.responseData.status);
    console.log(`   الوصفة: ${r1.responseData.data.recipeName} | العلب المطلوبة: ${r1.responseData.data.plannedPortions}`);
    r1.responseData.data.items.forEach(it => {
      console.log(`   - ${it.name}: مطلوب ${it.requiredQty} ${it.unit} (متوفر بالمخزن: ${it.currentStock} ${it.unit})`);
    });

    // ----------------------------------------------------
    // الخطوة 2: إنتاج دفعة تحضير وتوليد الباركودات المعيارية
    // ----------------------------------------------------
    console.log('\n🏷️ 2. إنتاج الدفعة وتوليد ملصقات الباركود الفردية...');
    const { req: req2, res: res2, getResult: getRes2 } = mockReqRes({
      recipe_id: 1,
      planned_portions: 10,
      portion_size: 0.250,
      unit: 'علبة',
      shelf_life_days: 7,
      notes: 'تحضير شفت صباحي صوص برجر'
    });
    await kitchenOps.producePrepBatch(req2, res2);
    const r2 = getRes2();
    console.log('✅ استجابة الإنتاج:', r2.responseData.status);
    const batch = r2.responseData.data;
    console.log(`   رقم الدفعة: ${batch.batchNumber} | عدد العلب: ${batch.labels.length}`);
    console.log(`   عينة باركود العلبة الأولى: [${batch.labels[0].labelCode}]`);

    // ----------------------------------------------------
    // الخطوة 3: مسح الباركود لإيداع علبة في سكشن الصوصات (Station 2)
    // ----------------------------------------------------
    console.log('\n📷 3. مسح باركود العلبة لنقلها لسكشن الصوصات (ST-SAUCE)...');
    const { req: req3, res: res3, getResult: getRes3 } = mockReqRes({
      label_code: batch.labels[0].labelCode,
      station_code: 'ST-SAUCE'
    });
    await kitchenOps.scanItemToStation(req3, res3);
    const r3 = getRes3();
    console.log('✅ نتيجة المسح:', r3.responseData.message);
    console.log(`   رصيد السكشن الجديد: ${r3.responseData.data.newStationBalance}`);

    // ----------------------------------------------------
    // الخطوة 4: تسجيل طلب من الويتر في الصالة بأسعار المنيو الرسمية
    // ----------------------------------------------------
    console.log('\n🍽️ 4. الويتر علي يفتح طاولة 1 ويسجل طلباً للمطبخ...');
    // جلب أصناف المنيو مع الأسعار
    const [menuItems] = await appPool.query('SELECT * FROM pos_items WHERE is_active = 1 LIMIT 5');
    console.log('   الأصناف المختارة للطلب:');
    const orderItems = [
      { itemId: menuItems[0].id, itemName: menuItems[0].item_name, quantity: 2, price: menuItems[0].price },
      { itemId: menuItems[5]?.id || menuItems[1].id, itemName: menuItems[5]?.item_name || menuItems[1].item_name, quantity: 1, price: menuItems[5]?.price || menuItems[1].price }
    ];
    orderItems.forEach(oi => console.log(`   - ${oi.itemName} × ${oi.quantity} (سعر الوحدة: ${parseFloat(oi.price).toLocaleString()} د.ع)`));

    const { req: req4, res: res4, getResult: getRes4 } = mockReqRes({
      tableId: 1,
      floorId: 1,
      tableNo: 'طاولة 1',
      guestCount: 2,
      items: orderItems,
      notes: 'بدون بصل، استواء كامل'
    }, {}, {}, { id: 10, username: 'علي الويتر', role: 'waiter' });

    await posOps.sendWaiterOrder(req4, res4);
    const r4 = getRes4();
    console.log('✅ نتيجة إرسال الطلب:', r4.responseData.message);
    console.log(`   إجمالي الفاتورة: ${parseFloat(r4.responseData.data.totalAmount).toLocaleString()} د.ع`);

    // ----------------------------------------------------
    // الخطوة 5: استخراج كشف جرد ومطابقة السكشن وتتبع مبيعات الويتر
    // ----------------------------------------------------
    console.log('\n⚖️ 5. فتح كشف مطابقة سكشن الصوصات والتحضير (Reconciliation Audit)...');
    const { req: req5, res: res5, getResult: getRes5 } = mockReqRes({}, { station_id: 2 });
    await kitchenOps.getStationAuditSummary(req5, res5);
    const r5 = getRes5();
    console.log('✅ استجابة كشف المطابقة:', r5.responseData.status);
    const auditItems = r5.responseData.data.items;
    console.log(`   عدد المواد المسجلة بالسكشن: ${auditItems.length}`);
    auditItems.forEach(item => {
      console.log(`   📌 مادة: [${item.name}]`);
      console.log(`      افتتاحي: ${item.openingQty} | محول بالباركود: +${item.transferredInQty} | مستهلك بمبيعات الويترية: -${item.consumedQty} | المفروض باقي: ${item.theoreticalQty} ${item.unit}`);
      if (item.waiterBreakdown && item.waiterBreakdown.length > 0) {
        item.waiterBreakdown.forEach(wb => {
          console.log(`      👤 تفصيل مبيعات الويتر [${wb.waiterName}]: باع (${wb.itemName}) واستهلك ${wb.consumedQty} ${item.unit}`);
        });
      }
    });

    // ----------------------------------------------------
    // الخطوة 6: اعتماد وإرسال الجرد اليومي للإدارة
    // ----------------------------------------------------
    console.log('\n💾 6. الشيف يعتمد الجرد ويرسل تقرير الفروقات للإدارة...');
    const auditLines = auditItems.map(item => ({
      ingredient_id: item.ingredientId,
      opening_qty: item.openingQty,
      transferred_in_qty: item.transferredInQty,
      consumed_qty: item.consumedQty,
      waste_qty: item.wasteQty,
      theoretical_qty: item.theoreticalQty,
      actual_qty: item.theoreticalQty, // مطابق
      is_matched: true,
      explanation: 'المخزون مطابق تماماً للمبيعات والتحضير'
    }));

    const { req: req6, res: res6, getResult: getRes6 } = mockReqRes({
      station_id: 2,
      shift_name: 'الشفت المسائي 🌙',
      items: auditLines,
      overall_notes: 'شفت ممتاز بدون أي تلف أو نقص'
    }, {}, {}, { id: 5, username: 'الشيف محمد', role: 'kitchen_manager' });

    await kitchenOps.submitStationAudit(req6, res6);
    const r6 = getRes6();
    console.log('✅ نتيجة حفظ الجرد:', r6.responseData.message);

    console.log('\n====================================================');
    console.log('🎉 كل العمليات نجحت 100% بدون أي أخطاء أو كوارث!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ فشل الفحص:', err);
    process.exit(1);
  }
}

runTest();
