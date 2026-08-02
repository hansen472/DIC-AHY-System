-- ============================================
-- 操作日志表
-- 用于记录模板升级、CSS 更新等管理操作
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/operation-logs.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS operation_logs (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  username    VARCHAR(50)  NOT NULL COMMENT '操作人',
  action      VARCHAR(100) NOT NULL COMMENT '操作动作，如 保存模板版本、更新全局CSS',
  target_type VARCHAR(50)  NULL COMMENT '操作对象类型，如 template / css',
  target_id   VARCHAR(50)  NULL COMMENT '操作对象标识，如模板ID',
  detail      TEXT         NULL COMMENT '操作详情，如版本号、修改原因',
  ip_address  VARCHAR(45)  NULL COMMENT '操作来源IP',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  KEY idx_username (username),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';
