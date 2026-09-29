const { appPool } = require('./appConnection');

async function migrateFloorPlan() {
  console.log('🔄 [Floor Plan Migration] Adding visual layout and analytics columns...');

  const queries = [
    `ALTER TABLE pos_tables ADD COLUMN position_x INT NOT NULL DEFAULT 50`,
    `ALTER TABLE pos_tables ADD COLUMN position_y INT NOT NULL DEFAULT 50`,
    `ALTER TABLE pos_tables ADD COLUMN width INT NOT NULL DEFAULT 120`,
    `ALTER TABLE pos_tables ADD COLUMN height INT NOT NULL DEFAULT 120`,
    `ALTER TABLE pos_tables ADD COLUMN shape ENUM('square', 'round', 'rectangle') NOT NULL DEFAULT 'square'`,
    `ALTER TABLE pos_tables ADD COLUMN color VARCHAR(30) NULL`,
    `ALTER TABLE pos_orders ADD COLUMN guest_count INT NOT NULL DEFAULT 2`,
    `ALTER TABLE pos_orders ADD COLUMN seated_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE pos_orders ADD COLUMN billed_at DATETIME NULL`,
    `ALTER TABLE pos_orders ADD COLUMN closed_at DATETIME NULL`,
    `ALTER TABLE pos_orders ADD COLUMN duration_minutes INT NOT NULL DEFAULT 0`
  ];

  for (const q of queries) {
    try {
      await appPool.query(q);
    } catch (e) {
      // Column may already exist
    }
  }

  // توزيع إحداثيات افتراضية للطاولات الموجودة حتى لا تتراكب
  try {
    const [tables] = await appPool.query(`SELECT id, floor_id FROM pos_tables ORDER BY floor_id, id`);
    let currentFloor = null;
    let indexInFloor = 0;

    for (const t of tables) {
      if (t.floor_id !== currentFloor) {
        currentFloor = t.floor_id;
        indexInFloor = 0;
      }
      const col = indexInFloor % 4;
      const row = Math.floor(indexInFloor / 4);
      const posX = col * 170 + 40;
      const posY = row * 170 + 40;

      await appPool.query(
        `UPDATE pos_tables SET position_x = ?, position_y = ? WHERE id = ? AND position_x = 50 AND position_y = 50`,
        [posX, posY, t.id]
      );
      indexInFloor++;
    }
  } catch (err) {
    console.warn('Notice distributing tables:', err.message);
  }

  console.log('✅ [Floor Plan Migration] Migration finished successfully.');
}

module.exports = { migrateFloorPlan };

if (require.main === module) {
  migrateFloorPlan().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
