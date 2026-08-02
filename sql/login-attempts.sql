-- ============================================
-- 登录失败尝试记录表（用于账户锁定功能）
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/login-attempts.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS login_attempts (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  username    VARCHAR(50)  NOT NULL COMMENT '用户名',
  ip_address  VARCHAR(45)  NULL COMMENT 'IP地址',
  attempted_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '尝试时间',
  KEY idx_username (username),
  KEY idx_attempted_at (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录失败尝试记录表';

-- 添加账户锁定状态字段到 users 表
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL COMMENT '账户锁定截止时间，NULL表示未锁定';
