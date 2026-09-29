-- ======================================================
-- Station & Section Inventory Schema (مخزون السكاشن والعهد التشغيلية)
-- ======================================================
USE kitchen_inventory;

-- 1) رصيد المواد في كل سكشن / محطة
CREATE TABLE IF NOT EXISTS station_inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  station_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  min_qty DECIMAL(12,3) NOT NULL DEFAULT 2.000,
  last_assigned_user_id INT NULL,
  last_transferred_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_st_inv_station FOREIGN KEY (station_id) REFERENCES pos_stations(id) ON DELETE CASCADE,
  CONSTRAINT fk_st_inv_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  UNIQUE KEY uq_station_ingredient (station_id, ingredient_id),
  INDEX idx_st_inv_station (station_id),
  INDEX idx_st_inv_ingredient (ingredient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) حركات مخزون السكاشن (تحويلات، استهلاك أوردرات، هدر)
CREATE TABLE IF NOT EXISTS station_stock_moves (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  station_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  user_id INT NULL,
  type ENUM('transfer_in', 'order_consumption', 'waste_loss', 'adjustment') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  ref_order_id BIGINT NULL,
  ref_waste_id INT NULL,
  notes VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_st_move_station (station_id),
  INDEX idx_st_move_ingredient (ingredient_id),
  INDEX idx_st_move_type (type),
  INDEX idx_st_move_order (ref_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) ربط أصناف المنيو بكروت الوصفات
ALTER TABLE pos_items ADD COLUMN IF NOT EXISTS recipe_id INT NULL;

-- 4) ربط سجلات الهدر بالسكشن لتحديد من أي سكشن تم الهدر
ALTER TABLE waste_records ADD COLUMN IF NOT EXISTS station_id INT NULL;
ALTER TABLE waste_records ADD COLUMN IF NOT EXISTS deducted_from ENUM('station', 'main_store') DEFAULT 'station';
