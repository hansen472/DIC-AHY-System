-- ============================================
-- 为用户表增加 company_id 外键关联公司表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-users-add-company.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company_id INT UNSIGNED NULL COMMENT '所属公司ID',
  ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;
