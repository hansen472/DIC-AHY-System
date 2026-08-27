-- ============================================
-- 为用户表增加直接上级外键关联用户表（自引用）
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-users-add-manager-fk.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS direct_manager_username VARCHAR(50) NULL COMMENT '直接上级用户名',
  ADD CONSTRAINT fk_users_direct_manager FOREIGN KEY (direct_manager_username) REFERENCES users(username) ON DELETE SET NULL;
