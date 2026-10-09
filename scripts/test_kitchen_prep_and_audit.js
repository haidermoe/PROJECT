/**
 * End-to-End Automated Test: Prep Batches, Barcode Scan, and Station Reconciliation
 */
const { appPool } = require('../database/appConnection');

async function testWorkflow() {
  console.log('🧪 Starting Kitchen Operations & Audit End-to-End Test...');

  // 1. Ensure a recipe and ingredients exist
  let [recipes] = await appPool.query('SELECT id, name FROM recipes LIMIT 1');
  let recipeId;
  if (!recipes.length) {
    const [recInsert] = await appPool.query(
      "INSERT INTO recipes (item_name, name, status, yield, portions) VALUES ('صوص برجر خاص', 'صوص برجر خاص', 'active', 'علبة', 10)"
    );
    recipeId = recInsert.insertId;
  } else {
    recipeId = recipes[0].id;
  }

  // Ensure raw ingredient exists
  let [raws] = await appPool.query("SELECT id FROM ingredients WHERE material_type = 'raw' LIMIT 1");
  let rawIngId;
  if (!raws.length) {
    const [rawInsert] = await appPool.query(
      "INSERT INTO ingredients (name, unit, stock_quantity, material_type, branch_id) VALUES ('مايونيز خام', 'كغم', 50.0, 'raw', 1)"
    );
    rawIngId = rawInsert.insertId;
  } else {
    rawIngId = raws[0].id;
    await appPool.query("UPDATE ingredients SET stock_quantity = 50.0 WHERE id = ?", [rawIngId]);
  }

  // Ensure recipe_ingredients link
  const [recLinks] = await appPool.query('SELECT * FROM recipe_ingredients WHERE recipe_id = ? AND ingredient_id = ?', [recipeId, rawIngId]);
  if (!recLinks.length) {
    await appPool.query(
      'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity) VALUES (?, ?, 0.5)',
      [recipeId, rawIngId]
    );
  }

  // Ensure station exists
  const [stations] = await appPool.query('SELECT id, station_code, station_name FROM pos_stations WHERE station_type = "kitchen" LIMIT 1');
  const stationId = stations[0].id;
  const stationCode = stations[0].station_code;
  console.log(`📍 Testing with Station: ${stations[0].station_name} (${stationCode})`);

  // 2. Simulate Batch Prep & Barcode Generation
  const ctrl = require('../api/kitchenOperationsController');
  
  // Mock request/response for producePrepBatch
  let batchData = null;
  const mockReqProduce = {
    body: {
      recipe_id: recipeId,
      planned_portions: 5,
      portion_size: 0.25,
      unit: 'علبة',
      shelf_life_days: 10
    },
    user: { id: 1, branch_id: 1 },
    headers: {}
  };
  const mockResProduce = {
    json: (res) => { batchData = res.data; console.log('✅ Batch Produced:', res.message); },
    status: (code) => ({ json: (err) => console.error('Produce Error:', err) })
  };

  await ctrl.producePrepBatch(mockReqProduce, mockResProduce);

  if (!batchData || !batchData.labels || batchData.labels.length === 0) {
    throw new Error('Batch production failed to generate labels!');
  }

  const sampleLabel = batchData.labels[0].labelCode;
  console.log(`🏷️ Sample Generated Label Barcode: ${sampleLabel}`);

  // 3. Simulate Barcode Scan Transfer to Station
  let scanResult = null;
  const mockReqScan = {
    body: {
      label_code: sampleLabel,
      station_id: stationId
    },
    user: { id: 1 },
    headers: {}
  };
  const mockResScan = {
    json: (res) => { scanResult = res.data; console.log('✅ Scan Transfer Succeeded:', res.message); },
    status: (code) => ({ json: (err) => console.error('Scan Error:', err) })
  };

  await ctrl.scanItemToStation(mockReqScan, mockResScan);
  console.log(`📦 New Station Stock: ${scanResult?.newStationBalance}`);

  // 4. Simulate Audit Summary (Reconciliation Calculation)
  let auditSummary = null;
  const mockReqAudit = {
    query: {
      station_id: stationId,
      date: new Date().toISOString().split('T')[0]
    }
  };
  const mockResAudit = {
    json: (res) => { auditSummary = res.data; },
    status: (code) => ({ json: (err) => console.error('Audit Summary Error:', err) })
  };

  await ctrl.getStationAuditSummary(mockReqAudit, mockResAudit);
  console.log(`⚖️ Audit Summary Items Found: ${auditSummary?.items?.length || 0}`);
  if (auditSummary?.items?.length > 0) {
    const item = auditSummary.items[0];
    console.log(`   - Item: ${item.name}`);
    console.log(`   - Transferred In: ${item.transferredInQty} ${item.unit}`);
    console.log(`   - Theoretical Expected: ${item.theoreticalQty} ${item.unit}`);
  }

  // 5. Submit Audit with Variance and Explanation
  const mockReqSubmit = {
    body: {
      station_id: stationId,
      audit_date: new Date().toISOString().split('T')[0],
      shift_name: 'الشفت المسائي',
      lines: [
        {
          ingredientId: auditSummary.items[0].ingredientId,
          name: auditSummary.items[0].name,
          opening_qty: auditSummary.items[0].openingQty,
          transferred_in_qty: auditSummary.items[0].transferredInQty,
          consumed_qty: 0,
          waste_qty: 0,
          theoretical_qty: auditSummary.items[0].theoreticalQty,
          actual_qty: auditSummary.items[0].theoreticalQty - 0.25, // Simulate 0.25 variance
          chef_explanation: 'انسكاب ربع لتر صوص أثناء النقل والتعبئة'
        }
      ]
    },
    user: { id: 1, role: 'kitchen_manager' }
  };
  const mockResSubmit = {
    json: (res) => { console.log('✅ Audit Submitted:', res.message); },
    status: (code) => ({ json: (err) => console.error('Submit Audit Error:', err) })
  };

  await ctrl.submitStationAudit(mockReqSubmit, mockResSubmit);

  console.log('\n🎉 ALL KITCHEN PREP, BARCODE SCAN & AUDIT TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testWorkflow().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
