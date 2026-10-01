const { authPool } = require('../database/authConnection');

async function main() {
  try {
    console.log('🔄 Updating enum definition of role in users...');
    await authPool.query(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('admin','manager','kitchen_manager','employee','waiter','hr') NOT NULL DEFAULT 'employee'
    `);
    console.log('✅ Altered role column enum');

    await authPool.query("UPDATE users SET role = 'waiter' WHERE username = 'waiter'");
    const [users] = await authPool.query('SELECT id, username, role FROM users');
    console.log('✅ Users updated successfully:', users);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating waiter role:', err);
    process.exit(1);
  }
}

main();
