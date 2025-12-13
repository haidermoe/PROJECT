-- ======================================================
-- جداول نظام جداول الدوام (Shifts Schedules)
-- ======================================================

USE kitchen_inventory;

-- جدول جداول الدوام
CREATE TABLE IF NOT EXISTS shifts_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  week_start_date DATE NOT NULL COMMENT 'تاريخ بداية الأسبوع (السبت)',
  week_end_date DATE NOT NULL COMMENT 'تاريخ نهاية الأسبوع (الجمعة)',
  created_by INT NOT NULL COMMENT 'المسؤول الذي أنشأ الجدول (kitchen_manager)',
  status ENUM('draft', 'pending_approval', 'approved', 'rejected', 'published') DEFAULT 'draft',
  approved_by INT NULL COMMENT 'المدير العام الذي وافق على الجدول',
  approved_at DATETIME NULL,
  rejected_reason TEXT NULL,
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_week_start (week_start_date),
  INDEX idx_status (status),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci;

-- جدول تفاصيل الدوام (للأيام والموظفين)
CREATE TABLE IF NOT EXISTS shift_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  user_id INT NOT NULL COMMENT 'ID الموظف من auth_db',
  day_of_week ENUM('saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday') NOT NULL,
  shift_date DATE NOT NULL COMMENT 'تاريخ اليوم الفعلي',
  start_time TIME NOT NULL COMMENT 'وقت بداية الدوام (HH:MM)',
  end_time TIME NOT NULL COMMENT 'وقت نهاية الدوام (HH:MM)',
  break_duration INT DEFAULT 0 COMMENT 'مدة الاستراحة بالدقائق',
  notes TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES shifts_schedules(id) ON DELETE CASCADE,
  INDEX idx_schedule_id (schedule_id),
  INDEX idx_user_id (user_id),
  INDEX idx_shift_date (shift_date),
  UNIQUE KEY unique_shift (schedule_id, user_id, shift_date)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci;

-- جدول الموافقات على جداول الدوام
CREATE TABLE IF NOT EXISTS schedule_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  requested_by INT NOT NULL COMMENT 'المسؤول الذي طلب الموافقة',
  approved_by INT NULL COMMENT 'المدير العام الذي وافق',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approval_notes TEXT NULL,
  rejection_reason TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME NULL,
  FOREIGN KEY (schedule_id) REFERENCES shifts_schedules(id) ON DELETE CASCADE,
  INDEX idx_schedule_id (schedule_id),
  INDEX idx_status (status)
) ENGINE=InnoDB 
DEFAULT CHARSET=utf8mb4 
COLLATE=utf8mb4_unicode_ci;

