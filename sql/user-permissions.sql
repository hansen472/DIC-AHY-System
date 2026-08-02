-- ============================================
-- 用户功能权限表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/user-permissions.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS user_permissions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  username    VARCHAR(50)  NOT NULL COMMENT '用户名',
  feature_key VARCHAR(50)  NOT NULL COMMENT '功能标识：print/logs/dashboard/template_admin',
  is_allowed  TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '1=允许, 0=禁止',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_user_feature (username, feature_key),
  KEY idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户功能权限表';
