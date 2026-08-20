-- ============================================
-- 扩展 push_logs.source 枚举，新增 qc_maintenance
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-push-logs-add-qc-maintenance.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE push_logs
  MODIFY COLUMN source ENUM('instrument_meter','overdue_workorder','daily_workorder','qc_maintenance') NOT NULL
  COMMENT '来源模块';
