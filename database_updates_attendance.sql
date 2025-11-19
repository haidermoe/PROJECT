-- ======================================================
-- تحديثات قاعدة البيانات لنظام البصمة
-- ======================================================

USE kitchen_inventory;

-- ======================================================
-- جدول البصمات (Attendance/Check-in/Check-out)
-- ======================================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL COMMENT 'رقم الموظف',
  check_in_time DATETIME NOT NULL COMMENT 'وقت الدخول',
  check_out_time DATETIME NULL COMMENT 'وقت الخروج',
  work_hours DECIMAL(5,2) NULL COMMENT 'عدد ساعات العمل (بالساعات)',
  check_in_location VARCHAR(255) NULL COMMENT 'موقع الدخول (GPS)',
  check_out_location VARCHAR(255) NULL COMMENT 'موقع الخروج (GPS)',
  status ENUM('checked_in', 'checked_out') DEFAULT 'checked_in' COMMENT 'حالة البصمة',
  notes TEXT NULL COMMENT 'ملاحظات',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_check_in_time (check_in_time),
  INDEX idx_check_out_time (check_out_time),
  INDEX idx_status (status),
  INDEX idx_date (DATE(check_in_time))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='جدول سجلات البصمة';

