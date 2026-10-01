-- ======================================================================
-- 1. جدول دفعات التحضير والإنتاج (Prep Batches)
-- ======================================================================
CREATE TABLE IF NOT EXISTS `prep_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_number` VARCHAR(50) NOT NULL UNIQUE,
  `recipe_id` INT NULL,
  `ingredient_id` INT NOT NULL,
  `planned_portions` INT NOT NULL,
  `portion_size` DECIMAL(10,3) NOT NULL,
  `total_yield` DECIMAL(10,3) NOT NULL,
  `unit` VARCHAR(30) NOT NULL DEFAULT 'علبة',
  `prepared_by` INT NULL,
  `branch_id` INT NOT NULL DEFAULT 1,
  `shelf_life_days` INT NOT NULL DEFAULT 7,
  `expiry_date` DATE NULL,
  `notes` VARCHAR(255) NULL,
  `status` ENUM('active', 'depleted', 'expired') DEFAULT 'active',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_batch_num` (`batch_number`),
  INDEX `idx_batch_branch` (`branch_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ======================================================================
-- 2. جدول ملصقات العلب والبورشنات الفردية (Prep Batch Items / Labels)
-- ======================================================================
CREATE TABLE IF NOT EXISTS `prep_batch_items` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT NOT NULL,
  `label_code` VARCHAR(100) NOT NULL UNIQUE,
  `portion_number` INT NOT NULL,
  `portion_qty` DECIMAL(10,3) NOT NULL,
  `status` ENUM('in_stock', 'at_station', 'consumed', 'wasted') DEFAULT 'in_stock',
  `current_station_id` INT NULL,
  `transferred_at` DATETIME NULL,
  `transferred_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_label_code` (`label_code`),
  INDEX `idx_item_station` (`current_station_id`, `status`),
  CONSTRAINT `fk_batch_item_batch` FOREIGN KEY (`batch_id`) REFERENCES `prep_batches`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ======================================================================
-- 3. جدول جلسات جرد ومطابقة السكاشن (Station Shift Audits)
-- ======================================================================
CREATE TABLE IF NOT EXISTS `station_audits` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `station_id` INT NOT NULL,
  `branch_id` INT NOT NULL DEFAULT 1,
  `audit_date` DATE NOT NULL,
  `shift_name` VARCHAR(50) NOT NULL DEFAULT 'الشفت المسائي',
  `chef_user_id` INT NULL,
  `manager_user_id` INT NULL,
  `status` ENUM('pending', 'matched', 'has_variance', 'approved', 'rejected') DEFAULT 'pending',
  `manager_notes` TEXT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_audit_station_date` (`station_id`, `audit_date`),
  INDEX `idx_audit_branch` (`branch_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ======================================================================
-- 4. تفاصيل أصناف المطابقة ومبيعات الويترية (Station Audit Lines)
-- ======================================================================
CREATE TABLE IF NOT EXISTS `station_audit_lines` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `audit_id` INT NOT NULL,
  `ingredient_id` INT NOT NULL,
  `opening_qty` DECIMAL(12,3) NOT NULL DEFAULT 0,
  `transferred_in_qty` DECIMAL(12,3) NOT NULL DEFAULT 0,
  `consumed_qty` DECIMAL(12,3) NOT NULL DEFAULT 0,
  `waste_qty` DECIMAL(12,3) NOT NULL DEFAULT 0,
  `theoretical_qty` DECIMAL(12,3) NOT NULL DEFAULT 0,
  `actual_qty` DECIMAL(12,3) NULL,
  `variance_qty` DECIMAL(12,3) NULL,
  `is_matched` TINYINT(1) NOT NULL DEFAULT 0,
  `chef_explanation` TEXT NULL,
  `waiter_breakdown` JSON NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_line_audit` (`audit_id`),
  INDEX `idx_line_ingredient` (`ingredient_id`),
  CONSTRAINT `fk_audit_line_audit` FOREIGN KEY (`audit_id`) REFERENCES `station_audits`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
