const bcrypt = require('bcrypt');
const { authPool } = require('../database/authConnection');

async function setupUsers() {
  console.log('🔄 Setting up login credentials in auth_db...');

  const hashAdmin = await bcrypt.hash('admin123', 10);
  const hashChef = await bcrypt.hash('chef123', 10);
  const hashWaiter = await bcrypt.hash('waiter123', 10);

  // 1. Admin
  await authPool.query(
    "INSERT INTO users (id, username, password, role, full_name, is_active) VALUES (1, 'admin', ?, 'admin', 'المدير العام', 1) ON DUPLICATE KEY UPDATE password = ?, is_active = 1",
    [hashAdmin, hashAdmin]
  );

  // 2. Kitchen Manager / Chef
  const [chefExists] = await authPool.query("SELECT id FROM users WHERE username = 'chef'");
  if (chefExists.length > 0) {
    await authPool.query("UPDATE users SET password = ?, role = 'kitchen_manager', is_active = 1 WHERE username = 'chef'", [hashChef]);
  } else {
    await authPool.query(
      "INSERT INTO users (username, password, role, full_name, is_active) VALUES ('chef', ?, 'kitchen_manager', 'الشيف حيدر - مدير المطبخ', 1)",
      [hashChef]
    );
  }

  // 3. Waiter / Employee
  const [waiterExists] = await authPool.query("SELECT id FROM users WHERE username = 'waiter'");
  if (waiterExists.length > 0) {
    await authPool.query("UPDATE users SET password = ?, role = 'employee', is_active = 1 WHERE username = 'waiter'", [hashWaiter]);
  } else {
    await authPool.query(
      "INSERT INTO users (username, password, role, full_name, is_active) VALUES ('waiter', ?, 'employee', 'الويتر علي', 1)",
      [hashWaiter]
    );
  }

  const [all] = await authPool.query('SELECT id, username, role, full_name, is_active FROM users');
  console.log('✅ All Configured Users:');
  all.forEach(u => console.log(`  - Username: [${u.username}] | Role: ${u.role} | Name: ${u.full_name}`));

  process.exit(0);
}

setupUsers().catch(err => {
  console.error('❌ Error setting up users:', err);
  process.exit(1);
});
