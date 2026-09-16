/**
 * 打印与查询路由：/api/print, /api/search, /api/print-logs, /api/production-record-print-logs
 */
const express = require('express');
const puppeteer = require('puppeteer');
const {
  findChrome, fetchMssqlData, getQueryType,
  loadTemplates, getRenderFunctions, resolveCssForTasks,
  buildPrintHTML, buildTrainingSummaryHTML, generatePDFBuffer, mergePDFs,
  LANDSCAPE_TEMPLATES, IMAGE_BASE_URL, PRODUCTION_QUERY_FIELD_MAPPING
} = require('../services/print.service');

module.exports = function setupPrintRoutes(deps) {
  const { pool, mssqlPool, auth } = deps;
  const router = express.Router();
  const { requirePermission } = auth;

  // TPL_NAME_MAP for CSV export
  const TPL_NAME_MAP = {
    cover: '封皮',
    batchrecord: '配料工序生产记录',
    mixingrecord: '密炼工序生产记录',
    calenderingrecord: '压延工序生产记录',
    vulcanizingrecord: '硫化工序生产记录',
    trimmingrecord: '除边工序生产记录',
    cleaningrecord: '清洗工序生产记录',
    materialbalance: '橡胶车间物料平衡单',
    labelrecord: '标签打印使用、销毁记录',
    outsourcingrecord: '外包工序生产记录',
    innerpackingrecord: '内包工序生产记录',
    batchingcleanup: '配料工序清场记录',
    mixingcleanup: '密炼工序清场记录',
    calenderingcleanup: '压延出片工序清场记录',
    vulcanizingcleanup: '硫化工序清场记录',
    trimmingcleanup: '除边工序清场记录',
    washingcleanup: '清洗工序清场记录',
    innerpackagingcleanup: '内包工序清场记录',
    outerpackagingcleanup: '外包工序清场记录',
    mixingcleanup1: '开炼工序清场记录（1#）',
    mixingcleanup2: '开炼工序清场记录（2#）',
    washingprecleanup: '清洗工序预清洗清场记录',
    mixingproduction1: '开炼工序生产记录（1#）',
    mixingproduction2: '开炼工序生产记录（2#）',
    testsamplevulcanizing: '试样硫化生产记录'
  };

  // POST /api/print
  router.post('/api/print', requirePermission('print'), async (req, res) => {
    const { querydata, selectedPici, tasks } = req.body;

    if (!querydata || typeof querydata !== 'string') {
      return res.status(400).json({ error: '缺少查询条件 querydata' });
    }
    if (!Array.isArray(selectedPici) || selectedPici.length === 0) {
      return res.status(400).json({ error: '缺少选中的记录标识 selectedPici' });
    }
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ error: '缺少打印任务 tasks' });
    }

    let browser;
    try {
      const allRecords = await fetchMssqlData(mssqlPool, querydata);
      const records = allRecords.filter(row => selectedPici.includes(row.pici));

      if (records.length === 0) {
        return res.status(400).json({ error: '选中的批次号在数据源中未找到，可能已被篡改' });
      }

      const { jsCode, cssMap, templateCssMap } = await loadTemplates(pool);
      const fns = getRenderFunctions(jsCode);

      const groups = [];
      for (const task of tasks) {
        const isLandscape = LANDSCAPE_TEMPLATES.has(task.template);
        if (groups.length === 0 || groups[groups.length - 1].isLandscape !== isLandscape) {
          groups.push({ isLandscape, tasks: [task] });
        } else {
          groups[groups.length - 1].tasks.push(task);
        }
      }

      const chromePath = findChrome();
      const launchOptions = {
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      };
      if (chromePath) {
        console.log('使用系统 Chromium:', chromePath);
        launchOptions.executablePath = chromePath;
      }
      browser = await puppeteer.launch(launchOptions);

      const buffers = [];
      for (const group of groups) {
        const cssCode = resolveCssForTasks(group.tasks, cssMap, templateCssMap);
        const buffer = await generatePDFBuffer(browser, records, group.tasks, fns, group.isLandscape, cssCode);
        buffers.push(buffer);
      }

      await browser.close();
      browser = null;

      let pdfBuffer;
      if (buffers.length === 1) {
        pdfBuffer = buffers[0];
      } else {
        pdfBuffer = await mergePDFs(buffers);
      }

      try {
        const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
        await pool.execute(
          'INSERT INTO print_logs (username, querydata, selected_pici, templates, ip_address) VALUES (?, ?, ?, ?, ?)',
          [req.session.username, querydata, JSON.stringify(selectedPici), JSON.stringify(tasks), clientIp]
        );
      } catch (logErr) {
        console.error('打印日志记录失败:', logErr.message);
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="print-output.pdf"');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (err) {
      console.error('PDF 生成失败:', err);
      if (browser) await browser.close().catch(() => {});
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/print/training-summary
  router.post('/api/print/training-summary', requirePermission('training_records'), async (req, res) => {
    const { username } = req.body;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: '缺少用户名 username' });
    }

    let browser;
    try {
      const [userRows] = await pool.execute(
        'SELECT username, chinese_name, department, position, hire_date FROM users WHERE username = ?',
        [username]
      );
      const user = userRows[0] || { username };

      const [recordRows] = await pool.execute(
        `SELECT training_date, training_content, training_hours, training_form,
              assessment_method, assessment_result, trainer
       FROM training_records
       WHERE username = ?
       ORDER BY training_date ASC, id ASC`,
        [username]
      );

      const { jsCode, cssMap, templateCssMap } = await loadTemplates(pool);
      const fns = getRenderFunctions(jsCode);
      if (!fns.renderUserTrainingSummary) {
        return res.status(500).json({ error: '未找到用户培训记录汇总模板 renderUserTrainingSummary' });
      }

      const cssId = templateCssMap['usertrainingrecord'];
      const cssCode = (cssId && cssMap[cssId]) || Object.values(cssMap)[0];

      const html = buildTrainingSummaryHTML(user, recordRows, fns, cssCode);

      const chromePath = findChrome();
      const launchOptions = {
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      };
      if (chromePath) {
        console.log('使用系统 Chromium:', chromePath);
        launchOptions.executablePath = chromePath;
      }
      browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buffer = await page.pdf({
        format: 'A4',
        landscape: false,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
      });
      await page.close();
      await browser.close();
      browser = null;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="training-summary.pdf"');
      res.setHeader('Content-Length', buffer.length);
      res.end(buffer);
    } catch (err) {
      console.error('培训记录汇总 PDF 生成失败:', err);
      if (browser) await browser.close().catch(() => {});
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/search
  router.post('/api/search', requirePermission('print'), async (req, res) => {
    const { querydata } = req.body;
    if (!querydata || typeof querydata !== 'string') {
      return res.status(400).json({ error: '缺少查询条件 querydata' });
    }

    try {
      const records = await fetchMssqlData(mssqlPool, querydata);

      // 异步记录生产记录打印数据库查询日志（不阻塞响应）
      const queryType = getQueryType(querydata);
      const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
      const resultFields = records.length > 0 ? Object.keys(records[0]) : [];
      pool.execute(
        `INSERT INTO production_record_print_log
        (username, query_condition, query_type, source_table, result_count, result_data, result_fields, field_mapping, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          req.session.username,
          querydata,
          queryType,
          PRODUCTION_QUERY_FIELD_MAPPING.source_table,
          records.length,
          JSON.stringify(records),
          JSON.stringify(resultFields),
          JSON.stringify(PRODUCTION_QUERY_FIELD_MAPPING),
          clientIp
        ]
      ).catch(err => console.error('生产记录打印日志写入失败:', err.message));

      res.json({ success: true, data: records });
    } catch (err) {
      console.error('查询失败:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/print-logs
  router.get('/api/print-logs', requirePermission('logs'), async (req, res) => {
    try {
      const isAdmin = req.session.username === 'admin';
      let sql = 'SELECT id, username, querydata, selected_pici, templates, ip_address, created_at FROM print_logs';
      const params = [];

      if (!isAdmin) {
        sql += ' WHERE username = ?';
        params.push(req.session.username);
      }

      sql += ' ORDER BY created_at DESC LIMIT 200';

      const [rows] = await pool.execute(sql, params);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询打印日志失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // GET /api/print-logs/export
  router.get('/api/print-logs/export', requirePermission('logs'), async (req, res) => {
    try {
      const isAdmin = req.session.username === 'admin';
      let sql = 'SELECT username, querydata, selected_pici, templates, ip_address, created_at FROM print_logs';
      const params = [];

      if (!isAdmin) {
        sql += ' WHERE username = ?';
        params.push(req.session.username);
      }

      sql += ' ORDER BY created_at DESC';

      const [rows] = await pool.execute(sql, params);

      let csv = '\uFEFF时间,用户名,单据编号,选中批次,使用模板,IP地址\n';

      rows.forEach(row => {
        const time = row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '';
        let templatesStr = '';
        try {
          const tpls = JSON.parse(row.templates);
          templatesStr = tpls.map(t => {
            const name = TPL_NAME_MAP[t.template] || t.template;
            return name + ' × ' + (t.copies || 1) + '张';
          }).join(', ');
        } catch (e) {
          templatesStr = row.templates || '';
        }

        let piciStr = '';
        try {
          const picis = JSON.parse(row.selected_pici);
          piciStr = Array.isArray(picis) ? picis.join(', ') : row.selected_pici;
        } catch (e) {
          piciStr = row.selected_pici || '';
        }

        const fields = [time, row.username || '', row.querydata || '', piciStr, templatesStr, row.ip_address || ''];
        csv += fields.map(f => `"${(f || '').replace(/"/g, '""')}"`).join(',') + '\n';
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=print-logs.csv');
      res.send(csv);
    } catch (err) {
      console.error('导出打印日志失败:', err);
      res.status(500).json({ error: '导出失败' });
    }
  });

  // GET /api/production-record-print-logs
  router.get('/api/production-record-print-logs', requirePermission('logs'), async (req, res) => {
    try {
      const isAdmin = req.session.username === 'admin';
      let sql = 'SELECT id, query_time, username, query_condition, query_type, source_table, result_count, result_fields, field_mapping, ip_address FROM production_record_print_log';
      const params = [];

      if (!isAdmin) {
        sql += ' WHERE username = ?';
        params.push(req.session.username);
      }

      sql += ' ORDER BY query_time DESC LIMIT 500';

      const [rows] = await pool.execute(sql, params);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询生产记录打印日志失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // GET /api/production-record-print-logs/:id
  router.get('/api/production-record-print-logs/:id', requirePermission('logs'), async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const isAdmin = req.session.username === 'admin';
      let sql = 'SELECT * FROM production_record_print_log';
      const params = [];

      if (isAdmin) {
        sql += ' WHERE id = ?';
      } else {
        sql += ' WHERE id = ? AND username = ?';
        params.push(req.session.username);
      }
      params.unshift(id);

      const [rows] = await pool.execute(sql, params);
      if (rows.length === 0) {
        return res.status(404).json({ error: '日志不存在' });
      }
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      console.error('查询日志详情失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  return router;
};
