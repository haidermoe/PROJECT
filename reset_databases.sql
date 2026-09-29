-- ======================================================
-- إعادة تعيين قواعد البيانات (حذف وإعادة إنشاء)
-- ======================================================
-- ⚠️ تحذير: هذا السكريبت سيحذف جميع البيانات!
-- استخدمه فقط إذا كنت تريد البدء من جديد

-- حذف قواعد البيانات (إذا كانت موجودة)
DROP DATABASE IF EXISTS kitchen_inventory;
DROP DATABASE IF EXISTS auth_db;

-- إعادة إنشاء قاعدة بيانات المصادقة
CREATE DATABASE auth_db
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

USE auth_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','manager','kitchen_manager','employee') NOT NULL DEFAULT 'employee',
  full_name VARCHAR(100),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

-- إعادة إنشاء قاعدة بيانات التطبيق
CREATE DATABASE kitchen_inventory
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

USE kitchen_inventory;

-- جدول الوصفات (بدون Foreign Key constraint على created_by)
CREATE TABLE recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  item_name VARCHAR(150),
  description TEXT,
  yield VARCHAR(50),
  portions INT,
  shelf_life VARCHAR(100),
  `procedure` TEXT,
  reference VARCHAR(50),
  version VARCHAR(20) DEFAULT '001',
  edition INT DEFAULT 1,
  status ENUM('draft', 'active', 'pending_approval') DEFAULT 'active',
  visible_to_employees TINYINT(1) DEFAULT 0,
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recipe_name (name),
  INDEX idx_item_name (item_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول المكونات
CREATE TABLE ingredients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  stock_quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ingredient_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول مكونات الوصفات (القديم)
CREATE TABLE recipe_ingredients (
  recipe_id INT NOT NULL,
  ingredient_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  PRIMARY KEY (recipe_id, ingredient_id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول مكونات الوصفات (الجديد - Standard Recipe Template)
CREATE TABLE recipe_ingredients_new (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT NOT NULL,
  ingredient_name VARCHAR(200) NOT NULL,
  quantity VARCHAR(100) NOT NULL,
  display_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  INDEX idx_recipe_id (recipe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول المعاملات
CREATE TABLE transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ingredient_id INT NOT NULL,
  user_id INT,
  type ENUM('deposit','withdraw') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  note VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول طلبات الموافقة على تعديل الوصفات
CREATE TABLE recipe_approval_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recipe_id INT NOT NULL,
  requested_by INT NOT NULL,
  changes_data TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  approved_by INT NULL,
  approved_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- جدول صلاحيات الوصفات للموظفين
CREATE TABLE recipe_employee_permissions (
  recipe_id INT NOT NULL,
  employee_id INT NOT NULL,
  can_view TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recipe_id, employee_id),
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT '✅ تم حذف وإعادة إنشاء قواعد البيانات بنجاح!' AS result;

