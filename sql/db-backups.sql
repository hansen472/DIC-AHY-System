-- ============================================
-- 数据库全量备份记录表
-- 数据库: pdf_print_db
-- 用途: 记录 pdf_print_db 数据库全量备份的执行结果与文件信息
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/db-backups.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS db_backups (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  backup_name    VARCHAR(255) NOT NULL COMMENT '备份文件名',
  file_path      VARCHAR(500) NOT NULL COMMENT '备份文件绝对路径',
  file_size      BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '备份文件大小（字节）',
  status         ENUM('running', 'success', 'failed') NOT NULL DEFAULT 'running' COMMENT '备份状态',
  error_message  TEXT         NULL COMMENT '失败时的错误信息',
  started_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '备份开始时间',
  completed_at   DATETIME     NULL COMMENT '备份完成时间',
  created_by     VARCHAR(50)  NULL COMMENT '触发者：system 或手动执行的用户名',
  KEY idx_status (status),
  KEY idx_started_at (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据库全量备份记录表';
