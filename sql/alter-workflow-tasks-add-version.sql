-- ============================================
-- 阶段 A1：workflow_tasks 增加乐观锁版本号
-- 执行方式: mysql -u root -p pdf_print_db < sql/alter-workflow-tasks-add-version.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE workflow_tasks
  ADD COLUMN IF NOT EXISTS version INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '乐观锁版本号，每次更新+1';

-- 加速按 (id, version) 的并发冲突检测
CREATE INDEX IF NOT EXISTS idx_tasks_id_version ON workflow_tasks (id, version);
