-- ============================================
-- 为用户表增加 department_id 外键关联部门表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-users-add-department-fk.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS department_id INT UNSIGNED NULL COMMENT '所属部门ID',
  ADD CONSTRAINT fk_users_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
