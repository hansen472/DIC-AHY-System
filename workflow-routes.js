/**
 * 审批流引擎 API 路由
 *
 * 通过 setupWorkflowRoutes(app, { requireAuth, requirePermission }) 注册到 Express。
 */

const express = require('express');
const { WorkflowEngine } = require('./workflow-engine');

function setupWorkflowRoutes(app, { requireAuth, requirePermission, getUsername, getTenantContext }) {
  const engine = new WorkflowEngine({
    sendReminder: async (task) => {
      // 默认提醒：只打印日志，业务方可在 server.js 注入真实邮件发送器
      console.log(`[审批超时提醒] task=${task.id}, assignee=${task.assignee_username}, business=${task.business_key}`);
    }
  });

  // 导出 engine 供 server.js 注册业务钩子、替换提醒方式
  app.set('workflowEngine', engine);

  // ---------- 流程定义 ----------

  app.get('/api/workflow-definitions', requireAuth, async (req, res) => {
    try {
      const rows = await engine.listDefinitions(req.query.module_key, getTenantContext(req));
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询流程定义失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-definitions/:id', requireAuth, async (req, res) => {
    try {
      const def = await engine.getDefinition(parseInt(req.params.id, 10), getTenantContext(req));
      if (!def) return res.status(404).json({ error: '流程定义不存在' });
      res.json({ success: true, data: def });
    } catch (err) {
      console.error('查询流程定义失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.post('/api/workflow-definitions', requirePermission('workflow_design'), async (req, res) => {
    try {
      const { module_key, name, version, condition, priority, nodes, edges } = req.body;
      if (!module_key || !name) {
        return res.status(400).json({ error: '缺少 module_key 或 name' });
      }
      const result = await engine.createDefinition({
        module_key,
        name,
        version: version || 1,
        condition,
        priority: priority != null ? priority : 0,
        nodes,
        edges,
        created_by: getUsername(req)
      }, getTenantContext(req));
      res.json({ success: true, id: result.id, message: '流程定义已创建' });
    } catch (err) {
      console.error('创建流程定义失败:', err);
      res.status(500).json({ error: err.message || '创建失败' });
    }
  });

  app.put('/api/workflow-definitions/:id', requirePermission('workflow_design'), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const { name, condition, priority, nodes, edges } = req.body;
      const ok = await engine.updateDefinition(id, { name, condition, priority, nodes, edges }, getTenantContext(req));
      if (!ok) return res.status(404).json({ error: '流程定义不存在' });
      res.json({ success: true, message: '流程定义已更新' });
    } catch (err) {
      console.error('更新流程定义失败:', err);
      res.status(500).json({ error: err.message || '更新失败' });
    }
  });

  app.post('/api/workflow-definitions/:id/activate', requirePermission('workflow_design'), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const ok = await engine.activateDefinition(id, getTenantContext(req));
      if (!ok) return res.status(404).json({ error: '流程定义不存在' });
      res.json({ success: true, message: '流程定义已启用' });
    } catch (err) {
      console.error('启用流程定义失败:', err);
      res.status(500).json({ error: err.message || '启用失败' });
    }
  });

  app.delete('/api/workflow-definitions/:id', requirePermission('workflow_design'), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const ok = await engine.deleteDefinition(id, getTenantContext(req));
      if (!ok) return res.status(404).json({ error: '流程定义不存在' });
      res.json({ success: true, message: '流程定义已删除' });
    } catch (err) {
      console.error('删除流程定义失败:', err);
      res.status(500).json({ error: err.message || '删除失败' });
    }
  });

  // ---------- 流程实例与任务 ----------

  app.post('/api/workflow-instances/start', requireAuth, async (req, res) => {
    try {
      const { module_key, business_key, payload } = req.body;
      if (!module_key || !business_key) {
        return res.status(400).json({ error: '缺少 module_key 或 business_key' });
      }
      const instance = await engine.startInstance({
        module_key,
        business_key,
        payload,
        created_by: getUsername(req)
      }, getTenantContext(req));
      res.json({ success: true, data: instance });
    } catch (err) {
      console.error('启动流程实例失败:', err);
      res.status(500).json({ error: err.message || '启动失败' });
    }
  });

  app.get('/api/workflow-instances', requireAuth, async (req, res) => {
    try {
      const rows = await engine.listInstances({
        module_key: req.query.module_key,
        business_key: req.query.business_key,
        status: req.query.status
      }, getTenantContext(req));
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询流程实例失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // 注意：必须放在 /:id 参数路由之前，否则 my 会被当成 id
  app.get('/api/workflow-instances/my', requireAuth, async (req, res) => {
    try {
      const rows = await engine.getMyInstances(getUsername(req), {}, getTenantContext(req));
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询我发起的流程失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-instances/:id', requireAuth, async (req, res) => {
    try {
      const instance = await engine.getInstance(null, parseInt(req.params.id, 10), getTenantContext(req));
      if (!instance) return res.status(404).json({ error: '流程实例不存在' });
      res.json({ success: true, data: instance });
    } catch (err) {
      console.error('查询流程实例失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-instances/:id/history', requireAuth, async (req, res) => {
    try {
      const history = await engine.getInstanceHistory(parseInt(req.params.id, 10), getTenantContext(req));
      res.json({ success: true, data: history });
    } catch (err) {
      console.error('查询审批历史失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-instances/:id/tasks', requireAuth, async (req, res) => {
    try {
      const tasks = await engine.getTasksByInstance(parseInt(req.params.id, 10), getTenantContext(req));
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('查询流程任务失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.post('/api/workflow-tasks/:id/complete', requireAuth, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id, 10);
      const { action, comment, variables, formData } = req.body;
      console.log(`[审批任务] 用户 ${getUsername(req)} 处理任务 ${taskId}, action=${action}`);
      const result = await engine.completeTask(taskId, {
        action,
        comment,
        completed_by: getUsername(req),
        variables,
        formData
      }, getTenantContext(req));
      console.log(`[审批任务] 任务 ${taskId} 处理结果:`, result);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('完成任务失败:', err);
      res.status(500).json({ error: err.message || '处理失败' });
    }
  });

  app.post('/api/workflow-tasks/:id/transfer', requirePermission('workflow_transfer_task'), async (req, res) => {
    try {
      const taskId = parseInt(req.params.id, 10);
      const { new_assignee, comment } = req.body;
      if (!new_assignee) return res.status(400).json({ error: '缺少 new_assignee' });
      const result = await engine.transferTask(taskId, {
        new_assignee,
        comment,
        transferred_by: getUsername(req)
      }, getTenantContext(req));
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('转交任务失败:', err);
      res.status(500).json({ error: err.message || '转交失败' });
    }
  });

  // 撤回流程：发起人可撤回自己发起的流程（须尚无任何审批人处理）；其他人凭 workflow_recall_task 权限撤回（不受该限制）
  app.post('/api/workflow-instances/:id/recall', requireAuth, async (req, res) => {
    const instanceId = parseInt(req.params.id, 10);
    const username = getUsername(req);
    const tenantCtx = getTenantContext(req);

    const doRecall = async (byCreator) => {
      try {
        const { comment } = req.body || {};
        const result = await engine.recallInstance(instanceId, {
          recalled_by: username,
          comment,
          byCreator
        }, tenantCtx);
        res.json({ success: true, data: result });
      } catch (err) {
        console.error('撤回流程失败:', err);
        res.status(500).json({ error: err.message || '撤回失败' });
      }
    };

    try {
      const instance = await engine.getInstance(null, instanceId, tenantCtx);
      if (instance && instance.created_by === username) {
        return doRecall(true);
      }
    } catch (e) {
      console.error('查询流程实例失败:', e.message);
    }
    // 非发起人：沿用权限校验（管理员强制撤回）
    return requirePermission('workflow_recall_task')(req, res, () => doRecall(false));
  });

  // 注意：具体路由必须放在 /:id 参数路由之前，否则 Express 会把 my/pending/all-pending 当成 id
  app.get('/api/workflow-tasks/my', requireAuth, async (req, res) => {
    try {
      const tasks = await engine.getTasksByAssignee(getUsername(req), req.query.status || 'pending', getTenantContext(req));
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('查询我的待办失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // C2：知会中心——查询我的 cc 知会列表
  // GET /api/workflow-cc/my?onlyUnread=1&limit=100
  app.get('/api/workflow-cc/my', requireAuth, async (req, res) => {
    try {
      const rows = await engine.listCcByReceiver(getUsername(req), {
        onlyUnread: req.query.onlyUnread === '1',
        limit: req.query.limit
      }, getTenantContext(req));
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询我的知会失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // C2：标记 cc 知会已读
  // POST /api/workflow-cc/:id/read
  app.post('/api/workflow-cc/:id/read', requireAuth, async (req, res) => {
    try {
      const ccId = parseInt(req.params.id, 10);
      if (isNaN(ccId)) return res.status(400).json({ error: '参数错误' });
      const ok = await engine.markCcRead(ccId, getUsername(req), getTenantContext(req));
      if (!ok) return res.status(404).json({ error: '知会不存在或已读' });
      res.json({ success: true, message: '已标记为已读' });
    } catch (err) {
      console.error('标记知会已读失败:', err);
      res.status(500).json({ error: '处理失败' });
    }
  });

  app.get('/api/workflow-tasks/pending', requirePermission('workflow_view_task'), async (req, res) => {
    try {
      const tasks = await engine.getTasksByAssignee(req.query.assignee || '', 'pending', getTenantContext(req));
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('查询待办任务失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-tasks/all-pending', requirePermission('workflow_view_task'), async (req, res) => {
    try {
      // 排除当前用户自己发起的流程任务，自己提交的审批在"我提交的审批"中查看
      const tasks = await engine.getAllPendingTasks({ excludeCreatedBy: getUsername(req) }, getTenantContext(req));
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('查询全部待办任务失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-tasks/my-count', requireAuth, async (req, res) => {
    try {
      const count = await engine.getPendingTaskCount(getUsername(req), getTenantContext(req));
      res.json({ success: true, data: { count } });
    } catch (err) {
      console.error('查询待办数量失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-tasks/my-participated', requireAuth, async (req, res) => {
    try {
      const tasks = await engine.getParticipatedTasks(getUsername(req), getTenantContext(req));
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('查询我的参与失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-tasks/:id', requireAuth, async (req, res) => {
    try {
      const task = await engine.getTask(parseInt(req.params.id, 10), getTenantContext(req));
      if (!task) return res.status(404).json({ error: '任务不存在' });
      res.json({ success: true, data: task });
    } catch (err) {
      console.error('查询任务失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });
}

module.exports = { setupWorkflowRoutes };
