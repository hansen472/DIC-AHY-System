-- ============================================
-- 偏差上报表：增加归类/处理阶段字段（三段式审批流）
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-deviation-reports-add-classification-handling.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE deviation_reports
  ADD COLUMN IF NOT EXISTS deviation_owner     VARCHAR(50) NULL COMMENT '偏差负责人（归类节点审批人，运行时自动记录）',
  ADD COLUMN IF NOT EXISTS handler             VARCHAR(50) NULL COMMENT '处理人（归类节点指定）',
  ADD COLUMN IF NOT EXISTS classification_json LONGTEXT    NULL COMMENT '偏差归类表单数据（JSON，每轮最新）',
  ADD COLUMN IF NOT EXISTS handling_json       LONGTEXT    NULL COMMENT '偏差处理表单数据（JSON，每轮最新）';
