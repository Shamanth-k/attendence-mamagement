CREATE DATABASE IF NOT EXISTS attendance_management;
USE attendance_management;

DROP TABLE IF EXISTS biometric_events;
DROP TABLE IF EXISTS attendance_alerts;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS app_usage_logs;
DROP TABLE IF EXISTS attendance_logs;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS sections;
DROP TABLE IF EXISTS departments;

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
  username VARCHAR(80) UNIQUE NOT NULL,
  role ENUM('admin','hr','manager','viewer') NOT NULL DEFAULT 'viewer',
  password_salt VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
  CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(id)
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

INSERT INTO users(id, username, role, password_salt, password_hash, is_active) VALUES
(1, 'admin', 'admin', '3f8d58f02d4c0f4aa78db4814e2f5ef2', '443b341323602b5100750c687dd54be34aa099c6d2d5814ca0e01adca8e79146c3ede783e2430ed713cb2ecb05690a7a757e5e253124bfbb62f164f9e7728494', 1);

-- Real attendance data from fingerprint exports is provided in:
-- sql/fingerprint_seed.sql
-- Import this file after running schema.sql.
