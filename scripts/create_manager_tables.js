const mysql = require('mysql2/promise');
require('dotenv').config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_NAME || 'kitchen_inventory'
  });

  console.log('Creating audit_trails...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_trails (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      action_type VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100) NOT NULL,
      entity_id INT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('Creating z_reports...');
  await connection.query(`
    CREATE TABLE IF NOT EXISTS z_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_date DATE NOT NULL,
      generated_by INT,
      theoretical_stock DECIMAL(12,3) NOT NULL,
      actual_stock DECIMAL(12,3) NOT NULL,
      variance DECIMAL(12,3) NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('Tables created!');
  await connection.end();
}

run().catch(console.error);
