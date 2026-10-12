/**
 * ======================================================
 * Migration: Architectural Floor Elements & Waiter Shift Assignments
 * نظام التوزيع المعماري الهندسي للصالة وتكليف الويترية بالشفتات
 * ======================================================
 */
require('dotenv').config();
const { appPool } = require('./appConnection');

async function runMigration() {
  console.log('🔄 [Architectural Floor & Waiter Migration] Starting...');

  // 1. جدول تكليف وتوزيع الويترية على السكاشن والشفتات
  await appPool.query(`
    CREATE TABLE IF NOT EXISTS pos_floor_waiter_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      floor_id INT NOT NULL,
      user_id INT NOT NULL,
      waiter_name VARCHAR(150) NOT NULL,
      shift_name VARCHAR(50) DEFAULT 'صباحي',
      shift_date DATE NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      assigned_by INT NULL,
      notes VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_floor_date (floor_id, shift_date, is_active),
      INDEX idx_waiter (user_id, shift_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Created pos_floor_waiter_assignments table');

  // 2. جدول العناصر المعمارية للصالة (جدران، أبواب، كاونترات، كراسي، محطات خدمة)
  await appPool.query(`
    CREATE TABLE IF NOT EXISTS pos_floor_elements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      floor_id INT NOT NULL,
      element_type ENUM('wall', 'door', 'window', 'bar', 'service_station', 'cashier', 'pillar', 'plant', 'sofa') NOT NULL,
      name VARCHAR(100) NULL,
      position_x INT NOT NULL DEFAULT 50,
      position_y INT NOT NULL DEFAULT 50,
      width INT NOT NULL DEFAULT 100,
      height INT NOT NULL DEFAULT 20,
      rotation INT NOT NULL DEFAULT 0,
      color VARCHAR(30) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_floor_elements (floor_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✅ Created pos_floor_elements table');

  // 3. إضافة أعمدة إضافية للصالات والطاولات
  const alterQueries = [
    "ALTER TABLE pos_floors ADD COLUMN active_waiter_id INT NULL",
    "ALTER TABLE pos_floors ADD COLUMN active_waiter_name VARCHAR(150) NULL",
    "ALTER TABLE pos_floors ADD COLUMN active_shift VARCHAR(50) DEFAULT 'صباحي'",
    "ALTER TABLE pos_tables ADD COLUMN rotation INT NOT NULL DEFAULT 0",
    "ALTER TABLE pos_tables ADD COLUMN assigned_waiter_id INT NULL",
    "ALTER TABLE pos_tables ADD COLUMN assigned_waiter_name VARCHAR(150) NULL"
  ];

  for (const q of alterQueries) {
    try {
      await appPool.query(q);
    } catch (e) {
      // العمود موجود مسبقاً
    }
  }
  console.log('✅ Altered pos_floors & pos_tables successfully');

  // 4. إذا لم يكن هناك تكليفات حالية، ربط تجريبي مبدئي للويتر مع أول صالة
  try {
    const [existing] = await appPool.query('SELECT COUNT(*) AS cnt FROM pos_floor_waiter_assignments');
    if (existing[0].cnt === 0) {
      const [floors] = await appPool.query('SELECT id, name FROM pos_floors ORDER BY id ASC LIMIT 5');
      const today = new Date().toISOString().slice(0, 10);
      for (let i = 0; i < floors.length; i++) {
        const f = floors[i];
        const waiterName = i % 2 === 0 ? 'علي حسن (كابتن ويتر)' : 'يوسف الكاشير';
        const waiterId = i % 2 === 0 ? 3 : 6;
        const shift = i % 2 === 0 ? 'صباحي' : 'مسائي';
        await appPool.query(`
          INSERT INTO pos_floor_waiter_assignments (floor_id, user_id, waiter_name, shift_name, shift_date, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `, [f.id, waiterId, waiterName, shift, today]);

        await appPool.query(`
          UPDATE pos_floors SET active_waiter_id = ?, active_waiter_name = ?, active_shift = ? WHERE id = ?
        `, [waiterId, waiterName, shift, f.id]);
      }
      console.log('✅ Seeded initial waiter assignments');
    }
  } catch (seedErr) {
    console.warn('Notice seeding waiter assignments:', seedErr.message);
  }

  console.log('🎉 [Architectural Floor & Waiter Migration] Finished successfully!');
}

runMigration().then(() => process.exit(0)).catch(e => {
  console.error('❌ Migration failed:', e);
  process.exit(1);
});
