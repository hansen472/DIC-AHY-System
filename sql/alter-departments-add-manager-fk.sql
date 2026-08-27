-- ============================================
-- 为部门表增加负责人外键关联用户表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-departments-add-manager-fk.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS manager_username VARCHAR(50) NULL COMMENT '部门负责人用户名',
  ADD CONSTRAINT fk_departments_manager FOREIGN KEY (manager_username) REFERENCES users(username) ON DELETE SET NULL;
