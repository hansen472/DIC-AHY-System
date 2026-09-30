-- ============================================
-- 阶段 B2.3：回填 workflow 5 张表的 company_id 历史数据
-- 前置：先执行 sql/alter-workflow-add-company-id.sql（加字段）
--       和 sql/alter-users-add-is-super-admin.sql（用户档案已分配 company_id）
-- 执行方式: mysql -u root -p pdf_print_db < sql/backfill-workflow-company-id.sql
--
-- 回填规则：
--   - workflow_instances: created_by JOIN users → company_id（admin/超管 → NULL = 集团实例）
--   - workflow_definitions: created_by JOIN users → company_id（admin/超管 → NULL = 集团模板）
--   - workflow_instance_vars: 通过 instance_id JOIN instances → company_id
--   - workflow_tasks: 通过 instance_id JOIN instances → company_id
--   - workflow_task_history: 通过 instance_id JOIN instances → company_id
--
-- 注意：tasks/history/vars 通过 instance 而非 assignee 回填，
--       因为实例归属是确定的，assignee 可能是外部转办人/会签多角色，归属不一致。
--
-- 兜底：JOIN 不上（用户被删/实例孤儿）→ company_id 保持 NULL（集团可见，超管人工修正）
-- ============================================

USE pdf_print_db;

-- ========== 1. workflow_instances ==========
UPDATE workflow_instances wi
LEFT JOIN users u ON u.username = wi.created_by
SET wi.company_id = u.company_id
WHERE wi.company_id IS NULL;

-- ========== 2. workflow_definitions ==========
UPDATE workflow_definitions wd
LEFT JOIN users u ON u.username = wd.created_by
SET wd.company_id = u.company_id
WHERE wd.company_id IS NULL;

-- ========== 3. workflow_instance_vars ==========
-- 注意：vars 表自身没有用户字段，必须通过 instance 关联回填
UPDATE workflow_instance_vars v
JOIN workflow_instances wi ON wi.id = v.instance_id
SET v.company_id = wi.company_id
WHERE v.company_id IS NULL;

-- ========== 4. workflow_tasks ==========
UPDATE workflow_tasks t
JOIN workflow_instances wi ON wi.id = t.instance_id
SET t.company_id = wi.company_id
WHERE t.company_id IS NULL;

-- ========== 5. workflow_task_history ==========
UPDATE workflow_task_history h
JOIN workflow_instances wi ON wi.id = h.instance_id
SET h.company_id = wi.company_id
WHERE h.company_id IS NULL;

-- ========== 自检：回填后的分布 ==========
-- 1. 实例分布（NULL 表示集团实例或孤儿数据，需人工核对）
SELECT
  COALESCE(company_id, 'NULL（集团或孤儿）') AS company_bucket,
  COUNT(*) AS instance_cnt
FROM workflow_instances
GROUP BY company_id
ORDER BY company_id IS NULL DESC, company_id;

-- 2. 待办任务分布
SELECT
  COALESCE(company_id, 'NULL（集团或孤儿）') AS company_bucket,
  COUNT(*) AS task_cnt,
  SUM(status = 'pending') AS pending_cnt
FROM workflow_tasks
GROUP BY company_id
ORDER BY company_id IS NULL DESC, company_id;

-- 3. 流程定义分布
SELECT
  COALESCE(company_id, 'NULL（集团模板）') AS company_bucket,
  COUNT(*) AS def_cnt,
  SUM(is_active = 1) AS active_cnt
FROM workflow_definitions
GROUP BY company_id
ORDER BY company_id IS NULL DESC, company_id;

-- 4. 历史归档分布
SELECT
  COALESCE(company_id, 'NULL（集团或孤儿）') AS company_bucket,
  COUNT(*) AS history_cnt
FROM workflow_task_history
GROUP BY company_id
ORDER BY company_id IS NULL DESC, company_id;

-- 5. 孤儿数据兜底排查（JOIN 不上的实例）
SELECT 'orphan_instances' AS check_type, COUNT(*) AS cnt
FROM workflow_instances wi
LEFT JOIN users u ON u.username = wi.created_by
WHERE wi.company_id IS NULL AND u.id IS NULL;

SELECT 'orphan_definitions' AS check_type, COUNT(*) AS cnt
FROM workflow_definitions wd
LEFT JOIN users u ON u.username = wd.created_by
WHERE wd.company_id IS NULL AND u.id IS NULL;

-- 提示：如果孤儿数据 > 0，说明存在 created_by 用户已被删除的实例/定义。
-- 这种数据的 company_id 暂时为 NULL（集团可见），不会丢失。
-- 处理方式：
--   1. 业务确认：这些孤儿实例归属哪个公司，手动 UPDATE company_id = ?
--   2. 如果实例已 completed/rejected，可以保持 NULL（不影响新业务）
--   3. 如果实例还在 running，需要尽快修正，否则子公司用户看不到自己的待办
