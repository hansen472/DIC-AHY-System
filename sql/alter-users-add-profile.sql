-- ============================================
-- 为用户表扩展人员档案字段
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-users-add-profile.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS chinese_name   VARCHAR(50)  NULL COMMENT '中文名',
  ADD COLUMN IF NOT EXISTS department     VARCHAR(100) NULL COMMENT '部门',
  ADD COLUMN IF NOT EXISTS direct_manager VARCHAR(50)  NULL COMMENT '直接上级',
  ADD COLUMN IF NOT EXISTS email          VARCHAR(100) NULL COMMENT 'Email',
  ADD COLUMN IF NOT EXISTS position       VARCHAR(100) NULL COMMENT '岗位',
  ADD COLUMN IF NOT EXISTS hire_date      DATE         NULL COMMENT '入职日期';
