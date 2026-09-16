/**
 * 操作日志路由：operation-logs 查询与导出
 */
const express = require('express');

module.exports = function setupLogRoutes(deps) {
  const { pool, auth } = deps;
  const router = express.Router();
  const { requirePermission } = auth;

  // GET /api/operation-logs
  router.get('/api/operation-logs', requirePermission('operation_logs'), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, username, action, target_type, target_id, detail, ip_address, created_at FROM operation_logs ORDER BY created_at DESC LIMIT 200'
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询操作日志失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // GET /api/operation-logs/export
  router.get('/api/operation-logs/export', requirePermission('operation_logs'), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT username, action, target_type, target_id, detail, ip_address, created_at FROM operation_logs ORDER BY created_at DESC'
      );

      let csv = '\uFEFF时间,操作人,操作,对象类型,对象ID,详情,IP\n';

      rows.forEach(row => {
        const time = row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '';
        const fields = [
          time,
          row.username || '',
          row.action || '',
          row.target_type || '',
          row.target_id || '',
          (row.detail || '').replace(/"/g, '""'),
          row.ip_address || ''
        ];
        csv += fields.map(f => `"${f}"`).join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=operation-logs.csv');
      res.send(csv);
    } catch (err) {
      console.error('导出操作日志失败:', err);
      res.status(500).json({ error: '导出失败' });
    }
  });

  return router;
};
