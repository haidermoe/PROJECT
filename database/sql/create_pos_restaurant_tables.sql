-- ======================================================
-- Odoo-Standard POS Restaurant Tables & Floor Plan Schema
-- ======================================================
USE kitchen_inventory;

-- 1) طوابق وصالات المطعم (Restaurant Floors)
CREATE TABLE IF NOT EXISTS pos_floors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,            -- اسم الصالة: الصالة الرئيسية، العوائل، التراس، VIP
  sequence INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_floor_sequence (sequence)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) طاولات المطعم (Restaurant Tables)
CREATE TABLE IF NOT EXISTS pos_tables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  floor_id INT NOT NULL,
  table_number VARCHAR(50) NOT NULL,      -- رقم أو اسم الطاولة: T1, T2, VIP-1
  seats INT NOT NULL DEFAULT 4,           -- سعة الطاولة (عدد المقاعد)
  status ENUM('available', 'occupied', 'billed') NOT NULL DEFAULT 'available',
  current_order_id BIGINT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_table_floor FOREIGN KEY (floor_id) REFERENCES pos_floors(id) ON DELETE CASCADE,
  INDEX idx_table_floor (floor_id),
  INDEX idx_table_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) تحديث وتوسيع جدول الطلبات pos_orders لدعم حالة الويتر وطريقة الدفع
ALTER TABLE pos_orders 
  ADD COLUMN IF NOT EXISTS status ENUM('draft', 'ordered', 'billed', 'paid', 'cancelled') NOT NULL DEFAULT 'ordered',
  ADD COLUMN IF NOT EXISTS floor_id INT NULL,
  ADD COLUMN IF NOT EXISTS table_id INT NULL,
  ADD COLUMN IF NOT EXISTS waiter_id INT NULL,
  ADD COLUMN IF NOT EXISTS waiter_name VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL;

-- 4) إضافة صالات وطاولات افتراضية إذا لم تكن موجودة
INSERT IGNORE INTO pos_floors (id, name, sequence) VALUES
(1, 'الصالة الرئيسية (Main Dining)', 1),
(2, 'قسم العوائل (Family Section)', 2),
(3, 'التراس والحديقة الخارجية (Terrace)', 3),
(4, 'صالات VIP الخاصة', 4);

INSERT IGNORE INTO pos_tables (floor_id, table_number, seats) VALUES
(1, 'طاولة 1', 4),
(1, 'طاولة 2', 4),
(1, 'طاولة 3', 6),
(1, 'طاولة 4', 2),
(1, 'طاولة 5', 8),
(2, 'عائلة 1', 6),
(2, 'عائلة 2', 6),
(2, 'عائلة 3', 8),
(3, 'تراس 1', 4),
(3, 'تراس 2', 4),
(4, 'VIP 1', 10);
