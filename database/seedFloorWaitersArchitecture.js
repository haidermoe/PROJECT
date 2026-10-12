const { authPool } = require('./authConnection');
const { appPool } = require('./appConnection');

async function syncAssignments() {
  const [waiters] = await authPool.query("SELECT id, full_name, username FROM users WHERE role = 'waiter' OR id IN (3, 6) ORDER BY id ASC");
  const [floors] = await appPool.query("SELECT id, name FROM pos_floors ORDER BY sequence ASC, id ASC");
  const today = new Date().toISOString().slice(0, 10);
  const shifts = ['صباحي (08:00 - 16:00)', 'مسائي (16:00 - 00:00)', 'شفت كامل (12:00 - 23:00)'];

  console.log('Total Waiters:', waiters.length);
  console.log('Total Floors/Sections:', floors.length);

  for (let i = 0; i < floors.length; i++) {
    const f = floors[i];
    const w = waiters[i % waiters.length];
    const shift = shifts[i % shifts.length];

    await appPool.query(
      'UPDATE pos_floors SET active_waiter_id = ?, active_waiter_name = ?, active_shift = ? WHERE id = ?',
      [w.id, w.full_name, shift, f.id]
    );

    await appPool.query(
      'INSERT INTO pos_floor_waiter_assignments (floor_id, user_id, waiter_name, shift_name, shift_date, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [f.id, w.id, w.full_name, shift, today]
    );
  }

  // إضافة طاولات معمارية وعناصر ديكورية إذا كانت الأقسام فارغة
  for (const f of floors) {
    const [existingTables] = await appPool.query('SELECT COUNT(*) AS cnt FROM pos_tables WHERE floor_id = ?', [f.id]);
    if (existingTables[0].cnt === 0) {
      // إضافة 4 إلى 6 طاولات متنوعة هندسياً مع دوران ومقاعد
      const sampleTables = [
        { num: 'T1', seats: 2, shape: 'round', x: 80, y: 80, w: 90, h: 90 },
        { num: 'T2', seats: 4, shape: 'square', x: 240, y: 80, w: 100, h: 100 },
        { num: 'T3', seats: 6, shape: 'rectangle', x: 420, y: 80, w: 160, h: 100 },
        { num: 'T4', seats: 4, shape: 'square', x: 80, y: 260, w: 100, h: 100 },
        { num: 'T5', seats: 8, shape: 'rectangle', x: 260, y: 260, w: 180, h: 110 },
        { num: 'VIP-1', seats: 10, shape: 'rectangle', x: 500, y: 260, w: 200, h: 120 }
      ];
      for (const st of sampleTables) {
        await appPool.query(
          `INSERT INTO pos_tables (floor_id, table_number, seats, shape, position_x, position_y, width, height, status, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', 1)`,
          [f.id, st.num, st.seats, st.shape, st.x, st.y, st.w, st.h]
        );
      }
    }

    // إضافة عناصر معمارية واقعية للسكشن (كاونتر، محطة ويتر، باب، جدار)
    const [existingElements] = await appPool.query('SELECT COUNT(*) AS cnt FROM pos_floor_elements WHERE floor_id = ?', [f.id]);
    if (existingElements[0].cnt === 0) {
      const elements = [
        { type: 'service_station', name: 'محطة خدمة الويتر (Service Station)', x: 740, y: 60, w: 140, h: 70, rot: 0, color: '#3b82f6' },
        { type: 'cashier', name: 'كاونتر الحسابات والكاشير (POS)', x: 740, y: 160, w: 140, h: 60, rot: 0, color: '#10b981' },
        { type: 'bar', name: 'بار المشروبات والقهوة (Bar Station)', x: 740, y: 250, w: 150, h: 80, rot: 0, color: '#8b5cf6' },
        { type: 'door', name: 'مدخل الصالة الرئيسي (Entrance)', x: 30, y: 10, w: 90, h: 16, rot: 0, color: '#f59e0b' },
        { type: 'wall', name: 'جدار فاصل معزول (Partition Wall)', x: 30, y: 200, w: 10, h: 180, rot: 0, color: '#64748b' }
      ];
      for (const el of elements) {
        await appPool.query(
          `INSERT INTO pos_floor_elements (floor_id, element_type, name, position_x, position_y, width, height, rotation, color)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [f.id, el.type, el.name, el.x, el.y, el.w, el.h, el.rot, el.color]
        );
      }
    }
  }

  console.log('✅ Synchronized all 10 sections, waiters, tables, and architectural elements.');
  process.exit(0);
}

syncAssignments().catch(e => {
  console.error(e);
  process.exit(1);
});
