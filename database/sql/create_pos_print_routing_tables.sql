-- ======================================================
-- POS Print Routing System Schema
-- ======================================================
-- هذا الملف ينشئ جداول نظام توجيه الطباعة للأوردرات

USE kitchen_inventory;

-- 1) محطات التحضير والطابعات
CREATE TABLE IF NOT EXISTS pos_stations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  station_code VARCHAR(50) NOT NULL UNIQUE,   -- مثال: CASHIER, EXPO, BAR, SUSHI
  station_name VARCHAR(100) NOT NULL,         -- الاسم المعروض
  station_type ENUM('cashier', 'expo', 'kitchen') NOT NULL DEFAULT 'kitchen',
  printer_ip VARCHAR(45) NOT NULL,            -- يدعم IPv4 و IPv6
  printer_port INT NOT NULL DEFAULT 9100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_station_type (station_type),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) الأصناف وربطها بمحطات التحضير
CREATE TABLE IF NOT EXISTS pos_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  station_id INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pos_items_station FOREIGN KEY (station_id) REFERENCES pos_stations(id) ON DELETE RESTRICT,
  INDEX idx_station_id (station_id),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) الطلب الرئيسي
CREATE TABLE IF NOT EXISTS pos_orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  table_no VARCHAR(30) NOT NULL,
  guest_count INT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_table_no (table_no),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4) تفاصيل أصناف الطلب
CREATE TABLE IF NOT EXISTS pos_order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  item_id INT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  notes VARCHAR(255) NULL,
  station_id INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pos_order_items_order FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_pos_order_items_station FOREIGN KEY (station_id) REFERENCES pos_stations(id) ON DELETE SET NULL,
  INDEX idx_order_id (order_id),
  INDEX idx_station_id (station_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5) سجل حالة الطباعة لكل طابعة
CREATE TABLE IF NOT EXISTS pos_print_jobs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  station_id INT NOT NULL,
  ticket_type ENUM('cashier', 'expo', 'station') NOT NULL,
  status ENUM('success', 'failed') NOT NULL,
  error_message TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pos_print_jobs_order FOREIGN KEY (order_id) REFERENCES pos_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_pos_print_jobs_station FOREIGN KEY (station_id) REFERENCES pos_stations(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6) إعدادات الطباعة العامة
CREATE TABLE IF NOT EXISTS pos_print_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value VARCHAR(255) NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- بيانات افتراضية للمحطات
INSERT INTO pos_stations (station_code, station_name, station_type, printer_ip, printer_port)
VALUES
  ('CASHIER', 'الكاشير', 'cashier', '192.168.1.100', 9100),
  ('EXPO', 'الكنترول (التجميع)', 'expo', '192.168.1.101', 9100),
  ('BAR', 'قسم المشروبات والبار', 'kitchen', '192.168.1.102', 9100),
  ('SUSHI', 'قسم السوشي', 'kitchen', '192.168.1.103', 9100)
ON DUPLICATE KEY UPDATE
  station_name = VALUES(station_name),
  station_type = VALUES(station_type),
  printer_ip = VALUES(printer_ip),
  printer_port = VALUES(printer_port),
  is_active = TRUE;

-- إعدادات طباعة افتراضية
INSERT INTO pos_print_settings (setting_key, setting_value)
VALUES
  ('paper_width_mm', '80'),
  ('font_family', 'A'),
  ('font_scale', '1'),
  ('header_font_scale', '2'),
  ('chars_per_line', '48'),
  ('print_copies', '1'),
  ('cut_paper', 'true'),
  ('open_cash_drawer', 'false'),
  ('printer_timeout_ms', '7000')
ON DUPLICATE KEY UPDATE
  setting_value = VALUES(setting_value);
