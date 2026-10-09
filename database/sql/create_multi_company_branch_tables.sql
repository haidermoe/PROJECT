-- ======================================================
-- Multi-Company & Multi-Branch Consolidation Schema
-- نظام تعدد الشركات والفروع والمحاسبة والمخازن المجمعة (Odoo 19 Standard)
-- ======================================================
USE kitchen_inventory;

-- 1) جدول الفروع والشركات التابعة
CREATE TABLE IF NOT EXISTS branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(150) NOT NULL DEFAULT 'مجموعة المطاعم القابضة',
  branch_name VARCHAR(150) NOT NULL,
  branch_code VARCHAR(30) NOT NULL UNIQUE,
  currency VARCHAR(10) NOT NULL DEFAULT 'IQD',
  is_headquarters BOOLEAN NOT NULL DEFAULT FALSE,
  phone VARCHAR(50) NULL,
  address VARCHAR(255) NULL,
  manager_name VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_branch_code (branch_code),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) جدول التحويلات واللوجستيات بين الفروع (Inter-Branch Transfers)
CREATE TABLE IF NOT EXISTS inter_branch_transfers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transfer_number VARCHAR(64) NOT NULL UNIQUE,
  from_branch_id INT NOT NULL,
  to_branch_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  status ENUM('pending', 'in_transit', 'received', 'cancelled') NOT NULL DEFAULT 'in_transit',
  notes TEXT NULL,
  shipped_by INT NULL,
  received_by INT NULL,
  shipped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  received_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ibt_status (status),
  INDEX idx_ibt_from (from_branch_id),
  INDEX idx_ibt_to (to_branch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
