CREATE DATABASE IF NOT EXISTS attendance_management;
USE attendance_management;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS holidays;
DROP TABLE IF EXISTS biometric_events;
DROP TABLE IF EXISTS attendance_alerts;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS app_usage_logs;
DROP TABLE IF EXISTS attendance_logs;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS departments;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sections (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  department_id INT NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sections_department_id (department_id),
  CONSTRAINT fk_sections_department FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_code VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(140) NOT NULL,
  section_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_employees_section_id (section_id),
  CONSTRAINT fk_employee_section FOREIGN KEY (section_id) REFERENCES sections(id)
);

CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NULL UNIQUE,
  username VARCHAR(80) UNIQUE NOT NULL,
  role ENUM('ADMIN', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
  password_salt VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_first_login TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE password_reset_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  generated_by_user_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_reset_generator FOREIGN KEY (generated_by_user_id) REFERENCES users(id),
  UNIQUE KEY uq_token_hash (token_hash),
  INDEX idx_reset_user_expiry (user_id, expires_at),
  INDEX idx_reset_expiry_used (expires_at, used_at)
);

CREATE TABLE holidays (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(140) NOT NULL,
  holiday_date DATE NULL,
  holiday_type ENUM('DATE', 'WEEKDAY') NOT NULL DEFAULT 'DATE',
  weekday TINYINT NULL COMMENT 'MySQL DAYOFWEEK: 1=Sunday ... 7=Saturday',
  recurring_yearly TINYINT(1) NOT NULL DEFAULT 0,
  is_system_default TINYINT(1) NOT NULL DEFAULT 0,
  created_by_user_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_holiday_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id),
  CONSTRAINT chk_holiday_date_or_weekday CHECK (
    (holiday_type = 'DATE' AND holiday_date IS NOT NULL AND weekday IS NULL)
    OR
    (holiday_type = 'WEEKDAY' AND holiday_date IS NULL AND weekday BETWEEN 1 AND 7)
  ),
  UNIQUE KEY uq_holiday_date_title (holiday_date, title),
  UNIQUE KEY uq_holiday_weekday (holiday_type, weekday),
  INDEX idx_holiday_date (holiday_date),
  INDEX idx_holiday_active (is_active)
);

DELIMITER $$
CREATE TRIGGER trg_holidays_prevent_delete_system
BEFORE DELETE ON holidays
FOR EACH ROW
BEGIN
  IF OLD.is_system_default = 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'System default holiday cannot be deleted';
  END IF;
END$$

CREATE TRIGGER trg_holidays_prevent_update_system
BEFORE UPDATE ON holidays
FOR EACH ROW
BEGIN
  IF OLD.is_system_default = 1 AND (
      NEW.holiday_type <> OLD.holiday_type
      OR IFNULL(NEW.weekday, -1) <> IFNULL(OLD.weekday, -1)
      OR IFNULL(NEW.holiday_date, '1000-01-01') <> IFNULL(OLD.holiday_date, '1000-01-01')
      OR NEW.is_system_default <> OLD.is_system_default
    ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'System default holiday core fields cannot be modified';
  END IF;
END$$
DELIMITER ;

CREATE TABLE attendance_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  in_time CHAR(5),
  out_time CHAR(5),
  break_start CHAR(5),
  break_end CHAR(5),
  work_minutes INT DEFAULT 0,
  idle_minutes INT DEFAULT 0,
  status ENUM('PRESENT','ABSENT') DEFAULT 'PRESENT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  UNIQUE KEY uq_attendance_employee_date (employee_id, attendance_date)
);

CREATE TABLE attendance_alerts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  alert_date DATE NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  severity ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW',
  detail VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_alert_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  UNIQUE KEY uniq_employee_alert (employee_id, alert_date, alert_type),
  INDEX idx_alert_date (alert_date)
);

CREATE TABLE app_usage_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_id INT NOT NULL,
  usage_date DATE NOT NULL,
  app_name VARCHAR(180) NOT NULL,
  duration_minutes DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usage_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
  INDEX idx_usage_emp_date (employee_id, usage_date)
);

CREATE TABLE biometric_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  employee_code VARCHAR(50) NOT NULL,
  scanner_id VARCHAR(80),
  punch_type VARCHAR(40),
  device_timestamp DATETIME NOT NULL,
  payload JSON,
  payload_encrypted LONGTEXT,
  source_type VARCHAR(40) NOT NULL DEFAULT 'biometric',
  source_ref VARCHAR(120),
  ingested_by VARCHAR(80),
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_employee_time (employee_code, device_timestamp),
  INDEX idx_source_type (source_type)
);

CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  service_name VARCHAR(80) NOT NULL,
  request_id VARCHAR(80),
  actor_user_id VARCHAR(80),
  actor_role VARCHAR(40),
  actor_username VARCHAR(120),
  method VARCHAR(10) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  status_code INT NOT NULL,
  ip_address VARCHAR(80),
  user_agent VARCHAR(255),
  duration_ms INT NOT NULL,
  request_payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_actor (actor_user_id, actor_role)
);

INSERT INTO departments(id, name, description) VALUES
(1, 'MGMT', 'Management'),
(2, 'RDL', 'R&D Lab');

INSERT INTO sections(id, name, department_id, description) VALUES
(1, 'Management Team', 1, 'Management users from scanner report'),
(2, 'RDL Team', 2, 'RDL users from scanner report');

-- Admin password = admin123, generated using:
-- crypto.scryptSync('admin123', '9ab4e301969abae210380146f9775679', 64).toString('hex')
INSERT INTO users(id, employee_id, username, role, password_salt, password_hash, is_first_login, is_active) VALUES
(1, NULL, 'admin', 'ADMIN', '9ab4e301969abae210380146f9775679', 'b8842b2dea486bc1f5eaa1fed38dc6027a326017dee11a11c7d902f69f5908ef880fce58e74ee8f80f7aa7980240e9caa013035a5ae1ce1d78c7abb4cc66258c', 0, 1);

-- Sunday default holiday (backend should always honor this row as non-deletable)
INSERT INTO holidays(title, holiday_date, holiday_type, weekday, recurring_yearly, is_system_default, is_active)
VALUES ('Sunday', NULL, 'WEEKDAY', 1, 1, 1, 1);

-- Real attendance data from fingerprint exports is provided in:
-- sql/fingerprint_seed.sql
-- Import this file after running schema_v2_role_based.sql.
