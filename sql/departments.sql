-- ============================================
-- 部门信息表（组织管理）
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/departments.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS departments (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  department_name     VARCHAR(200) NOT NULL COMMENT '部门名称',
  department_address  VARCHAR(500) DEFAULT NULL COMMENT '部门地址',
  cost_center         VARCHAR(100) DEFAULT NULL COMMENT '部门成本中心',
  department_manager  VARCHAR(100) DEFAULT NULL COMMENT '部门负责人',
  manager_username    VARCHAR(50) DEFAULT NULL COMMENT '部门负责人用户名',
  company_id          INT UNSIGNED DEFAULT NULL COMMENT '所属公司ID',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_department_name (department_name),
  CONSTRAINT fk_departments_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
  CONSTRAINT fk_departments_manager FOREIGN KEY (manager_username) REFERENCES users(username) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='部门信息（组织管理）';
