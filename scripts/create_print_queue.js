const { appPool } = require('../database/appConnection');

async function main() {
  try {
    await appPool.query(`
      CREATE TABLE IF NOT EXISTS pos_print_queue (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id BIGINT NOT NULL,
        station_id INT NOT NULL,
        ticket_type VARCHAR(50) NOT NULL,
        status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
        retry_count INT DEFAULT 0,
        last_error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_order (order_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Created pos_print_queue table successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating pos_print_queue:', err);
    process.exit(1);
  }
}

main();
