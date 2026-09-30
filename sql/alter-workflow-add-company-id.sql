-- ============================================
-- 阶段 B2：workflow 5 张表增加 company_id 列（多租户隔离地基）
-- 执行方式: mysql -u root -p pdf_print_db < sql/alter-workflow-add-company-id.sql
--
-- 设计要点：
--   - company_id = NULL 表示"集团共享"（由超管发布的流程定义模板，或兜底归属）
--     * workflow_definitions: NULL = 集团统一模板，所有子公司可读
--     * workflow_instances / tasks / history / vars: NULL = 集团超管发起的实例
--   - company_id = 具体值表示"子公司专属"，按租户过滤
--
-- 回填顺序（在下一个脚本 B2.3 执行）：
--   1. workflow_instances（用 created_by 反查 users.company_id）
--   2. workflow_definitions（用 created_by 反查 users.company_id）
--   3. workflow_instance_vars（用 instance_id JOIN instances）
--   4. workflow_tasks（用 instance_id JOIN instances）
--   5. workflow_task_history（用 instance_id JOIN instances）
-- ============================================

USE pdf_print_db;

-- ========== 1. workflow_definitions ==========
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS company_id INT UNSIGNED NULL COMMENT '所属公司ID（NULL=集团共享模板）';

-- 复合索引：按公司列出启用的流程定义（设计器页/启动实例时常用查询）
CREATE INDEX IF NOT EXISTS idx_def_company_active
  ON workflow_definitions (company_id, module_key, is_active);

-- ========== 2. workflow_instances ==========
ALTER TABLE workflow_instances
  ADD COLUMN IF NOT EXISTS company_id INT UNSIGNED NULL COMMENT '所属公司ID（NULL=集团发起的实例）';

-- 复合索引：按公司+状态过滤实例（我的发起/我的参与/超管看全部）
CREATE INDEX IF NOT EXISTS idx_inst_company_status
  ON workflow_instances (company_id, status, created_at);

-- ========== 3. workflow_tasks ==========
ALTER TABLE workflow_tasks
  ADD COLUMN IF NOT EXISTS company_id INT UNSIGNED NULL COMMENT '所属公司ID（与 instance 一致）';

-- 复合索引：按公司+审批人+状态取待办（最核心的查询路径）
CREATE INDEX IF NOT EXISTS idx_task_company_assignee_status
  ON workflow_tasks (company_id, assignee_username, status);

-- ========== 4. workflow_task_history ==========
ALTER TABLE workflow_task_history
  ADD COLUMN IF NOT EXISTS company_id INT UNSIGNED NULL COMMENT '所属公司ID（与 instance 一致）';

CREATE INDEX IF NOT EXISTS idx_hist_company_instance
  ON workflow_task_history (company_id, instance_id, created_at);

-- ========== 5. workflow_instance_vars ==========
ALTER TABLE workflow_instance_vars
  ADD COLUMN IF NOT EXISTS company_id INT UNSIGNED NULL COMMENT '所属公司ID（与 instance 一致，冗余以便直接过滤）';

CREATE INDEX IF NOT EXISTS idx_vars_company_instance
  ON workflow_instance_vars (company_id, instance_id);

-- ========== 自检 ==========
-- 列出每张表当前已加字段
SELECT 'workflow_definitions' AS tbl, company_id IS NULL AS not_yet_filled, COUNT(*) AS cnt
  FROM workflow_definitions UNION ALL
SELECT 'workflow_instances', company_id IS NULL, COUNT(*) FROM workflow_instances UNION ALL
SELECT 'workflow_tasks', company_id IS NULL, COUNT(*) FROM workflow_tasks UNION ALL
SELECT 'workflow_task_history', company_id IS NULL, COUNT(*) FROM workflow_task_history UNION ALL
SELECT 'workflow_instance_vars', company_id IS NULL, COUNT(*) FROM workflow_instance_vars;

-- 提示：上面查询的"列已加但尚未回填"的字段都是 NULL（迁移前数据）。
-- 下一步执行 sql/backfill-workflow-company-id.sql 回填历史数据。
