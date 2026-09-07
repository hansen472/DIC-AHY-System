-- ============================================
-- 推送状态跟踪表
-- 存储各推送模块的上次推送位置（如 last mr_id），
-- 用于"新增报修单推送"等需要增量推送的模块。
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/push-state.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS push_state (
  push_type     VARCHAR(50) PRIMARY KEY COMMENT '推送类型标识',
  last_mr_id    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '上次推送的最大 mr_id',
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='推送状态跟踪表';

-- 初始化新增报修单推送的起始状态（从 1140 开始）
INSERT IGNORE INTO push_state (push_type, last_mr_id) VALUES ('new_repair', 1140);
