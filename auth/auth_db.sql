CREATE DATABASE IF NOT EXISTS auth_db
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
