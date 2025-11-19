-- تحديثات قاعدة البيانات لنظام الصلاحيات والموافقات

USE kitchen_inventory;

-- إضافة عمود للوصفات: visible_to_employees (هل مرئية للموظفين)
ALTER TABLE recipes 
ADD COLUMN visible_to_employees TINYINT(1) DEFAULT 0 AFTER description,
ADD COLUMN status ENUM('draft', 'active', 'pending_approval') DEFAULT 'active' AFTER visible_to_employees;

-- جدول طلبات الموافقة على تعديل الوصفات
CREATE TABLE IF NOT EXISTS recipe_approval_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT NOT NULL,
  requested_by INT NOT NULL,
  changes_data TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول صلاحيات الوصفات للموظفين
CREATE TABLE IF NOT EXISTS recipe_employee_permissions (
  recipe_id INT NOT NULL,
  employee_id INT NOT NULL,
  can_view TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recipe_id, employee_id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

