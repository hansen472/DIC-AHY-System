/**
 * 偏差上报路由：deviation-reports CRUD + resubmit（接入审批流）
 */
const express = require('express');

module.exports = function setupDeviationRoutes(deps) {
  const { pool, auth, getWorkflowEngine } = deps;
  const router = express.Router();
  const { requireAuth, getUsernameFromReq } = auth;

  // POST /api/deviation-reports
  router.post('/api/deviation-reports', requireAuth, async (req, res) => {
    try {
      const { department, dev_time, reporter, reporter_name, subject, model, spec, batch, quantity, description } = req.body;

      if (!department || !dev_time || !reporter || !subject || !description) {
        return res.status(400).json({ error: '缺少必填字段（偏差发现部门/发现时间/发现人/涉及主体/偏差描述）' });
      }

      const workflowEngine = getWorkflowEngine();
      const activeDef = await workflowEngine.getActiveDefinition('deviation_reports');
      if (!activeDef) {
        return res.status(400).json({ error: '偏差上报审批流未配置或未启用，请联系管理员在流程设计器中配置' });
      }

      const payload = {
        department: String(department).trim(),
        dev_time: dev_time,
        reporter: reporter,
        reporter_name: reporter_name ? String(reporter_name).trim() : null,
        subject: String(subject).trim(),
        model: model ? String(model).trim() : null,
        spec: spec ? String(spec).trim() : null,
        batch: batch ? String(batch).trim() : null,
        quantity: quantity ? String(quantity).trim() : null,
        description: String(description).trim()
      };

      const [insertResult] = await pool.execute(
        `INSERT INTO deviation_reports
       (department, dev_time, reporter, reporter_name, subject, \`model\`, spec, batch, quantity, description, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_approval', ?)`,
        [
          payload.department, payload.dev_time, payload.reporter, payload.reporter_name,
          payload.subject, payload.model, payload.spec, payload.batch, payload.quantity,
          payload.description, getUsernameFromReq(req)
        ]
      );

      const reportId = insertResult.insertId;

      try {
        await workflowEngine.startInstance({
          module_key: 'deviation_reports',
          business_key: `deviation_reports:${reportId}`,
          payload: { id: reportId, ...payload },
          created_by: getUsernameFromReq(req)
        });
      } catch (wfErr) {
        await pool.execute('DELETE FROM deviation_reports WHERE id = ?', [reportId]);
        throw wfErr;
      }

      res.json({ success: true, id: reportId, message: '偏差上报已提交审批' });
    } catch (err) {
      console.error('提交偏差上报失败:', err);
      res.status(500).json({ error: err.message || '提交失败' });
    }
  });

  // GET /api/deviation-reports
  router.get('/api/deviation-reports', requireAuth, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, department, dev_time, reporter, reporter_name, subject, \`model\`, spec, batch, quantity, description, status, created_by, created_at
       FROM deviation_reports
       WHERE created_by = ?
       ORDER BY id DESC`,
        [getUsernameFromReq(req)]
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询偏差上报列表失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // GET /api/deviation-reports/:id
  router.get('/api/deviation-reports/:id', requireAuth, async (req, res) => {
    try {
      const reportId = parseInt(req.params.id, 10);
      if (isNaN(reportId)) return res.status(400).json({ error: '参数错误' });

      const [rows] = await pool.execute(
        `SELECT id, department, dev_time, reporter, reporter_name, subject, \`model\`, spec, batch, quantity, description,
              status, created_by, created_at, updated_at,
              deviation_owner, handler, classification_json, handling_json
       FROM deviation_reports
       WHERE id = ?`,
        [reportId]
      );
      if (rows.length === 0) return res.status(404).json({ error: '偏差报告不存在' });

      const row = rows[0];
      if (row.classification_json) {
        try { row.classification = JSON.parse(row.classification_json); } catch (e) { row.classification = {}; }
      }
      if (row.handling_json) {
        try { row.handling = JSON.parse(row.handling_json); } catch (e) { row.handling = {}; }
      }
      delete row.classification_json;
      delete row.handling_json;

      res.json({ success: true, data: row });
    } catch (err) {
      console.error('查询偏差上报详情失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // POST /api/deviation-reports/:id/resubmit
  router.post('/api/deviation-reports/:id/resubmit', requireAuth, async (req, res) => {
    try {
      const reportId = parseInt(req.params.id, 10);
      if (isNaN(reportId)) return res.status(400).json({ error: '参数错误' });

      const { department, dev_time, reporter, reporter_name, subject, model, spec, batch, quantity, description } = req.body;
      if (!department || !dev_time || !reporter || !subject || !description) {
        return res.status(400).json({ error: '缺少必填字段（偏差发现部门/发现时间/发现人/涉及主体/偏差描述）' });
      }

      const username = getUsernameFromReq(req);

      const [rows] = await pool.execute(
        'SELECT id, created_by, status FROM deviation_reports WHERE id = ?',
        [reportId]
      );
      if (rows.length === 0) return res.status(404).json({ error: '偏差报告不存在' });
      if (rows[0].created_by !== username) {
        return res.status(403).json({ error: '只能重新提交自己上报的偏差报告' });
      }

      if (rows[0].status !== 'rejected' && rows[0].status !== 'draft') {
        return res.status(400).json({ error: '仅"已驳回"或"已撤回"的偏差报告可以重新提交' });
      }

      const workflowEngine = getWorkflowEngine();
      const activeDef = await workflowEngine.getActiveDefinition('deviation_reports');
      if (!activeDef) {
        return res.status(400).json({ error: '偏差上报审批流未配置或未启用，请联系管理员在流程设计器中配置' });
      }

      const [running] = await pool.execute(
        "SELECT id FROM workflow_instances WHERE business_key = ? AND status = 'running' LIMIT 1",
        [`deviation_reports:${reportId}`]
      );
      if (running.length > 0) {
        return res.status(400).json({ error: '该偏差报告正在审批中，不能重新提交' });
      }

      const payload = {
        department: String(department).trim(),
        dev_time: dev_time,
        reporter: reporter,
        reporter_name: reporter_name ? String(reporter_name).trim() : null,
        subject: String(subject).trim(),
        model: model ? String(model).trim() : null,
        spec: spec ? String(spec).trim() : null,
        batch: batch ? String(batch).trim() : null,
        quantity: quantity ? String(quantity).trim() : null,
        description: String(description).trim()
      };

      await pool.execute(
        `UPDATE deviation_reports SET
         department = ?, dev_time = ?, reporter = ?, reporter_name = ?, subject = ?,
         \`model\` = ?, spec = ?, batch = ?, quantity = ?, description = ?, status = 'pending_approval',
         deviation_owner = NULL, handler = NULL, classification_json = NULL, handling_json = NULL
       WHERE id = ?`,
        [
          payload.department, payload.dev_time, payload.reporter, payload.reporter_name, payload.subject,
          payload.model, payload.spec, payload.batch, payload.quantity, payload.description,
          reportId
        ]
      );

      try {
        await workflowEngine.startInstance({
          module_key: 'deviation_reports',
          business_key: `deviation_reports:${reportId}`,
          payload: { id: reportId, ...payload },
          created_by: username
        });
      } catch (wfErr) {
        await pool.execute("UPDATE deviation_reports SET status = 'draft' WHERE id = ?", [reportId]);
        throw wfErr;
      }

      res.json({ success: true, id: reportId, message: '偏差报告已重新提交审批' });
    } catch (err) {
      console.error('重新提交偏差上报失败:', err);
      res.status(500).json({ error: err.message || '重新提交失败' });
    }
  });

  return router;
};
