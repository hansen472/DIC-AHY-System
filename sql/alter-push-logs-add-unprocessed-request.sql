-- ============================================
-- 扩展 push_logs 表 source 枚举，增加 'unprocessed_request'、'new_repair' 和 'new_issue'
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-push-logs-add-unprocessed-request.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE push_logs
  MODIFY COLUMN source ENUM('instrument_meter','overdue_workorder','daily_workorder','qc_maintenance','unprocessed_request','new_repair','new_issue') NOT NULL COMMENT '来源模块';
