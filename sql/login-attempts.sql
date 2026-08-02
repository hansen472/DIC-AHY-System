-- ============================================
-- 登录失败尝试记录表 + 账户锁定 + 密码有效期
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/login-attempts.sql
-- 注：服务启动时也会自动执行迁移，无需手动执行此脚本
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

-- 添加密码最后修改时间字段（用于密码有效期策略：1年有效 + 1个月宽限）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at DATETIME NULL COMMENT '密码最后修改时间';

-- 回填已有用户的密码修改时间为当前时间
UPDATE users SET password_changed_at = NOW() WHERE password_changed_at IS NULL;
