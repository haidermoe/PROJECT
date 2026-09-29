-- ======================================================
-- Kitchen Intelligence Schema: Raw vs Manufactured Materials & Requisitions
-- ======================================================
USE kitchen_inventory;

-- 1) تمييز المواد الأولية الخام عن المواد المصنعة/المحضرة مسبقاً
ALTER TABLE ingredients 
  ADD COLUMN IF NOT EXISTS material_type ENUM('raw', 'manufactured') NOT NULL DEFAULT 'raw',
  ADD COLUMN IF NOT EXISTS recipe_id INT NULL;

-- 2) جدول طلبات صرف العهد التشغيلية وموافقات مدير المطبخ
CREATE TABLE IF NOT EXISTS station_transfer_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  station_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  coverage_summary TEXT NULL,
  requested_by INT NULL,
  approved_by INT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  notes VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_str_station FOREIGN KEY (station_id) REFERENCES pos_stations(id) ON DELETE CASCADE,
  CONSTRAINT fk_str_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
  INDEX idx_str_status (status),
  INDEX idx_str_station (station_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
