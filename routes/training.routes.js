/**
 * 培训记录路由：培训记录 CRUD、年度培训计划 CRUD + 导入 + 模板下载
 */
const express = require('express');
const { parseCsv, ANNUAL_PLAN_CSV_HEADERS } = require('../services/csv.service');

module.exports = function setupTrainingRoutes(deps) {
  const { pool, auth, logOperation } = deps;
  const router = express.Router();
  const { requirePermission } = auth;

  // API：批量插入培训记录（需 training_records 权限）
  router.post('/api/training-records', requirePermission('training_records'), async (req, res) => {
    const {
      training_date,
      training_content,
      training_hours,
      training_form,
      assessment_method,
      assessment_result,
      trainer,
      usernames
    } = req.body;

    if (!training_date) {
      return res.status(400).json({ error: '缺少培训日期' });
    }
    if (!training_content || typeof training_content !== 'string' || !training_content.trim()) {
      return res.status(400).json({ error: '缺少培训内容' });
    }
    if (!Array.isArray(usernames) || usernames.length === 0) {
      return res.status(400).json({ error: '至少选择一名参训人员' });
    }

    const hours = training_hours != null && training_hours !== '' ? parseFloat(training_hours) : null;
    if (hours != null && (isNaN(hours) || hours < 0)) {
      return res.status(400).json({ error: '培训课时格式不正确' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 校验所有用户名是否存在
      const placeholders = usernames.map(() => '?').join(',');
      const [existing] = await connection.execute(
        `SELECT username FROM users WHERE username IN (${placeholders})`,
        usernames
      );
      const existingSet = new Set(existing.map(r => r.username));
      const notFound = usernames.filter(u => !existingSet.has(u));
      if (notFound.length > 0) {
        await connection.rollback();
        return res.status(400).json({ error: `以下用户不存在: ${notFound.join(', ')}` });
      }

      // 批量插入
      const insertSql = `INSERT INTO training_records
      (username, training_date, training_content, training_hours, training_form, assessment_method, assessment_result, trainer)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      for (const username of usernames) {
        await connection.execute(insertSql, [
          username,
          training_date,
          training_content.trim(),
          hours,
          training_form || null,
          assessment_method || null,
          assessment_result || null,
          trainer ? trainer.trim() : null
        ]);
      }

      await connection.commit();

      await logOperation(req, '录入培训记录', 'training_records', null, `培训日期: ${training_date}, 参训人数: ${usernames.length}`);

      res.json({ success: true, message: `已成功录入 ${usernames.length} 条培训记录` });
    } catch (err) {
      await connection.rollback();
      console.error('录入培训记录失败:', err);
      res.status(500).json({ error: '录入失败' });
    } finally {
      connection.release();
    }
  });

  // API：查询培训记录筛选选项（需 training_records 权限）
  router.get('/api/training-records/filter-options', requirePermission('training_records'), async (req, res) => {
    try {
      const [yearRows] = await pool.execute(
        `SELECT DISTINCT YEAR(training_date) AS year FROM training_records WHERE training_date IS NOT NULL ORDER BY year DESC`
      );
      const [userRows] = await pool.execute(
        `SELECT DISTINCT tr.username, u.chinese_name
       FROM training_records tr
       LEFT JOIN users u ON tr.username = u.username
       WHERE tr.username IS NOT NULL
       ORDER BY u.chinese_name ASC, tr.username ASC`
      );
      const [contentRows] = await pool.execute(
        `SELECT DISTINCT training_content FROM training_records WHERE training_content IS NOT NULL AND training_content != '' ORDER BY training_content ASC`
      );
      const [trainerRows] = await pool.execute(
        `SELECT DISTINCT trainer FROM training_records WHERE trainer IS NOT NULL AND trainer != '' ORDER BY trainer ASC`
      );

      res.json({
        success: true,
        data: {
          years: yearRows.map(r => r.year).filter(y => y != null),
          users: userRows.map(r => ({ username: r.username, chinese_name: r.chinese_name })).filter(u => u.username != null),
          training_contents: contentRows.map(r => r.training_content).filter(c => c != null),
          trainers: trainerRows.map(r => r.trainer).filter(t => t != null)
        }
      });
    } catch (err) {
      console.error('查询培训记录筛选选项失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：查询培训记录列表（需 training_records 权限）
  router.get('/api/training-records', requirePermission('training_records'), async (req, res) => {
    const { year, username, chinese_name, training_content, trainer } = req.query;

    const conditions = [];
    const params = [];

    if (year != null && year !== '') {
      conditions.push('YEAR(tr.training_date) = ?');
      params.push(parseInt(year, 10));
    }

    // 用户名筛选分支：
    // 1) username === '__ALL__' 或空：不拼接用户相关条件
    // 2) username 有值：按账号精确匹配
    // 3) 仅 chinese_name 有值：左关联 user 表模糊匹配中文姓名
    if (username === '__ALL__') {
      // 选择「全部用户」，不拼接用户筛选条件
    } else if (username != null && username !== '') {
      conditions.push('tr.username = ?');
      params.push(username);
    } else if (chinese_name != null && chinese_name !== '') {
      conditions.push('u.chinese_name LIKE ?');
      params.push('%' + chinese_name + '%');
    }

    if (training_content != null && training_content !== '') {
      conditions.push('tr.training_content = ?');
      params.push(training_content);
    }
    if (trainer != null && trainer !== '') {
      conditions.push('tr.trainer = ?');
      params.push(trainer);
    }

    let sql = `SELECT tr.id, tr.username, u.chinese_name, tr.training_date, tr.training_content, tr.training_hours,
                    tr.training_form, tr.assessment_method, tr.assessment_result, tr.trainer,
                    tr.created_at, tr.updated_at
             FROM training_records tr
             LEFT JOIN users u ON tr.username = u.username`;
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY tr.training_date DESC, tr.id DESC';

    try {
      const [rows] = await pool.execute(sql, params);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询培训记录失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：查询年度培训计划列表（需 training_records 权限）
  router.get('/api/annual-training-plans', requirePermission('training_records'), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, \`year\`, department, training_content, target_trainees, training_method, training_type,
              trainer, price, training_hours, training_schedule, need_assessment, tracking, is_notified,
              created_at, updated_at
       FROM annual_training_plans
       ORDER BY \`year\` DESC, department ASC, id ASC`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询年度培训计划失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：下载年度培训计划 CSV 模板（需 training_records 权限）
  router.get('/api/annual-training-plans/template', requirePermission('training_records'), (req, res) => {
    const csv = '\uFEFF' + ANNUAL_PLAN_CSV_HEADERS + '\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=annual-training-plan-template.csv');
    res.send(csv);
  });

  // API：从 CSV 导入年度培训计划（需 training_records 权限）
  router.post('/api/annual-training-plans/import', requirePermission('training_records'), async (req, res) => {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: '缺少 CSV 内容' });
    }

    const rows = parseCsv(csv);
    if (rows.length < 2) {
      return res.status(400).json({ error: 'CSV 文件中缺少数据行' });
    }

    const headers = rows[0].map(h => h.trim());
    const requiredHeaders = ['年度', '部门', '培训项目/课程/内容'];
    const missing = requiredHeaders.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      return res.status(400).json({ error: `CSV 表头缺少必填列: ${missing.join(', ')}` });
    }

    function cell(name, cells) {
      const idx = headers.indexOf(name);
      return idx >= 0 && idx < cells.length ? cells[idx].trim() : '';
    }

    function parseBool(value) {
      const s = String(value).trim();
      if (!s) return 0;
      const lower = s.toLowerCase();
      if (s === '是' || s === '1' || lower === 'true' || lower === 'yes' || lower === 'y') return 1;
      return 0;
    }

    const plans = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      if (cells.length === 1 && cells[0].trim() === '') continue;
      if (cells.every(c => c.trim() === '')) continue;

      const yearRaw = cell('年度', cells);
      const year = parseInt(yearRaw, 10);
      if (isNaN(year) || year < 1900 || year > 9999) {
        return res.status(400).json({ error: `第 ${i + 1} 行年度格式不正确` });
      }

      const department = cell('部门', cells);
      if (!department) {
        return res.status(400).json({ error: `第 ${i + 1} 行缺少部门` });
      }

      const trainingContent = cell('培训项目/课程/内容', cells);
      if (!trainingContent) {
        return res.status(400).json({ error: `第 ${i + 1} 行缺少培训项目/课程/内容` });
      }

      const priceRaw = cell('价格', cells);
      let price = null;
      if (priceRaw !== '') {
        price = parseFloat(priceRaw);
        if (isNaN(price) || price < 0) {
          return res.status(400).json({ error: `第 ${i + 1} 行价格格式不正确` });
        }
      }

      const hoursRaw = cell('培训课时', cells);
      let trainingHours = null;
      if (hoursRaw !== '') {
        trainingHours = parseFloat(hoursRaw);
        if (isNaN(trainingHours) || trainingHours < 0) {
          return res.status(400).json({ error: `第 ${i + 1} 行培训课时格式不正确` });
        }
      }

      plans.push({
        year,
        department,
        training_content: trainingContent,
        target_trainees: cell('目标学员', cells) || null,
        training_method: cell('培训方式', cells) || null,
        training_type: cell('内训/外训', cells) || null,
        trainer: cell('讲师', cells) || null,
        price,
        training_hours: trainingHours,
        training_schedule: cell('培训日程', cells) || null,
        need_assessment: parseBool(cell('是否考核', cells)),
        tracking: cell('跟踪', cells) || null,
        is_notified: parseBool(cell('是否通知', cells))
      });
    }

    if (plans.length === 0) {
      return res.status(400).json({ error: 'CSV 中没有可导入的有效数据' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const insertSql = `INSERT INTO annual_training_plans
      (\`year\`, department, training_content, target_trainees, training_method, training_type,
       trainer, price, training_hours, training_schedule, need_assessment, tracking, is_notified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      for (const plan of plans) {
        await connection.execute(insertSql, [
          plan.year,
          plan.department,
          plan.training_content,
          plan.target_trainees,
          plan.training_method,
          plan.training_type,
          plan.trainer,
          plan.price,
          plan.training_hours,
          plan.training_schedule,
          plan.need_assessment,
          plan.tracking,
          plan.is_notified
        ]);
      }
      await connection.commit();

      await logOperation(req, '导入年度培训计划', 'annual_training_plan', null, `导入数量: ${plans.length}`);

      res.json({ success: true, message: `成功导入 ${plans.length} 条年度培训计划` });
    } catch (err) {
      await connection.rollback();
      console.error('导入年度培训计划失败:', err);
      res.status(500).json({ error: '导入失败' });
    } finally {
      connection.release();
    }
  });

  // API：新增年度培训计划（需 training_records 权限）
  router.post('/api/annual-training-plans', requirePermission('training_records'), async (req, res) => {
    const {
      year, department, training_content, target_trainees, training_method, training_type,
      trainer, price, training_hours, training_schedule, need_assessment, tracking, is_notified
    } = req.body;

    const yearValue = parseInt(year, 10);
    if (isNaN(yearValue) || yearValue < 1900 || yearValue > 9999) {
      return res.status(400).json({ error: '年度格式不正确' });
    }
    if (!department || typeof department !== 'string' || !department.trim()) {
      return res.status(400).json({ error: '缺少部门' });
    }
    if (!training_content || typeof training_content !== 'string' || !training_content.trim()) {
      return res.status(400).json({ error: '缺少培训项目/课程/内容' });
    }

    const hours = training_hours != null && training_hours !== '' ? parseFloat(training_hours) : null;
    if (hours != null && (isNaN(hours) || hours < 0)) {
      return res.status(400).json({ error: '培训课时格式不正确' });
    }
    const priceValue = price != null && price !== '' ? parseFloat(price) : null;
    if (priceValue != null && (isNaN(priceValue) || priceValue < 0)) {
      return res.status(400).json({ error: '价格格式不正确' });
    }

    try {
      const [result] = await pool.execute(
        `INSERT INTO annual_training_plans
       (\`year\`, department, training_content, target_trainees, training_method, training_type,
        trainer, price, training_hours, training_schedule, need_assessment, tracking, is_notified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          yearValue,
          department.trim(),
          training_content.trim(),
          target_trainees ? target_trainees.trim() : null,
          training_method || null,
          training_type || null,
          trainer ? trainer.trim() : null,
          priceValue,
          hours,
          training_schedule ? training_schedule.trim() : null,
          need_assessment === true || need_assessment === 1 ? 1 : 0,
          tracking ? tracking.trim() : null,
          is_notified === true || is_notified === 1 ? 1 : 0
        ]
      );

      await logOperation(req, '新增年度培训计划', 'annual_training_plan', result.insertId, `年度: ${yearValue}, 部门: ${department.trim()}`);

      res.json({ success: true, message: '年度培训计划已添加', id: result.insertId });
    } catch (err) {
      console.error('新增年度培训计划失败:', err);
      res.status(500).json({ error: '添加失败' });
    }
  });

  // API：更新年度培训计划（需 training_records 权限）
  router.put('/api/annual-training-plans/:id', requirePermission('training_records'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: '缺少计划ID' });
    }

    const {
      year, department, training_content, target_trainees, training_method, training_type,
      trainer, price, training_hours, training_schedule, need_assessment, tracking, is_notified
    } = req.body;

    const yearValue = parseInt(year, 10);
    if (isNaN(yearValue) || yearValue < 1900 || yearValue > 9999) {
      return res.status(400).json({ error: '年度格式不正确' });
    }
    if (!department || typeof department !== 'string' || !department.trim()) {
      return res.status(400).json({ error: '缺少部门' });
    }
    if (!training_content || typeof training_content !== 'string' || !training_content.trim()) {
      return res.status(400).json({ error: '缺少培训项目/课程/内容' });
    }

    const hours = training_hours != null && training_hours !== '' ? parseFloat(training_hours) : null;
    if (hours != null && (isNaN(hours) || hours < 0)) {
      return res.status(400).json({ error: '培训课时格式不正确' });
    }
    const priceValue = price != null && price !== '' ? parseFloat(price) : null;
    if (priceValue != null && (isNaN(priceValue) || priceValue < 0)) {
      return res.status(400).json({ error: '价格格式不正确' });
    }

    try {
      const [result] = await pool.execute(
        `UPDATE annual_training_plans SET
         \`year\` = ?,
         department = ?,
         training_content = ?,
         target_trainees = ?,
         training_method = ?,
         training_type = ?,
         trainer = ?,
         price = ?,
         training_hours = ?,
         training_schedule = ?,
         need_assessment = ?,
         tracking = ?,
         is_notified = ?
       WHERE id = ?`,
        [
          yearValue,
          department.trim(),
          training_content.trim(),
          target_trainees ? target_trainees.trim() : null,
          training_method || null,
          training_type || null,
          trainer ? trainer.trim() : null,
          priceValue,
          hours,
          training_schedule ? training_schedule.trim() : null,
          need_assessment === true || need_assessment === 1 ? 1 : 0,
          tracking ? tracking.trim() : null,
          is_notified === true || is_notified === 1 ? 1 : 0,
          id
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '计划不存在' });
      }

      await logOperation(req, '更新年度培训计划', 'annual_training_plan', id, `年度: ${yearValue}, 部门: ${department.trim()}`);

      res.json({ success: true, message: '年度培训计划已更新' });
    } catch (err) {
      console.error('更新年度培训计划失败:', err);
      res.status(500).json({ error: '更新失败' });
    }
  });

  // API：删除年度培训计划（需 training_records 权限）
  router.delete('/api/annual-training-plans/:id', requirePermission('training_records'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: '缺少计划ID' });
    }

    try {
      const [result] = await pool.execute(
        'DELETE FROM annual_training_plans WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '计划不存在' });
      }

      await logOperation(req, '删除年度培训计划', 'annual_training_plan', id, '');

      res.json({ success: true, message: '年度培训计划已删除' });
    } catch (err) {
      console.error('删除年度培训计划失败:', err);
      res.status(500).json({ error: '删除失败' });
    }
  });

  return router;
};
