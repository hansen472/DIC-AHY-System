/**
 * 审批流引擎 API 路由
 *
 * 通过 setupWorkflowRoutes(app, { requireAuth, requirePermission }) 注册到 Express。
 */

const express = require('express');
const { WorkflowEngine } = require('./workflow-engine');

function setupWorkflowRoutes(app, { requireAuth, requirePermission, getUsername }) {
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
      const rows = await engine.listDefinitions(req.query.module_key);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询流程定义失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-definitions/:id', requireAuth, async (req, res) => {
    try {
      const def = await engine.getDefinition(parseInt(req.params.id, 10));
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
      });
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
      const ok = await engine.updateDefinition(id, { name, condition, priority, nodes, edges });
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
      const ok = await engine.activateDefinition(id);
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
      const ok = await engine.deleteDefinition(id);
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
      });
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
      });
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询流程实例失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // 注意：必须放在 /:id 参数路由之前，否则 my 会被当成 id
  app.get('/api/workflow-instances/my', requireAuth, async (req, res) => {
    try {
      const rows = await engine.getMyInstances(getUsername(req));
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询我发起的流程失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-instances/:id', requireAuth, async (req, res) => {
    try {
      const instance = await engine.getInstance(null, parseInt(req.params.id, 10));
      if (!instance) return res.status(404).json({ error: '流程实例不存在' });
      res.json({ success: true, data: instance });
    } catch (err) {
      console.error('查询流程实例失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-instances/:id/history', requireAuth, async (req, res) => {
    try {
      const history = await engine.getInstanceHistory(parseInt(req.params.id, 10));
      res.json({ success: true, data: history });
    } catch (err) {
      console.error('查询审批历史失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-instances/:id/tasks', requireAuth, async (req, res) => {
    try {
      const tasks = await engine.getTasksByInstance(parseInt(req.params.id, 10));
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('查询流程任务失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.post('/api/workflow-tasks/:id/complete', requireAuth, async (req, res) => {
    try {
      const taskId = parseInt(req.params.id, 10);
      const { action, comment, variables } = req.body;
      console.log(`[审批任务] 用户 ${getUsername(req)} 处理任务 ${taskId}, action=${action}`);
      const result = await engine.completeTask(taskId, {
        action,
        comment,
        completed_by: getUsername(req),
        variables
      });
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
      });
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('转交任务失败:', err);
      res.status(500).json({ error: err.message || '转交失败' });
    }
  });

  app.post('/api/workflow-instances/:id/recall', requirePermission('workflow_recall_task'), async (req, res) => {
    try {
      const instanceId = parseInt(req.params.id, 10);
      const { comment } = req.body || {};
      const result = await engine.recallInstance(instanceId, {
        recalled_by: getUsername(req),
        comment
      });
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('撤回流程失败:', err);
      res.status(500).json({ error: err.message || '撤回失败' });
    }
  });

  // 注意：具体路由必须放在 /:id 参数路由之前，否则 Express 会把 my/pending/all-pending 当成 id
  app.get('/api/workflow-tasks/my', requireAuth, async (req, res) => {
    try {
      const tasks = await engine.getTasksByAssignee(getUsername(req), req.query.status || 'pending');
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('查询我的待办失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-tasks/pending', requirePermission('workflow_view_task'), async (req, res) => {
    try {
      const tasks = await engine.getTasksByAssignee(req.query.assignee || '', 'pending');
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('查询待办任务失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-tasks/all-pending', requirePermission('workflow_view_task'), async (req, res) => {
    try {
      const tasks = await engine.getAllPendingTasks();
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('查询全部待办任务失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-tasks/my-count', requireAuth, async (req, res) => {
    try {
      const count = await engine.getPendingTaskCount(getUsername(req));
      res.json({ success: true, data: { count } });
    } catch (err) {
      console.error('查询待办数量失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  app.get('/api/workflow-tasks/:id', requireAuth, async (req, res) => {
    try {
      const task = await engine.getTask(parseInt(req.params.id, 10));
      if (!task) return res.status(404).json({ error: '任务不存在' });
      res.json({ success: true, data: task });
    } catch (err) {
      console.error('查询任务失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });
}

module.exports = { setupWorkflowRoutes };
