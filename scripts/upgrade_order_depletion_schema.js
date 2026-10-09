/**
 * Upgrade schema for precise order depletion and waiter tracking
 */
const { appPool } = require('../database/appConnection');

async function upgrade() {
  const conn = await appPool.getConnection();
  try {
    console.log('🔄 جاري تحديث جداول الطلبات وحركات مخزون السكاشن...');
    
    // 1. pos_orders: is_stock_depleted
    const [orderCols] = await conn.query('DESCRIBE pos_orders');
    const orderFields = orderCols.map(c => c.Field);
    if (!orderFields.includes('is_stock_depleted')) {
      console.log('➕ إضافة عمود is_stock_depleted إلى pos_orders...');
      await conn.query('ALTER TABLE pos_orders ADD COLUMN is_stock_depleted TINYINT(1) DEFAULT 0 AFTER status');
    }

    // 2. station_stock_moves: recipe_id & ref_order_item_id
    const [moveCols] = await conn.query('DESCRIBE station_stock_moves');
    const moveFields = moveCols.map(c => c.Field);
    if (!moveFields.includes('recipe_id')) {
      console.log('➕ إضافة عمود recipe_id إلى station_stock_moves...');
      await conn.query('ALTER TABLE station_stock_moves ADD COLUMN recipe_id INT NULL AFTER ingredient_id');
    }
    if (!moveFields.includes('ref_order_item_id')) {
      console.log('➕ إضافة عمود ref_order_item_id إلى station_stock_moves...');
      await conn.query('ALTER TABLE station_stock_moves ADD COLUMN ref_order_item_id BIGINT NULL AFTER ref_order_id');
    }

    console.log('✅ تم تحديث بنية الجداول بنجاح.');
  } catch (err) {
    console.error('❌ خطأ في ترقية قاعدة البيانات:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

upgrade();
