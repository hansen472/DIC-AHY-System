-- ============================================
-- 公司信息表（组织管理）
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/companies.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS companies (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  company_name        VARCHAR(200) NOT NULL COMMENT '公司名称',
  company_address     VARCHAR(500) DEFAULT NULL COMMENT '公司地址',
  cost_center         VARCHAR(100) DEFAULT NULL COMMENT '公司成本中心',
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_company_name (company_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='公司信息（组织管理）';
