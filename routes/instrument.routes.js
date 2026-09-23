/**
 * 仪器/仪表路由：instrument-meter 查询/导出/基准日/通知设置、各类推送（过期工单/每日工单/QC维护/未处理请求/新增报修/新增出库单）、推送日志
 */
const express = require('express');
const axios = require('axios');

module.exports = function setupInstrumentRoutes(deps) {
  const { pool, micPool, auth, logPush } = deps;
  const { queryInstruments, queryByAssetCodes } = require('../instrument-meter-service');
  const {
    getSettings: getMeterNotificationSettings,
    updateSettings: updateMeterNotificationSettings,
    getNextSendTimes: getMeterNextSendTimes,
    getUsersWithEmails: getMeterUsersWithEmails
  } = require('../instrument-meter-notifier');

  const router = express.Router();
  const { requirePermission } = auth;

  // ========== 仪器/仪表导出公共逻辑 ==========

  const INSTRUMENT_EXPORT_COLUMNS = [
    '序号', '仪器/仪表名称', '资产状态', '仪器/仪表编码', '本次检验日期', '下次检验日期',
    '安装位置', '型号/规格', '制造商', '出厂编号', '测量范围',
    '精度等级', '所在位置', '送检周期（月）'
  ];

  // 按页面当前排序方式排序，确保导出顺序与页面显示一致
  function sortInstrumentRows(rows, sortKey, sortAsc) {
    if (!sortKey) return rows;
    const decodedKey = decodeURIComponent(sortKey);
    const isAsc = sortAsc !== '0';
    rows.sort((a, b) => {
      let va = a[decodedKey];
      let vb = b[decodedKey];
      if (va === null || va === undefined) va = '';
      if (vb === null || vb === undefined) vb = '';
      let cmp = 0;
      if (decodedKey === '序号' || decodedKey === '送检周期（月）') {
        cmp = Number(va) - Number(vb);
      } else {
        cmp = String(va).localeCompare(String(vb), 'zh-CN');
      }
      return isAsc ? cmp : -cmp;
    });
    return rows;
  }

  function buildInstrumentCsv(rows) {
    const csvRows = rows.map(row =>
      INSTRUMENT_EXPORT_COLUMNS.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    );
    return '\uFEFF' + [INSTRUMENT_EXPORT_COLUMNS.join(','), ...csvRows].join('\n');
  }

  // ========== 仪器/仪表查询与导出 ==========

  // GET /api/instrument-meter
  router.get('/api/instrument-meter', requirePermission('instrument_meter'), async (req, res) => {
    const { expireDate } = req.query;
    if (!expireDate || !/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) {
      return res.status(400).json({ error: '缺少或无效的到期日期，格式应为 YYYY-MM-DD' });
    }
    try {
      const rows = await queryInstruments(expireDate);
      res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      console.error('查询仪器/仪表数据失败:', err);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  // GET /api/instrument-meter/export
  // 两种导出口径：
  //   1) baselineDate=YYYY-MM-DD：导出指定基准日保存编码对应的当前数据（与基准日视图一致）
  //   2) expireDate=YYYY-MM-DD：导出在该到期日期前需要送检的数据（默认，与查询视图一致）
  router.get('/api/instrument-meter/export', requirePermission('instrument_meter'), async (req, res) => {
    const { expireDate, baselineDate, sortKey, sortAsc } = req.query;
    try {
      let rows;
      let filename;

      if (baselineDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(baselineDate)) {
          return res.status(400).json({ error: '无效的基准日日期，格式应为 YYYY-MM-DD' });
        }
        const [codeRows] = await pool.execute(
          'SELECT asset_code FROM instrument_meter_baselines WHERE baseline_date = ?',
          [baselineDate]
        );
        if (codeRows.length === 0) {
          return res.status(404).json({ error: '该基准日不存在或没有保存任何仪器/仪表编码' });
        }
        const codes = codeRows.map(r => r.asset_code);
        rows = await queryByAssetCodes(codes);
        filename = `instrument-meter-baseline-${baselineDate}.csv`;
      } else {
        if (!expireDate || !/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) {
          return res.status(400).json({ error: '缺少或无效的到期日期，格式应为 YYYY-MM-DD' });
        }
        rows = await queryInstruments(expireDate);
        filename = `instrument-meter-${expireDate}.csv`;
      }

      if (rows.length === 0) {
        return res.status(404).json({ error: '没有可导出的数据' });
      }

      sortInstrumentRows(rows, sortKey, sortAsc);
      const csv = buildInstrumentCsv(rows);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) {
      console.error('导出仪器/仪表数据失败:', err);
      res.status(500).json({ error: '导出失败: ' + err.message });
    }
  });

  // ========== 仪器/仪表基准日 ==========

  // GET /api/instrument-meter/baselines
  router.get('/api/instrument-meter/baselines', requirePermission('instrument_meter'), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT DISTINCT baseline_date, COUNT(*) AS count FROM instrument_meter_baselines GROUP BY baseline_date ORDER BY baseline_date DESC'
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询基准日列表失败:', err.message);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  // POST /api/instrument-meter/baseline
  router.post('/api/instrument-meter/baseline', requirePermission('instrument_meter'), async (req, res) => {
    const { baselineDate, assetCodes } = req.body;
    if (!baselineDate || !/^\d{4}-\d{2}-\d{2}$/.test(baselineDate)) {
      return res.status(400).json({ error: '缺少或无效的基准日日期，格式应为 YYYY-MM-DD' });
    }
    if (!Array.isArray(assetCodes) || assetCodes.length === 0) {
      return res.status(400).json({ error: '无仪器/仪表编码可保存，请先查询数据' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM instrument_meter_baselines WHERE baseline_date = ?', [baselineDate]);
      const insertSql = 'INSERT INTO instrument_meter_baselines (baseline_date, asset_code) VALUES ' +
        assetCodes.map(() => '(?, ?)').join(',');
      const params = assetCodes.flatMap(code => [baselineDate, code]);
      await conn.execute(insertSql, params);
      await conn.commit();
      res.json({ success: true, message: `基准日 ${baselineDate} 已保存，共 ${assetCodes.length} 条仪器/仪表编码`, count: assetCodes.length });
    } catch (err) {
      await conn.rollback();
      console.error('保存基准日失败:', err.message);
      res.status(500).json({ error: '保存失败: ' + err.message });
    } finally {
      conn.release();
    }
  });

  // GET /api/instrument-meter/baseline/:date
  router.get('/api/instrument-meter/baseline/:date', requirePermission('instrument_meter'), async (req, res) => {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: '无效的基准日日期' });
    }
    try {
      const [codeRows] = await pool.execute(
        'SELECT asset_code FROM instrument_meter_baselines WHERE baseline_date = ?',
        [date]
      );
      if (codeRows.length === 0) {
        return res.json({ success: true, count: 0, data: [], baselineDate: date });
      }
      const codes = codeRows.map(r => r.asset_code);
      const rows = await queryByAssetCodes(codes);
      res.json({ success: true, count: rows.length, data: rows, baselineDate: date, savedCodes: codes.length });
    } catch (err) {
      console.error('查询基准日数据失败:', err.message);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  // DELETE /api/instrument-meter/baseline/:date
  router.delete('/api/instrument-meter/baseline/:date', requirePermission('instrument_meter'), async (req, res) => {
    const date = req.params.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: '无效的基准日日期' });
    }
    try {
      const [result] = await pool.execute(
        'DELETE FROM instrument_meter_baselines WHERE baseline_date = ?',
        [date]
      );
      res.json({ success: true, deleted: result.affectedRows });
    } catch (err) {
      console.error('删除基准日失败:', err.message);
      res.status(500).json({ error: '删除失败: ' + err.message });
    }
  });

  // ========== 仪器/仪表到期邮件通知设置 ==========

  // GET /api/instrument-meter/notification-settings
  router.get('/api/instrument-meter/notification-settings', requirePermission('instrument_meter'), (req, res) => {
    const settings = getMeterNotificationSettings();
    const nextTimes = settings.enabled ? getMeterNextSendTimes(settings.intervalDays) : null;
    res.json({ success: true, data: settings, nextTimes });
  });

  // GET /api/instrument-meter/notification-users
  router.get('/api/instrument-meter/notification-users', requirePermission('instrument_meter'), async (req, res) => {
    try {
      const users = await getMeterUsersWithEmails();
      res.json({ success: true, data: users });
    } catch (err) {
      console.error('查询通知用户列表失败:', err.message);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  // PUT /api/instrument-meter/notification-settings
  router.put('/api/instrument-meter/notification-settings', requirePermission('instrument_meter'), async (req, res) => {
    const { enabled, intervalDays, recipients } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled 必须是布尔值' });
    }
    const validIntervals = [30, 45, 60, 90, 180];
    if (!validIntervals.includes(intervalDays)) {
      return res.status(400).json({ error: 'intervalDays 必须是 ' + validIntervals.join('/') + ' 之一' });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: '至少选择一个接收人' });
    }
    try {
      const updated = await updateMeterNotificationSettings(enabled, intervalDays, recipients);
      const nextTimes = enabled ? getMeterNextSendTimes(intervalDays) : null;
      res.json({ success: true, data: updated, nextTimes, message: `邮件通知已${enabled ? '开启' : '停用'}，间隔 ${intervalDays} 天` });
    } catch (err) {
      console.error('更新通知设置失败:', err.message);
      res.status(500).json({ error: '更新失败: ' + err.message });
    }
  });

  // ========== 设备过期工单推送 ==========

  const OVERDUE_WORKORDER_DEFAULT_SQL = `SELECT
  CONCAT(wo.wo_id, ' ', wo.wo_name) AS wo_info,
  CONCAT(a.asset_code, ' ', a.asset_name) AS asset_names,
  wo.wo_creation_time,
  wo.wo_target_time,
  CONCAT(mp.priority_code, ' ', mp.priority_name) AS asset_prioritys,
  CONCAT(mt.type_code, ' ', mt.type_name) AS asset_types,
  wo.wo_creator,
  ms.status_name_cn,
  COUNT(*) OVER() AS total_count
FROM wo_list wo
LEFT JOIN asset_list a ON wo.wo_asset_id = a.asset_id
LEFT JOIN mic_priority mp ON wo.wo_priority_id = mp.priority_id
LEFT JOIN mic_type mt ON wo.wo_type_id = mt.type_id
LEFT JOIN mic_status ms ON wo.wo_status = ms.status_id
WHERE wo.wo_target_time < NOW() AND wo.wo_status <= 5`;

  router.get('/api/overdue-workorder/sql', requirePermission('instrument_meter'), (req, res) => {
    res.json({ success: true, sql: OVERDUE_WORKORDER_DEFAULT_SQL });
  });

  router.post('/api/overdue-workorder', requirePermission('instrument_meter'), async (req, res) => {
    const sql = (req.body && req.body.sql) || OVERDUE_WORKORDER_DEFAULT_SQL;
    try {
      const [rows] = await micPool.execute(sql);
      const total = rows.length > 0 ? (rows[0].total_count || rows.length) : 0;
      res.json({ success: true, total, data: rows });
    } catch (err) {
      console.error('查询过期工单失败:', err);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  router.post('/api/overdue-workorder/push', requirePermission('instrument_meter'), async (req, res) => {
    const { data, total } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '无数据可推送' });
    }

    const webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=7f6b079d-6edd-42bf-a91f-99f774af6def';
    const statusEmoji = {
      '已创建': '⚪', '等待备件': '🟡', '等待外委': '🟣',
      '已安排': '🔵', '已搁置': '🔴', '进行中': '🟢'
    };
    const clean = (v) => v ? String(v).replace(/\|/g, ' ').replace(/\n/g, ' ').trim() : '';
    const batchSize = 15;
    const totalBatches = Math.ceil(data.length / batchSize);
    const results = [];

    try {
      for (let i = 0; i < data.length; i += batchSize) {
        const batchNo = Math.floor(i / batchSize) + 1;
        const batch = data.slice(i, i + batchSize);
        const lines = [
          '### 📋 延迟的工单列表',
          `#### 共查询到 ${total || data.length} 条延迟工单`,
          `#### 第 ${batchNo}/${totalBatches} 批`,
          '| 工单 | 资产 | 目标完成时间 | 类型 | 状态 |',
          '| :--- | :--- | :--- | :--- | :--- |'
        ];
        batch.forEach(item => {
          const woInfo = clean(item.wo_info);
          const assetName = clean(item.asset_names);
          const targetTime = clean(item.wo_target_time);
          const assetType = clean(item.asset_types);
          const statusName = clean(item.status_name_cn);
          const emoji = statusEmoji[statusName] || '⚪';
          lines.push(`| ${woInfo} | ${assetName} | ${targetTime} | ${assetType} | ${emoji} ${statusName} |`);
        });
        const markdown = lines.join('\n');
        const payload = { msgtype: 'markdown_v2', markdown_v2: { content: markdown } };
        const resp = await axios.post(webhookUrl, payload, { timeout: 10000 });
        results.push({ batch: batchNo, status: resp.status, data: resp.data });
      }

      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const contentSummary = `延迟工单推送，共 ${total || data.length} 条，${results.length} 批次`;
      await logPush('overdue_workorder', 'wechat', 'success', contentSummary, data.length, webhookUrl, pusher);
      res.json({ success: true, batch_count: results.length, results });
    } catch (err) {
      console.error('推送企业微信失败:', err);
      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('overdue_workorder', 'wechat', 'failed', `推送失败，共 ${data.length} 条`, data.length, webhookUrl, pusher, errMsg);
      res.status(500).json({ error: '推送失败: ' + errMsg });
    }
  });

  // ========== 每日未完成工单推送 ==========

  const DAILY_OVERDUE_WORKORDER_DEFAULT_SQL = `SELECT
  CONCAT(wo.wo_id, ' ', wo.wo_name) AS wo_info,
  CONCAT(a.asset_code, ' ', a.asset_name) AS asset_names,
  ae.employee_name AS responsible_name,
  wo.wo_schedule_time,
  ms.status_name_cn
FROM wo_list wo
LEFT JOIN asset_list a ON wo.wo_asset_id = a.asset_id
LEFT JOIN admin_employee ae ON wo.wo_responsible_id = ae.user_id
LEFT JOIN mic_status ms ON wo.wo_status = ms.status_id
WHERE DATE(wo.wo_creation_time) = CURDATE()
  AND wo.wo_type_id = 3
  AND wo.wo_finish_time IS NULL`;

  router.get('/api/daily-overdue-workorder/sql', requirePermission('instrument_meter'), (req, res) => {
    res.json({ success: true, sql: DAILY_OVERDUE_WORKORDER_DEFAULT_SQL });
  });

  router.post('/api/daily-overdue-workorder', requirePermission('instrument_meter'), async (req, res) => {
    const sql = (req.body && req.body.sql) || DAILY_OVERDUE_WORKORDER_DEFAULT_SQL;
    try {
      const [rows] = await micPool.execute(sql);
      res.json({ success: true, total: rows.length, data: rows });
    } catch (err) {
      console.error('查询每日未完成工单失败:', err);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  router.post('/api/daily-overdue-workorder/push', requirePermission('instrument_meter'), async (req, res) => {
    const { data, total } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '无数据可推送' });
    }

    const webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=e66d4f79-906d-4ab9-89e1-889c282002bd';
    const statusEmoji = {
      '已创建': '⚪', '等待备件': '🟡', '等待外委': '🟣',
      '已安排': '🔵', '已搁置': '🔴', '进行中': '🟢'
    };
    const clean = (v) => v ? String(v).replace(/\|/g, ' ').replace(/\n/g, ' ').trim() : '';
    const batchSize = 15;
    const totalBatches = Math.ceil(data.length / batchSize);
    const results = [];

    try {
      for (let i = 0; i < data.length; i += batchSize) {
        const batchNo = Math.floor(i / batchSize) + 1;
        const batch = data.slice(i, i + batchSize);
        const lines = [
          '### 📋 未完成日巡检工单列表',
          `#### 共查询到 ${total || data.length} 条未完成日工单`,
          `#### 第 ${batchNo}/${totalBatches} 批`,
          '| 工单 | 资产 | 负责人 | 安排时间 | 类型 | 状态 |',
          '| :--- | :--- | :--- | :--- | :--- | :--- |'
        ];
        batch.forEach(item => {
          const woInfo = clean(item.wo_info);
          const assetName = clean(item.asset_names);
          const responsibleName = clean(item.responsible_name) || '-';
          const scheduleTime = clean(item.wo_schedule_time);
          const statusName = clean(item.status_name_cn);
          const emoji = statusEmoji[statusName] || '⚪';
          lines.push(`| ${woInfo} | ${assetName} | ${responsibleName} | ${scheduleTime} | 日巡检工单 | ${emoji} ${statusName} |`);
        });
        const markdown = lines.join('\n');
        const payload = { msgtype: 'markdown_v2', markdown_v2: { content: markdown } };
        const resp = await axios.post(webhookUrl, payload, { timeout: 10000 });
        results.push({ batch: batchNo, status: resp.status, data: resp.data });
      }

      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const contentSummary = `未完成日巡检工单推送，共 ${total || data.length} 条，${results.length} 批次`;
      await logPush('daily_workorder', 'wechat', 'success', contentSummary, data.length, webhookUrl, pusher);
      res.json({ success: true, batch_count: results.length, results });
    } catch (err) {
      console.error('推送每日未完成工单失败:', err);
      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('daily_workorder', 'wechat', 'failed', `推送失败，共 ${data.length} 条`, data.length, webhookUrl, pusher, errMsg);
      res.status(500).json({ error: '推送失败: ' + errMsg });
    }
  });

  // ========== QC 维护计划推送 ==========

  const QC_MAINTENANCE_DEFAULT_SQL = `SELECT
    p.mp_code AS 'PM编码',
    CONCAT(IFNULL(a.asset_code, ''), ' - ', IFNULL(a.asset_name, '')) AS '设备',
    p.mp_name AS 'PM名称',
    COALESCE(e.employee_name, p.mp_responsible_id) AS '负责人',
    CASE p.mp_status
        WHEN 0 THEN '闲置'
        WHEN 1 THEN '活跃'
        WHEN 2 THEN '已搁置'
        ELSE CONCAT('未知状态(', p.mp_status, ')')
    END AS '状态',
    w.wo_schedule_time AS '计划执行时间'
FROM eng_maintenance_plan p
INNER JOIN wo_list w ON p.mp_id = w.mp_id
INNER JOIN asset_list a ON p.mp_asset_id = a.asset_id
LEFT JOIN admin_employee e ON p.mp_responsible_id = e.user_id
WHERE w.wo_status = 0
  AND w.mp_id IS NOT NULL
  AND p.mp_code LIKE 'QC-MP%'
ORDER BY w.wo_schedule_time`;

  router.get('/api/qc-maintenance/sql', requirePermission('instrument_meter'), (req, res) => {
    res.json({ success: true, sql: QC_MAINTENANCE_DEFAULT_SQL });
  });

  router.post('/api/qc-maintenance', requirePermission('instrument_meter'), async (req, res) => {
    const sql = (req.body && req.body.sql) || QC_MAINTENANCE_DEFAULT_SQL;
    try {
      const [rows] = await micPool.execute(sql);
      res.json({ success: true, total: rows.length, data: rows });
    } catch (err) {
      console.error('QC维护计划查询失败:', err.message);
      res.status(500).json({ error: 'SQL 查询失败: ' + err.message });
    }
  });

  router.post('/api/qc-maintenance/push', requirePermission('instrument_meter'), async (req, res) => {
    const { data, total } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '无数据可推送' });
    }

    const webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=53a94f71-37c6-4505-95fe-754ff0b2209c';
    const statusEmoji = { '闲置': '⚪', '活跃': '🟢', '已搁置': '🔴' };
    const clean = (v) => v ? String(v).replace(/\|/g, ' ').replace(/\n/g, ' ').trim() : '';
    const batchSize = 15;
    const totalBatches = Math.ceil(data.length / batchSize);
    const results = [];

    try {
      for (let i = 0; i < data.length; i += batchSize) {
        const batchNo = Math.floor(i / batchSize) + 1;
        const batch = data.slice(i, i + batchSize);
        const lines = [
          '### 🔧 QC维护计划待执行工单列表',
          `#### 共查询到 ${total || data.length} 条待执行工单`,
          `#### 第 ${batchNo}/${totalBatches} 批`,
          '| PM名称 | 负责人 | 计划执行时间 | PM编码 | 设备 | 状态 |',
          '| :--- | :--- | :--- | :--- | :--- | :--- |'
        ];
        batch.forEach(item => {
          const mpCode = clean(item['PM编码']);
          const asset = clean(item['设备']);
          const mpName = clean(item['PM名称']);
          const responsible = clean(item['负责人']);
          const status = clean(item['状态']);
          const scheduleTime = clean(item['计划执行时间']);
          const emoji = statusEmoji[status] || '⚪';
          lines.push(`| ${mpName} | ${responsible} | ${scheduleTime} | ${mpCode} | ${asset} | ${emoji} ${status} |`);
        });
        const markdown = lines.join('\n');
        const payload = { msgtype: 'markdown', markdown: { content: markdown } };
        const resp = await axios.post(webhookUrl, payload, { timeout: 10000 });
        results.push({ batch: batchNo, status: resp.status, data: resp.data });
      }

      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const contentSummary = `QC维护计划推送，共 ${total || data.length} 条，${results.length} 批次`;
      await logPush('qc_maintenance', 'wechat', 'success', contentSummary, data.length, webhookUrl, pusher);
      res.json({ success: true, batch_count: results.length, results });
    } catch (err) {
      console.error('推送QC维护计划失败:', err);
      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('qc_maintenance', 'wechat', 'failed', `推送失败，共 ${data.length} 条`, data.length, webhookUrl, pusher, errMsg);
      res.status(500).json({ error: '推送失败: ' + errMsg });
    }
  });

  // ========== 未处理请求推送 ==========

  const UNPROCESSED_REQUEST_DEFAULT_SQL = `SELECT
    m.mr_id,
    m.mr_name,
    m.mr_requester,
    m.mr_request_time,
    m.mr_failure_time,
    m.mr_description,
    p.priority_name
FROM mr_list m
LEFT JOIN asset_list a
    ON m.mr_asset_id = a.asset_id
LEFT JOIN mic_priority p
    ON m.mr_priority_id = p.priority_id
WHERE m.mr_status = 0`;

  router.get('/api/unprocessed-request/sql', requirePermission('instrument_meter'), (req, res) => {
    res.json({ success: true, sql: UNPROCESSED_REQUEST_DEFAULT_SQL });
  });

  router.post('/api/unprocessed-request', requirePermission('instrument_meter'), async (req, res) => {
    const sql = (req.body && req.body.sql) || UNPROCESSED_REQUEST_DEFAULT_SQL;
    try {
      const [rows] = await micPool.execute(sql);
      res.json({ success: true, total: rows.length, data: rows });
    } catch (err) {
      console.error('查询未处理请求失败:', err);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  router.post('/api/unprocessed-request/push', requirePermission('instrument_meter'), async (req, res) => {
    const { data, total } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '无数据可推送' });
    }

    const webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=e66d4f79-906d-4ab9-89e1-889c282002bd';
    const clean = (v) => v ? String(v).replace(/\n/g, ' ').trim() : '';
    const results = [];

    try {
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const markdown = `### \uD83D\uDCCC 未处理的报修单通知

- **报修ID**: ${clean(item.mr_id)}
- **固定资产名称**: ${clean(item.mr_name)}
- **报修名称**: ${clean(item.mr_name)}
- **报修人**: ${clean(item.mr_requester)}
- **报修时间**: ${clean(item.mr_request_time)}
- **失效发生时间**: ${clean(item.mr_failure_time)}
- **问题描述**: ${clean(item.mr_description)}
- **优先级**: ${clean(item.priority_name)}`;
        const payload = { msgtype: 'markdown', markdown: { content: markdown } };
        const resp = await axios.post(webhookUrl, payload, { timeout: 10000 });
        results.push({ index: i + 1, status: resp.status, data: resp.data });
      }

      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const contentSummary = `未处理请求推送，共 ${total || data.length} 条，${results.length} 条推送`;
      await logPush('unprocessed_request', 'wechat', 'success', contentSummary, data.length, webhookUrl, pusher);
      res.json({ success: true, batch_count: results.length, results });
    } catch (err) {
      console.error('推送未处理请求失败:', err);
      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('unprocessed_request', 'wechat', 'failed', `推送失败，共 ${data.length} 条`, data.length, webhookUrl, pusher, errMsg);
      res.status(500).json({ error: '推送失败: ' + errMsg });
    }
  });

  // ========== 新增报修单推送 ==========

  const NEW_REPAIR_DEFAULT_SQL = `SELECT 
    mr.mr_id,
    mr.mr_name,
    mr.mr_requester,
    mr.mr_request_time,
    mr.mr_failure_time,
    mr.mr_description,
    CONCAT(a.asset_code, ' ', a.asset_name) AS asset_info,
    p.priority_name
FROM 
    mr_list mr
LEFT JOIN 
    asset_list a ON mr.mr_asset_id = a.asset_id
LEFT JOIN 
    mic_priority p ON mr.mr_priority_id = p.priority_id
WHERE 
    mr.mr_id > last_time_mr_id`;

  router.get('/api/new-repair/sql', requirePermission('instrument_meter'), async (req, res) => {
    try {
      await pool.execute(
        "INSERT IGNORE INTO push_state (push_type, last_mr_id) VALUES ('new_repair', 0)"
      );
      const [rows] = await pool.execute(
        "SELECT last_mr_id FROM push_state WHERE push_type = 'new_repair'"
      );
      const lastMrId = rows.length > 0 ? rows[0].last_mr_id : 0;
      res.json({ success: true, sql: NEW_REPAIR_DEFAULT_SQL, last_time_mr_id: lastMrId });
    } catch (err) {
      console.error('获取新增报修单状态失败:', err.message);
      res.json({ success: true, sql: NEW_REPAIR_DEFAULT_SQL, last_time_mr_id: 0 });
    }
  });

  router.post('/api/new-repair', requirePermission('instrument_meter'), async (req, res) => {
    try {
      const [stateRows] = await pool.execute(
        "SELECT last_mr_id FROM push_state WHERE push_type = 'new_repair'"
      );
      const lastMrId = stateRows.length > 0 ? stateRows[0].last_mr_id : 0;

      const sql = `SELECT 
      mr.mr_id, mr.mr_name, mr.mr_requester, mr.mr_request_time,
      mr.mr_failure_time, mr.mr_description,
      CONCAT(a.asset_code, ' ', a.asset_name) AS asset_info,
      p.priority_name
    FROM mr_list mr
    LEFT JOIN asset_list a ON mr.mr_asset_id = a.asset_id
    LEFT JOIN mic_priority p ON mr.mr_priority_id = p.priority_id
    WHERE mr.mr_id > ?
    ORDER BY mr.mr_id ASC`;

      const [rows] = await micPool.execute(sql, [lastMrId]);
      res.json({ success: true, total: rows.length, data: rows, last_time_mr_id: lastMrId });
    } catch (err) {
      console.error('查询新增报修单失败:', err);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  router.post('/api/new-repair/push', requirePermission('instrument_meter'), async (req, res) => {
    const { data, total } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '无数据可推送' });
    }

    const webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=e66d4f79-906d-4ab9-89e1-889c282002bd';
    const clean = (v) => v ? String(v).replace(/\n/g, ' ').trim() : '';
    const results = [];

    try {
      for (const item of data) {
        const markdown = `### 🛠️ 新增报修单通知

- **报修ID**: ${clean(item.mr_id)}
- **固定资产名称**: ${clean(item.mr_name)}
- **报修名称**: ${clean(item.mr_name)}
- **报修人**: ${clean(item.mr_requester)}
- **报修时间**: ${clean(item.mr_request_time)}
- **失效发生时间**: ${clean(item.mr_failure_time)}
- **问题描述**: ${clean(item.mr_description)}
- **优先级**: ${clean(item.priority_name)}`;
        const payload = { msgtype: 'markdown', markdown: { content: markdown } };
        const resp = await axios.post(webhookUrl, payload, { timeout: 10000 });
        results.push({ mr_id: item.mr_id, status: resp.status });
      }

      const maxMrId = Math.max(...data.map(r => r.mr_id));
      await pool.execute('UPDATE push_state SET last_mr_id = ? WHERE push_type = ?', [maxMrId, 'new_repair']);

      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const contentSummary = `新增报修单推送，共 ${total || data.length} 条`;
      await logPush('new_repair', 'wechat', 'success', contentSummary, data.length, webhookUrl, pusher);
      res.json({ success: true, push_count: results.length, last_time_mr_id: maxMrId });
    } catch (err) {
      console.error('推送新增报修单失败:', err);
      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('new_repair', 'wechat', 'failed', `推送失败，共 ${data.length} 条`, data.length, webhookUrl, pusher, errMsg);
      res.status(500).json({ error: '推送失败: ' + errMsg });
    }
  });

  // ========== 新增出库单推送 ==========

  const NEW_ISSUE_DEFAULT_SQL = `SELECT
    i.issue_id,
    i.issue_creator,
    i.issue_creation_time,
    i.wo_id,
    w.wo_name,
    s.sp_code,
    s.sp_name,
    d.issue_qty,
    ae.employee_name AS submitted_to_name
FROM sp_issue i
LEFT JOIN wo_list w
    ON i.wo_id = w.wo_id
LEFT JOIN admin_employee ae
    ON i.issue_submitted_to = ae.user_id
LEFT JOIN sp_issue_details d
    ON i.issue_id = d.issue_id
LEFT JOIN sp_list s
    ON d.sp_id = s.sp_id
WHERE i.issue_status = 5
ORDER BY i.issue_id ASC, d.issue_id ASC`;

  router.get('/api/new-issue/sql', requirePermission('instrument_meter'), async (req, res) => {
    res.json({ success: true, sql: NEW_ISSUE_DEFAULT_SQL });
  });

  router.post('/api/new-issue', requirePermission('instrument_meter'), async (req, res) => {
    try {
      const sql = (req.body && req.body.sql) ? req.body.sql : NEW_ISSUE_DEFAULT_SQL;
      console.log('[new-issue] 执行查询 SQL...');
      const [rows] = await micPool.execute(sql);
      console.log(`[new-issue] 查询完成，返回 ${rows.length} 条记录`);
      res.json({ success: true, total: rows.length, data: rows });
    } catch (err) {
      console.error('[new-issue] 查询未处理出库单失败:', err.message);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  router.post('/api/new-issue/push', requirePermission('instrument_meter'), async (req, res) => {
    const { data, total } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '无数据可推送' });
    }

    const webhookUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=7f6b079d-6edd-42bf-a91f-99f774af6def';
    const clean = (v) => v ? String(v).replace(/\|/g, ' ').replace(/\n/g, ' ').trim() : '';
    const results = [];

    const TABLE_HEADER = `| 申请ID | 申请人 | 提交时间 | 工单ID | 工单名 | 申请部品名 | 申请数量 | 核实人 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`;

    try {
      const lines = [
        '### 📦 新增出库单通知',
        `#### 共 ${data.length} 条记录`,
        TABLE_HEADER
      ];

      data.forEach(item => {
        const spName = [clean(item.sp_code), clean(item.sp_name)].filter(Boolean).join(' ');
        const parts = [
          clean(item.issue_id),
          clean(item.issue_creator),
          clean(item.issue_creation_time),
          clean(item.wo_id),
          clean(item.wo_name),
          spName,
          clean(item.issue_qty),
          clean(item.submitted_to_name)
        ];
        lines.push('| ' + parts.join(' | ') + ' |');
      });

      const markdown = lines.join('\n');
      const payload = { msgtype: 'markdown_v2', markdown_v2: { content: markdown } };
      const resp = await axios.post(webhookUrl, payload, { timeout: 10000 });
      results.push({ count: data.length, status: resp.status });

      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const contentSummary = `新增出库单推送，共 ${total || data.length} 条`;
      await logPush('new_issue', 'wechat', 'success', contentSummary, data.length, webhookUrl, pusher);
      res.json({ success: true, push_count: results.length });
    } catch (err) {
      console.error('推送新增出库单失败:', err);
      const pusher = (req.session && req.session.username) ? req.session.username : 'unknown';
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('new_issue', 'wechat', 'failed', `推送失败，共 ${data.length} 条`, data.length, webhookUrl, pusher, errMsg);
      res.status(500).json({ error: '推送失败: ' + errMsg });
    }
  });

  // ========== 推送日志 ==========

  // GET /api/push-logs
  router.get('/api/push-logs', requirePermission('instrument_meter'), async (req, res) => {
    try {
      const { source, page = 1, pageSize = 30 } = req.query;
      const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
      const limit = parseInt(pageSize, 10);

      let whereClause = '';
      const params = [];
      if (source && (source === 'instrument_meter' || source === 'overdue_workorder' || source === 'daily_workorder' || source === 'qc_maintenance' || source === 'unprocessed_request' || source === 'new_repair' || source === 'new_issue')) {
        whereClause = 'WHERE source = ?';
        params.push(source);
      }

      const [countRows] = await pool.execute(
        `SELECT COUNT(*) AS total FROM push_logs ${whereClause}`, params
      );
      const total = countRows[0].total;

      const [dataRows] = await pool.execute(
        `SELECT id, source, push_time, push_method, push_status, push_content, record_count, push_target, pusher, error_message, created_at
       FROM push_logs ${whereClause}
       ORDER BY push_time DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const [successRows] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM push_logs ${whereClause ? whereClause + ' AND push_status = \'success\'' : "WHERE push_status = 'success'"}`, params
      );
      const [failedRows] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM push_logs ${whereClause ? whereClause + ' AND push_status = \'failed\'' : "WHERE push_status = 'failed'"}`, params
      );

      res.json({
        success: true,
        data: dataRows,
        total,
        successCount: successRows[0].cnt,
        failedCount: failedRows[0].cnt
      });
    } catch (err) {
      console.error('查询推送日志失败:', err.message);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  return router;
};
