const { appPool } = require('./database/appConnection');
const fs = require('fs');

async function run() {
  const sql = fs.readFileSync('./database/sql/alter_pos_print_resilience.sql', 'utf8');
  const queries = sql.split(';').map(q => q.trim()).filter(Boolean);
  
  for (const query of queries) {
    try {
      await appPool.query(query);
      console.log('Success:', query.substring(0, 50) + '...');
    } catch (err) {
      console.log('Error or already exists:', err.message);
    }
  }
  process.exit();
}

run();
