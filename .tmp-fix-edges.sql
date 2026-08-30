-- 1. 先确认当前启用的“偏差上报”定义ID（替换到下面的 <DEF_ID>）
SELECT id, name, version, is_active
FROM workflow_definitions
WHERE name LIKE '%偏差上报%'
ORDER BY id DESC
LIMIT 5;

-- 2. 修复定义：删除重复边，保留正确标签
-- 需要把 <DEF_ID> 替换为实际启用的定义 id
UPDATE workflow_definitions
SET edges_json = '[{"id":"edge-1787811880018-8258","source":"node-1787811874263-3632","target":"node-1787811876804-4696","label":""},{"id":"edge-1787811890831-1451","source":"node-1787811876804-4696","target":"node-1787811888437-9519","label":""},{"id":"edge-1787818078380-9986","source":"node-1787811876804-4696","target":"node-1787811883123-4880","label":"reject"},{"id":"edge-1787819906090-2701","source":"node-1787819845656-1421","target":"node-1787811883123-4880","label":""},{"id":"edge-1787819912282-5117","source":"node-1787819845656-1421","target":"node-1787811888437-9519","label":"reject"},{"id":"edge-1787904014909-8128","source":"node-1787811888437-9519","target":"node-1787811876804-4696","label":"reject"},{"id":"edge-1787905426077-7230","source":"node-1787811888437-9519","target":"node-1787819845656-1421","label":""}]'
WHERE id = <DEF_ID>;

-- 3. 清理当前卡住的实例 9：作废错误产生的"偏差负责人初审"任务，只保留复审
UPDATE workflow_tasks
SET status = 'rejected', action = 'reject', comment = '定义修正-清理错误路由产生的重复任务', completed_at = NOW()
WHERE instance_id = 9 AND node_id = 'node-1787811876804-4696' AND status = 'pending';

UPDATE workflow_instances
SET current_node_ids = '["node-1787819845656-1421"]'
WHERE id = 9;

-- 4. 验证
SELECT id, instance_id, node_name, assignee_username, status
FROM workflow_tasks
WHERE instance_id = 9 AND status = 'pending';

SELECT current_node_ids FROM workflow_instances WHERE id = 9;
