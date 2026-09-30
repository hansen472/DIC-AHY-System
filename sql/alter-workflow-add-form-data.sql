-- ============================================
-- 阶段 C1：workflow_tasks / workflow_task_history 增加表单数据列
-- 执行方式: mysql -u root -p pdf_print_db < sql/alter-workflow-add-form-data.sql
--
-- 背景：审批节点经常需要结构化表单数据（如 RCA 记录、纠正措施、CAPA 评估、
-- 偏差分类、有效期核查结论等）。目前这些数据散落在 comment 文本或业务表，
-- 不能满足 GMP ALCOA+ 数据完整性要求（不可追溯、不可结构化检索）。
-- 本次给 workflow_tasks 和 workflow_task_history 都加 form_data_json 列：
--   - workflow_tasks.form_data_json：当前任务提交时由审批人填写的结构化表单
--   - workflow_task_history.form_data_json：审计快照，记录每次审批动作的表单数据
-- ============================================

USE pdf_print_db;

ALTER TABLE workflow_tasks
  ADD COLUMN IF NOT EXISTS form_data_json LONGTEXT NULL COMMENT '审批人提交的结构化表单数据 JSON';

ALTER TABLE workflow_task_history
  ADD COLUMN IF NOT EXISTS form_data_json LONGTEXT NULL COMMENT '审批动作的表单数据快照，用于审计回溯';

-- 验证：
-- SHOW COLUMNS FROM workflow_tasks LIKE 'form_data_json';
-- SHOW COLUMNS FROM workflow_task_history LIKE 'form_data_json';
