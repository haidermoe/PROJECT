/**
 * ==============================================================
 * HR DATABASE SCHEMA (Isolated Employee Management)
 * ==============================================================
 * 
 * Target DB: hr_db
 * 
 * Rules:
 * - This DB is completely isolated from app_db and auth_db.
 * - `user_id` represents the unique ID of the user (from auth_db) as a logical foreign key.
 * - Sensitive fields are padded for application-layer encryption.
 */

-- 1. جدول معلومات الموظفين الأساسية والمالية (Employee Details)
CREATE TABLE IF NOT EXISTS hr_employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE, -- Foreign key equivalent to auth_db.users(id)
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    national_id VARCHAR(255), -- Secure/Encrypted string
    nationality VARCHAR(50),
    job_rank VARCHAR(100) DEFAULT 'Employee',
    base_salary DECIMAL(10, 2) DEFAULT 0.00,
    hourly_rate DECIMAL(10, 2) DEFAULT 0.00,
    hire_date DATE,
    status ENUM('active', 'inactive', 'terminated', 'on_leave') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
);

-- 2. سجلات الحضور والبصمات (Attendance Records)
CREATE TABLE IF NOT EXISTS hr_attendance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    check_in_time DATETIME NOT NULL,
    check_out_time DATETIME,
    check_in_location VARCHAR(255),
    check_out_location VARCHAR(255),
    work_hours DECIMAL(5, 2),
    status ENUM('checked_in', 'checked_out') DEFAULT 'checked_in',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id_date (user_id, check_in_time)
);

-- 3. طلبات وأرصدة الإجازات (Leaves)
CREATE TABLE IF NOT EXISTS hr_leaves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    leave_type ENUM('annual', 'sick', 'unpaid', 'emergency', 'other') NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4,1) NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    approved_by INT NULL, -- user_id of HR/Manager
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id)
);

-- 4. إدارة المستندات الآمنة (Document Management)
CREATE TABLE IF NOT EXISTS hr_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    document_type ENUM('id_card', 'passport', 'medical_report', 'contract', 'certificate', 'other') NOT NULL,
    document_name VARCHAR(255) NOT NULL,
    secure_file_path VARCHAR(500) NOT NULL, -- Encrypted path in application layer
    expiry_date DATE,
    is_verified BOOLEAN DEFAULT FALSE,
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_expiry (expiry_date)
);

-- 5. فترات الرواتب (Payroll Periods)
CREATE TABLE IF NOT EXISTS hr_payroll_periods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    period_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('open', 'processing', 'closed') DEFAULT 'open',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. سجلات الرواتب التفصيلية للموظفين (Payroll Records)
CREATE TABLE IF NOT EXISTS hr_payroll_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    period_id INT NOT NULL,
    user_id INT NOT NULL,
    base_salary DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    scheduled_hours DECIMAL(6, 2) DEFAULT 0.00,
    actual_hours DECIMAL(6, 2) DEFAULT 0.00,
    overtime_hours DECIMAL(6, 2) DEFAULT 0.00,
    shortage_hours DECIMAL(6, 2) DEFAULT 0.00,
    additions DECIMAL(10, 2) DEFAULT 0.00, -- Bonuses
    deductions DECIMAL(10, 2) DEFAULT 0.00, -- Penalties/Taxes
    net_salary DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status ENUM('draft', 'approved', 'paid') DEFAULT 'draft',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_period (period_id, user_id),
    FOREIGN KEY (period_id) REFERENCES hr_payroll_periods(id) ON DELETE CASCADE
);

-- 7. سجلات التدقيق والتتبع (Audit Logs for Security Policy)
CREATE TABLE IF NOT EXISTS hr_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    target_user_id INT NULL,
    performed_by INT NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- 'UPDATE_SALARY', 'DELETE_DOC', etc.
    table_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
