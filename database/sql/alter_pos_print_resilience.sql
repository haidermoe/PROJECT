USE kitchen_inventory;

-- إضافة معرف الطابعة البديلة
ALTER TABLE pos_stations 
ADD COLUMN fallback_station_id INT NULL AFTER printer_port;

ALTER TABLE pos_stations 
ADD CONSTRAINT fk_pos_stations_fallback 
FOREIGN KEY (fallback_station_id) REFERENCES pos_stations(id) ON DELETE SET NULL;

-- إنشاء جدول طابور الطباعة لعمليات المعالجة الخلفية
CREATE TABLE IF NOT EXISTS pos_print_queue (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  station_id INT NOT NULL,
  ticket_type ENUM('cashier', 'expo', 'station') NOT NULL,
  status ENUM('pending', 'success', 'failed_permanently') NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  last_error_message TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pos_print_queue_order FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_pos_print_queue_station FOREIGN KEY (station_id) REFERENCES pos_stations(id) ON DELETE CASCADE,
  INDEX idx_queue_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
