/**
 * 后端 PDF 生成服务
 *
 * 核心思路：
 * 1. 前端把"要打印的数据 + 模板配置"发到本服务
 * 2. 服务端加载模板 JS/CSS，动态拼接 HTML
 * 3. Puppeteer（无头 Chrome）打开该 HTML 并输出 PDF
 * 4. PDF 作为文件流返回给前端，前端直接预览或下载
 *
 * 优势：
 * - 模板完全在服务端，前端看不到、改不了
 * - 支持多模板混排，每个模板独立份数
 * - 输出的是标准 PDF，任何人都无法在前端篡改其内容
 */

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dns = require('dns');
const util = require('util');
const mssql = require('mssql');
const { pool, mssqlPool, testConnection, testMssqlConnection } = require('./db-config');
const { startDailyCheck } = require('./email-notifier');
const { setupWorkflowRoutes } = require('./workflow-routes');
const { runBackup, listBackups, startDailyBackup } = require('./backup-service');
const { queryInstruments } = require('./instrument-meter-service');
const { setupOcrRoutes } = require('./ocr-routes');
const nodemailer = require('nodemailer');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3456;

// 审批流引擎实例（在 setupWorkflowRoutes 中初始化）
let workflowEngine = null;

// 注：原 Dify API 调用已移除，生产数据改为直接查询 MSSQL（ERP1）

/**
 * 自动检测系统已安装的 Chrome/Chromium 路径
 * 优先使用系统浏览器，避免 Puppeteer 下载失败导致无法运行
 */
function findChrome() {
  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null; // 未找到，回退到 Puppeteer 自带的浏览器
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 显式路由：防止 html 文件被静态服务直接暴露
app.get('/index.html', requirePermissionPage('print'), (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/select-print-record.html', requirePermissionPage('print'), (req, res) => {
  res.sendFile(path.join(__dirname, 'select-print-record.html'));
});
app.get('/entry-print-record.html', requirePermissionPage('print'), (req, res) => {
  res.sendFile(path.join(__dirname, 'entry-print-record.html'));
});
app.get('/backup-management.html', requirePermissionPage('backup_management'), (req, res) => {
  res.sendFile(path.join(__dirname, 'backup-management.html'));
});
app.get('/instrument-meter.html', requirePermissionPage('instrument_meter'), (req, res) => {
  res.sendFile(path.join(__dirname, 'instrument-meter.html'));
});
app.get('/logs.html', requirePermissionPage('logs'), (req, res) => {
  res.sendFile(path.join(__dirname, 'logs.html'));
});
app.get('/nav.html', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'nav.html'));
});
app.get('/nav-cards.html', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'nav-cards.html'));
});
app.get('/nav-list.html', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'nav-list.html'));
});
app.get('/nav-dashboard.html', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'nav-dashboard.html'));
});
app.get('/nav-sidebar.html', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'nav-sidebar.html'));
});
app.get('/daping.html', requirePermissionPage('dashboard'), (req, res) => {
  res.sendFile(path.join(__dirname, 'daping.html'));
});
app.get('/template-admin.html', requirePermissionPage('template_admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'template-admin.html'));
});
app.get('/permission-admin.html', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'permission-admin.html'));
});
app.get('/user-management.html', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'user-management.html'));
});
app.get('/operation-logs.html', requirePermissionPage('operation_logs'), (req, res) => {
  res.sendFile(path.join(__dirname, 'operation-logs.html'));
});
app.get('/training-records.html', requirePermissionPage('training_records'), (req, res) => {
  res.sendFile(path.join(__dirname, 'training-records.html'));
});
app.get('/annual-training-plan.html', requirePermissionPage('training_records'), (req, res) => {
  res.sendFile(path.join(__dirname, 'annual-training-plan.html'));
});
app.get('/user-training-record.html', requirePermissionPage('training_records'), (req, res) => {
  res.sendFile(path.join(__dirname, 'user-training-record.html'));
});
app.get('/supplier-qualifications.html', requirePermissionPage('supplier_qualifications'), (req, res) => {
  res.sendFile(path.join(__dirname, 'supplier-qualifications.html'));
});
app.get('/supplier-qualification-logs.html', requirePermissionPage('supplier_qualifications'), (req, res) => {
  res.sendFile(path.join(__dirname, 'supplier-qualification-logs.html'));
});
app.get('/qualification-types.html', requirePermissionPage('supplier_qualifications'), (req, res) => {
  res.sendFile(path.join(__dirname, 'qualification-types.html'));
});
app.get('/suppliers.html', requirePermissionPage('supplier_qualifications'), (req, res) => {
  res.sendFile(path.join(__dirname, 'suppliers.html'));
});
app.get('/entry-supplier-qualifications.html', requirePermissionPage('supplier_qualifications'), (req, res) => {
  res.sendFile(path.join(__dirname, 'entry-supplier-qualifications.html'));
});
app.get('/product-list.html', requirePermissionPage('supplier_qualifications'), (req, res) => {
  res.sendFile(path.join(__dirname, 'product-list.html'));
});
app.get('/workflow-designer.html', requirePermissionPage('workflow_design'), (req, res) => {
  res.sendFile(path.join(__dirname, 'workflow-designer.html'));
});
app.get('/workflow-definitions.html', requirePermissionPage('workflow_design'), (req, res) => {
  res.sendFile(path.join(__dirname, 'workflow-definitions.html'));
});
app.get('/ocr-recognize.html', requirePermissionPage('ocr_recognize'), (req, res) => {
  res.sendFile(path.join(__dirname, 'ocr-recognize.html'));
});
app.get('/ocr-template-design.html', requirePermissionPage('ocr_template_design'), (req, res) => {
  res.sendFile(path.join(__dirname, 'ocr-template-design.html'));
});
app.get('/workflow-tasks.html', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'workflow-tasks.html'));
});

// 静态文件服务：只开放 public/ 目录，敏感文件请勿放在此处
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// 登录页（公开访问）
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// API：登录（查数据库验证）
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '缺少用户名或密码' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, username, password_hash, status FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const user = rows[0];

    if (user.status !== 1) {
      return res.status(403).json({ error: '账号已被禁用' });
    }

    if (hashPassword(password) !== user.password_hash) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新上次登录时间
    await pool.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    const sid = generateSessionId();
    sessions.set(sid, { username: user.username, createdAt: Date.now() });
    setSessionCookie(res, sid);

    // 记录登录日志
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
      await pool.execute(
        'INSERT INTO operation_logs (username, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
        [user.username, '用户登录', 'session', null, '登录成功', clientIp]
      );
    } catch (logErr) {
      console.error('登录日志记录失败:', logErr.message);
    }

    res.json({ success: true, message: '登录成功' });
  } catch (err) {
    console.error('登录查询失败:', err);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// API：登出
app.post('/api/logout', async (req, res) => {
  const cookies = parseCookie(req);
  const sid = cookies[SESSION_COOKIE_NAME];
  let username = null;
  if (sid) {
    const session = sessions.get(sid);
    if (session) username = session.username;
    sessions.delete(sid);
  }
  clearSessionCookie(res);

  // 记录登出日志
  if (username) {
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
      await pool.execute(
        'INSERT INTO operation_logs (username, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
        [username, '用户登出', 'session', null, '退出登录', clientIp]
      );
    } catch (logErr) {
      console.error('登出日志记录失败:', logErr.message);
    }
  }

  res.json({ success: true, message: '已退出登录' });
});

// API：获取当前登录用户信息
app.get('/api/session', requireAuth, (req, res) => {
  res.json({ success: true, username: req.session.username });
});

// API：获取当前登录用户的功能权限
app.get('/api/my-permissions', requireAuth, async (req, res) => {
  try {
    const perms = {};
    for (const feature of PERMISSION_FEATURES) {
      perms[feature] = await checkPermission(req.session.username, feature);
    }
    res.json({ success: true, permissions: perms });
  } catch (err) {
    console.error('查询我的权限失败:', err);
    res.status(500).json({ error: '查询权限失败' });
  }
});

// API：列出所有用户（仅管理员）
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, username, status, last_login,
              chinese_name, department, direct_manager, email, position, hire_date
       FROM users ORDER BY id ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('查询用户列表失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// API：新增用户（仅管理员）
app.post('/api/users', requireAdmin, async (req, res) => {
  const { username, password, chinese_name, department, direct_manager, email, position, hire_date } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: '缺少用户名' });
  }
  const trimmedUsername = username.trim();
  if (!trimmedUsername) {
    return res.status(400).json({ error: '用户名不能为空' });
  }
  if (trimmedUsername.length > 50) {
    return res.status(400).json({ error: '用户名长度不能超过 50 个字符' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: '缺少密码' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度不能少于 6 位' });
  }

  // 简单校验邮箱格式（如有填写）
  const trimmedEmail = email ? String(email).trim() : '';
  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Email 格式不正确' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO users
       (username, password_hash, status, chinese_name, department, direct_manager, email, position, hire_date)
       VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      [
        trimmedUsername,
        hashPassword(password),
        chinese_name ? String(chinese_name).trim() : null,
        department ? String(department).trim() : null,
        direct_manager ? String(direct_manager).trim() : null,
        trimmedEmail || null,
        position ? String(position).trim() : null,
        hire_date || null
      ]
    );

    await logOperation(req, '新增用户', 'user', result.insertId, `用户名: ${trimmedUsername}`);

    res.json({ success: true, message: '用户已创建', userId: result.insertId });
  } catch (err) {
    console.error('创建用户失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '用户名已存在' });
    }
    res.status(500).json({ error: '创建失败' });
  }
});

// API：修改用户密码（仅管理员）
app.put('/api/users/:username/password', requireAdmin, async (req, res) => {
  const username = req.params.username;
  const { password } = req.body;

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: '缺少新密码' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码长度不能少于 6 位' });
  }

  try {
    const [result] = await pool.execute(
      'UPDATE users SET password_hash = ? WHERE username = ?',
      [hashPassword(password), username]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    await logOperation(req, '修改用户密码', 'user', username, `用户名: ${username}`);

    res.json({ success: true, message: '密码已修改' });
  } catch (err) {
    console.error('修改密码失败:', err);
    res.status(500).json({ error: '修改失败' });
  }
});

// API：更新用户状态（禁用/启用）（仅管理员）
app.put('/api/users/:username/status', requireAdmin, async (req, res) => {
  const username = req.params.username;
  const { status } = req.body;

  if (status !== 0 && status !== 1) {
    return res.status(400).json({ error: '状态值无效，必须为 0 或 1' });
  }

  if (username === 'admin') {
    return res.status(400).json({ error: '不能禁用管理员账号' });
  }

  try {
    const [result] = await pool.execute(
      'UPDATE users SET status = ? WHERE username = ?',
      [status, username]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    await logOperation(req, status === 1 ? '启用用户' : '禁用用户', 'user', username, `用户名: ${username}`);

    res.json({ success: true, message: status === 1 ? '用户已启用' : '用户已禁用' });
  } catch (err) {
    console.error('更新用户状态失败:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// API：查询某个用户的权限（仅管理员）
app.get('/api/users/:username/permissions', requireAdmin, async (req, res) => {
  const username = req.params.username;
  try {
    const [rows] = await pool.execute(
      'SELECT feature_key, is_allowed FROM user_permissions WHERE username = ?',
      [username]
    );
    const allowedMap = {};
    rows.forEach(r => { allowedMap[r.feature_key] = r.is_allowed === 1; });

    const permissions = PERMISSION_FEATURES.map(feature => ({
      feature_key: feature,
      is_allowed: allowedMap[feature] === true
    }));
    res.json({ success: true, data: permissions });
  } catch (err) {
    console.error('查询用户权限失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// API：更新某个用户的权限（仅管理员）
app.put('/api/users/:username/permissions', requireAdmin, async (req, res) => {
  const username = req.params.username;
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: '缺少权限数据 permissions' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const feature of PERMISSION_FEATURES) {
      const isAllowed = permissions[feature] === true ? 1 : 0;
      await connection.execute(
        `INSERT INTO user_permissions (username, feature_key, is_allowed)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE is_allowed = VALUES(is_allowed)`,
        [username, feature, isAllowed]
      );
    }

    await connection.commit();

    // 构建权限变更详情
    const granted = [];
    const revoked = [];
    for (const feature of PERMISSION_FEATURES) {
      if (permissions[feature] === true) {
        granted.push(feature);
      } else {
        revoked.push(feature);
      }
    }
    let detail = `用户名: ${username}`;
    if (granted.length > 0) detail += `, 授予: [${granted.join(', ')}]`;
    if (revoked.length > 0) detail += `, 撤销: [${revoked.join(', ')}]`;

    await logOperation(req, '更新用户权限', 'user', username, detail);

    res.json({ success: true, message: '权限已更新' });
  } catch (err) {
    await connection.rollback();
    console.error('更新用户权限失败:', err);
    res.status(500).json({ error: '更新失败' });
  } finally {
    connection.release();
  }
});

// API：按部门分组查询所有启用用户（需 training_records 权限）
app.get('/api/users/by-department', requirePermission('training_records'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT username, chinese_name, department
       FROM users
       WHERE status = 1
       ORDER BY department ASC, username ASC`
    );

    const grouped = {};
    rows.forEach(u => {
      const dept = u.department || '未分配部门';
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(u);
    });

    const data = Object.keys(grouped).map(dept => ({
      department: dept,
      users: grouped[dept]
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('按部门查询用户失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// API：查询单个用户详情（仅管理员）
app.get('/api/users/:username', requireAdmin, async (req, res) => {
  const username = req.params.username;
  try {
    const [rows] = await pool.execute(
      `SELECT id, username, status, last_login,
              chinese_name, department, direct_manager, email, position, hire_date
       FROM users WHERE username = ?`,
      [username]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('查询用户详情失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// API：更新用户档案（仅管理员）
app.put('/api/users/:username', requireAdmin, async (req, res) => {
  const username = req.params.username;
  const { chinese_name, department, direct_manager, email, position, hire_date } = req.body;

  const trimmedEmail = email ? String(email).trim() : '';
  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return res.status(400).json({ error: 'Email 格式不正确' });
  }

  try {
    const [result] = await pool.execute(
      `UPDATE users SET
         chinese_name = ?,
         department = ?,
         direct_manager = ?,
         email = ?,
         position = ?,
         hire_date = ?
       WHERE username = ?`,
      [
        chinese_name ? String(chinese_name).trim() : null,
        department ? String(department).trim() : null,
        direct_manager ? String(direct_manager).trim() : null,
        trimmedEmail || null,
        position ? String(position).trim() : null,
        hire_date || null,
        username
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    await logOperation(req, '更新用户档案', 'user', username, `用户名: ${username}`);

    res.json({ success: true, message: '用户信息已更新' });
  } catch (err) {
    console.error('更新用户档案失败:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// API：批量插入培训记录（需 training_records 权限）
app.post('/api/training-records', requirePermission('training_records'), async (req, res) => {
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
app.get('/api/training-records/filter-options', requirePermission('training_records'), async (req, res) => {
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
app.get('/api/training-records', requirePermission('training_records'), async (req, res) => {
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
app.get('/api/annual-training-plans', requirePermission('training_records'), async (req, res) => {
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

// 年度培训计划 CSV 导入/导出相关常量
const ANNUAL_PLAN_CSV_HEADERS = '年度,部门,培训项目/课程/内容,目标学员,培训方式,内训/外训,讲师,价格,培训课时,培训日程,是否考核,跟踪,是否通知';

// 供应商资质 CSV 导入/导出相关常量
const SUPPLIER_QUALIFICATION_CSV_HEADERS = '供方名称,供应的产品或服务,联系人,联系电话,准入时间,营业执照,认证证书,供方基本情况登记表,备注';
const SUPPLIER_QUALIFICATION_CSV_SAMPLE = '示例供方,示例产品,张三,13800138000,2024-01-15,2024-01-15,证书编号,登记表编号,备注';

// 资质种类 CSV 导入/导出相关常量
const QUALIFICATION_TYPE_CSV_HEADERS = '资质名称,是否需要过期检查';
const QUALIFICATION_TYPE_CSV_SAMPLE = '示例资质,是';

// 供应商主数据 CSV 导入/导出相关常量
const SUPPLIER_CSV_HEADERS = '供方名称,供应商类型,物资分类,联系人,电话,状态,备注1,备注2';
const SUPPLIER_CSV_SAMPLE = '示例供方,请输入以下4种类型：special service manufacturer distributor,原材料,张三,13800138000,请输入以下2种类型：active inactive,备注1内容,备注2内容';

// 产品列表 CSV 导入/导出相关常量
const PRODUCT_LIST_CSV_HEADERS = '公司名称,产品名,型号,生产商';
const PRODUCT_LIST_CSV_SAMPLE = '示例公司,示例产品,Model-001,示例生产商';

function parseCsv(text) {
  if (!text) return [];
  let t = text;
  if (t.charCodeAt(0) === 0xFEFF) {
    t = t.slice(1);
  }
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const next = t[i + 1];
    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\r') {
        if (next === '\n') i++;
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\n') {
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }
  rows.push(row);
  while (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

/**
 * 校验日期格式是否为合法的 YYYY-MM-DD 或 YYYY-M-D
 */
function isValidDate(str) {
  if (!str) return true;
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * 将 YYYY-M-D 或 YYYY-MM-DD 统一归一化为 YYYY-MM-DD
 */
function normalizeDate(str) {
  if (!str) return str;
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) return str;
  const [y, m, d] = str.split('-').map(Number);
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

// API：下载年度培训计划 CSV 模板（需 training_records 权限）
app.get('/api/annual-training-plans/template', requirePermission('training_records'), (req, res) => {
  const csv = '\uFEFF' + ANNUAL_PLAN_CSV_HEADERS + '\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=annual-training-plan-template.csv');
  res.send(csv);
});

// API：从 CSV 导入年度培训计划（需 training_records 权限）
app.post('/api/annual-training-plans/import', requirePermission('training_records'), async (req, res) => {
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
app.post('/api/annual-training-plans', requirePermission('training_records'), async (req, res) => {
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
app.put('/api/annual-training-plans/:id', requirePermission('training_records'), async (req, res) => {
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
app.delete('/api/annual-training-plans/:id', requirePermission('training_records'), async (req, res) => {
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

// ========== 供应商资质管理 API ==========

// API：查询供应商资质（需 supplier_qualifications 查看权限）
// 从 suppliers 表联合 entry_supplier_qualifications 表，将每个供应商的资质明细聚合为单单元格多行摘要
// 支持通过 category 参数过滤：production / service / special
app.get('/api/supplier-qualifications', requirePermission('supplier_qualifications'), async (req, res) => {
  try {
    const category = req.query.category;

    // 页签分类与 supplier_type 的映射（同时兼容英文与中文旧数据）
    const categoryTypeMap = {
      special: ['special', '特殊物资类'],
      service: ['service', '服务型'],
      production: ['manufacturer', 'distributor', '生产型', '经销型']
    };
    const allowedCategories = Object.keys(categoryTypeMap);
    const categoryValue = allowedCategories.includes(category) ? category : 'special';
    const supplierTypes = categoryTypeMap[categoryValue];

    const placeholders = supplierTypes.map(() => '?').join(',');

    const sql = `SELECT
      MIN(e.supplier_id) AS supplier_id,
      MIN(s.supplier_name) AS supplier_name,
      MIN(s.supplier_type) AS supplier_type,
      pl.id AS prudoct_list_id,
      pl.company_name,
      pl.product_name,
      pl.model,
      pl.manufacturer,
      pl.status AS product_status,
      COALESCE((
        SELECT GROUP_CONCAT(
          CONCAT(
            '资质名称：', COALESCE(eq.qualification_name, ''),
            IF(eq.issue_date IS NOT NULL AND eq.issue_date != '', CONCAT('；发行日期：', eq.issue_date), ''),
            IF(eq.expiry_date IS NOT NULL AND eq.expiry_date != '', CONCAT('；过期日期：', eq.expiry_date), ''),
            '；状态：', COALESCE(eq.current_status, '')
          )
          ORDER BY eq.qualification_name, eq.issue_date
          SEPARATOR '\n'
        )
        FROM entry_supplier_qualifications eq
        WHERE eq.prudoct_list_id = pl.id
      ), '') AS qualification_summary
    FROM entry_supplier_qualifications e
    JOIN suppliers s ON s.id = e.supplier_id
    JOIN product_list pl ON pl.id = e.prudoct_list_id
    WHERE s.supplier_type IN (${placeholders})
    GROUP BY pl.id, pl.company_name, pl.product_name, pl.model, pl.manufacturer, pl.status
    ORDER BY pl.updated_at DESC`;

    const [rows] = await pool.execute(sql, supplierTypes);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('查询供应商资质失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

/**
 * 将业务记录与最新流程实例状态合并
 */
async function mergeWorkflowStatus(rows, moduleKey) {
  if (!rows || rows.length === 0) return;
  const keys = rows.map(r => `${moduleKey}:${r.id}`);
  const placeholders = keys.map(() => '?').join(',');
  try {
    const [instances] = await pool.execute(
      `SELECT business_key, status FROM workflow_instances
       WHERE module_key = ? AND business_key IN (${placeholders})
       ORDER BY created_at DESC`,
      [moduleKey, ...keys]
    );
    const statusMap = {};
    instances.forEach(ins => {
      if (!statusMap[ins.business_key]) {
        statusMap[ins.business_key] = ins.status;
      }
    });
    rows.forEach(r => {
      const key = `${moduleKey}:${r.id}`;
      r.workflow_status = statusMap[key] || '';
    });
  } catch (e) {
    console.error('合并审批流状态失败:', e.message);
  }
}

// API：查询供应商资质操作日志（需 supplier_qualifications 查看权限）
app.get('/api/supplier-qualification-logs', requirePermission('supplier_qualifications'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, username, action, supplier_id, supplier_name, detail,
              ip_address, computer_name, user_agent, created_at
       FROM supplier_qualification_logs
       ORDER BY created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('查询供应商资质日志失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// API：新增供应商资质（需 supplier_qualifications_edit 编辑权限）
app.post('/api/supplier-qualifications', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const {
    supplier_name, product_or_service, contact_person, contact_phone,
    category, admission_date, business_license, certification, basic_info_form, remarks
  } = req.body;

  if (!supplier_name || String(supplier_name).trim() === '') {
    return res.status(400).json({ error: '供方名称不能为空' });
  }

  const categoryValue = ['production', 'service', 'special'].includes(category) ? category : 'special';

  if (business_license && !isValidDate(String(business_license).trim())) {
    return res.status(400).json({ error: '营业执照格式不正确，应为 YYYY-MM-DD' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO supplier_qualifications
       (supplier_name, product_or_service, contact_person, contact_phone,
        category, admission_date, business_license, certification, basic_info_form, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(supplier_name).trim(),
        product_or_service || null,
        contact_person || null,
        contact_phone || null,
        categoryValue,
        admission_date ? normalizeDate(String(admission_date).trim()) : null,
        business_license ? normalizeDate(String(business_license).trim()) : null,
        certification || null,
        basic_info_form || null,
        remarks || null,
        req.session.username
      ]
    );

    await logSupplierOperation(req, '新增', result.insertId, supplier_name, req.body);

    // 如果存在启用的审批流，自动启动审批实例
    let workflowInstance = null;
    try {
      if (workflowEngine) {
        const activeDef = await workflowEngine.getActiveDefinition('supplier_qualifications', req.body);
        if (activeDef) {
          workflowInstance = await workflowEngine.startInstance({
            module_key: 'supplier_qualifications',
            business_key: `supplier_qualifications:${result.insertId}`,
            payload: { id: result.insertId, ...req.body },
            created_by: req.session.username
          });
        }
      }
    } catch (wfErr) {
      console.error('启动供应商资质审批流失败:', wfErr.message);
    }

    res.json({
      success: true,
      message: '供应商资质已新增',
      id: result.insertId,
      workflow_instance_id: workflowInstance ? workflowInstance.id : null
    });
  } catch (err) {
    console.error('新增供应商资质失败:', err);
    res.status(500).json({ error: '新增失败' });
  }
});

// API：修改供应商资质（需 supplier_qualifications_edit 编辑权限）
app.put('/api/supplier-qualifications/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: '缺少供应商ID' });

  const {
    supplier_name, product_or_service, contact_person, contact_phone,
    category, admission_date, business_license, certification, basic_info_form, remarks
  } = req.body;

  if (!supplier_name || String(supplier_name).trim() === '') {
    return res.status(400).json({ error: '供方名称不能为空' });
  }

  const categoryValue = ['production', 'service', 'special'].includes(category) ? category : 'special';

  if (business_license && !isValidDate(String(business_license).trim())) {
    return res.status(400).json({ error: '营业执照格式不正确，应为 YYYY-MM-DD' });
  }

  try {
    const [oldRows] = await pool.execute(
      'SELECT * FROM supplier_qualifications WHERE id = ?',
      [id]
    );
    if (oldRows.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    const oldData = oldRows[0];

    const [result] = await pool.execute(
      `UPDATE supplier_qualifications
       SET supplier_name = ?, product_or_service = ?, contact_person = ?, contact_phone = ?,
           category = ?, admission_date = ?, business_license = ?, certification = ?, basic_info_form = ?, remarks = ?
       WHERE id = ?`,
      [
        String(supplier_name).trim(),
        product_or_service || null,
        contact_person || null,
        contact_phone || null,
        categoryValue,
        admission_date ? normalizeDate(String(admission_date).trim()) : null,
        business_license ? normalizeDate(String(business_license).trim()) : null,
        certification || null,
        basic_info_form || null,
        remarks || null,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }

    await logSupplierOperation(req, '修改', id, supplier_name, { before: oldData, after: req.body });

    // 如果存在启用的审批流且当前没有运行中的实例，则启动新审批实例
    let workflowInstance = null;
    try {
      if (workflowEngine) {
        const activeDef = await workflowEngine.getActiveDefinition('supplier_qualifications', req.body);
        if (activeDef) {
          const businessKey = `supplier_qualifications:${id}`;
          const [runningRows] = await pool.execute(
            "SELECT COUNT(*) as cnt FROM workflow_instances WHERE business_key = ? AND status = 'running'",
            [businessKey]
          );
          if (runningRows[0].cnt === 0) {
            workflowInstance = await workflowEngine.startInstance({
              module_key: 'supplier_qualifications',
              business_key: businessKey,
              payload: { id, ...req.body },
              created_by: req.session.username
            });
          }
        }
      }
    } catch (wfErr) {
      console.error('启动供应商资质审批流失败:', wfErr.message);
    }

    res.json({
      success: true,
      message: '供应商资质已更新',
      workflow_instance_id: workflowInstance ? workflowInstance.id : null
    });
  } catch (err) {
    console.error('修改供应商资质失败:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

// API：删除供应商资质（需 supplier_qualifications_edit 编辑权限）
app.delete('/api/supplier-qualifications/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: '缺少供应商ID' });

  try {
    const [oldRows] = await pool.execute(
      'SELECT * FROM supplier_qualifications WHERE id = ?',
      [id]
    );
    if (oldRows.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    const oldData = oldRows[0];

    const [result] = await pool.execute(
      'DELETE FROM supplier_qualifications WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }

    await logSupplierOperation(req, '删除', id, oldData.supplier_name, oldData);

    res.json({ success: true, message: '供应商资质已删除' });
  } catch (err) {
    console.error('删除供应商资质失败:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// API：下载供应商资质 CSV 模板（需 supplier_qualifications 查看权限）
// 支持通过 category 参数指定当前 Tab 分类：production / service / special
app.get('/api/supplier-qualifications/template', requirePermission('supplier_qualifications'), async (req, res) => {
  const category = req.query.category;
  const categoryValue = ['production', 'service', 'special'].includes(category) ? category : 'special';
  const categoryLabels = {
    production: '生产型经销型',
    service: '服务型',
    special: '特殊物资类'
  };
  const csv = '\uFEFF' + SUPPLIER_QUALIFICATION_CSV_HEADERS + '\n' + SUPPLIER_QUALIFICATION_CSV_SAMPLE + '\n';
  const filename = `supplier-qualifications-template-${categoryValue}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=' + filename);
  res.send(csv);

  // 记录下载日志
  try {
    await logSupplierOperation(req, '下载CSV模板', null, null, {
      message: `下载供应商资质 CSV 模板，分类：${categoryLabels[categoryValue] || categoryValue}`
    });
  } catch (err) {
    console.error('记录 CSV 模板下载日志失败:', err.message);
  }
});

// API：从 CSV 导入供应商资质（需 supplier_qualifications_edit 编辑权限）
// 通过 category 参数将导入数据归属到当前 Tab 分类
app.post('/api/supplier-qualifications/import', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const { csv, category } = req.body;
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: '缺少 CSV 内容' });
  }

  const categoryValue = ['production', 'service', 'special'].includes(category) ? category : 'special';

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return res.status(400).json({ error: 'CSV 文件中缺少数据行' });
  }

  const headers = rows[0].map(h => h.trim());
  const requiredHeaders = ['供方名称'];
  const missing = requiredHeaders.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    return res.status(400).json({ error: `CSV 表头缺少必填列: ${missing.join(', ')}` });
  }

  function cell(name, cells) {
    const idx = headers.indexOf(name);
    return idx >= 0 && idx < cells.length ? cells[idx].trim() : '';
  }

  const suppliers = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0].trim() === '') continue;
    if (cells.every(c => c.trim() === '')) continue;

    const supplierName = cell('供方名称', cells);
    if (!supplierName) {
      return res.status(400).json({ error: `第 ${i + 1} 行缺少供方名称` });
    }

    const admissionDate = cell('准入时间', cells);
    if (admissionDate && !isValidDate(admissionDate)) {
      return res.status(400).json({ error: `第 ${i + 1} 行准入时间格式不正确，应为 YYYY-MM-DD` });
    }

    const businessLicense = cell('营业执照', cells);
    if (businessLicense && !isValidDate(businessLicense)) {
      return res.status(400).json({ error: `第 ${i + 1} 行营业执照格式不正确，应为 YYYY-MM-DD` });
    }

    suppliers.push({
      supplier_name: supplierName,
      product_or_service: cell('供应的产品或服务', cells) || null,
      contact_person: cell('联系人', cells) || null,
      contact_phone: cell('联系电话', cells) || null,
      category: categoryValue,
      admission_date: admissionDate ? normalizeDate(admissionDate) : null,
      business_license: businessLicense ? normalizeDate(businessLicense) : null,
      certification: cell('认证证书', cells) || null,
      basic_info_form: cell('供方基本情况登记表', cells) || null,
      remarks: cell('备注', cells) || null
    });
  }

  if (suppliers.length === 0) {
    return res.status(400).json({ error: 'CSV 中没有可导入的有效数据' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const insertSql = `INSERT INTO supplier_qualifications
      (supplier_name, product_or_service, contact_person, contact_phone,
       category, admission_date, business_license, certification, basic_info_form, remarks, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    for (const s of suppliers) {
      const [result] = await connection.execute(insertSql, [
        s.supplier_name,
        s.product_or_service,
        s.contact_person,
        s.contact_phone,
        s.category,
        s.admission_date,
        s.business_license,
        s.certification,
        s.basic_info_form,
        s.remarks,
        req.session.username
      ]);
      await logSupplierOperation(req, '批量新增', result.insertId, s.supplier_name, s);
    }
    await connection.commit();

    // 记录 CSV 上传总日志
    await logSupplierOperation(req, '上传CSV', null, null, {
      message: `通过 CSV 批量导入 ${suppliers.length} 条供应商资质，分类：${categoryValue}`,
      count: suppliers.length,
      category: categoryValue
    });

    res.json({ success: true, message: `成功导入 ${suppliers.length} 条供应商资质` });
  } catch (err) {
    await connection.rollback();
    console.error('批量导入供应商资质失败:', err);
    res.status(500).json({ error: '导入失败：' + err.message });
  } finally {
    connection.release();
  }
});

// ========== 资质种类管理 API ==========

// API：查询资质种类列表（需 supplier_qualifications 查看权限）
app.get('/api/qualification-types', requirePermission('supplier_qualifications'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, need_expiry_check, created_by, created_at, updated_at
       FROM qualification_types
       ORDER BY updated_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('查询资质种类失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// API：新增资质种类（需 supplier_qualifications_edit 编辑权限）
app.post('/api/qualification-types', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const { name, need_expiry_check } = req.body;

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: '资质名称不能为空' });
  }

  const trimmedName = String(name).trim();
  const needExpiryCheck = need_expiry_check === true || need_expiry_check === 1 ? 1 : 0;

  try {
    // 检查资质名称是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM qualification_types WHERE name = ?',
      [trimmedName]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '资质名称已存在' });
    }

    const [result] = await pool.execute(
      `INSERT INTO qualification_types (name, need_expiry_check, created_by)
       VALUES (?, ?, ?)`,
      [trimmedName, needExpiryCheck, req.session.username]
    );

    await logOperation(req, '新增资质种类', 'qualification_type', result.insertId, `名称: ${trimmedName}`);

    res.json({ success: true, message: '资质种类已新增', id: result.insertId });
  } catch (err) {
    console.error('新增资质种类失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '资质名称已存在' });
    }
    res.status(500).json({ error: '新增失败' });
  }
});

// API：更新资质种类（需 supplier_qualifications_edit 编辑权限）
app.put('/api/qualification-types/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: '缺少资质种类ID' });

  const { name, need_expiry_check } = req.body;

  if (!name || String(name).trim() === '') {
    return res.status(400).json({ error: '资质名称不能为空' });
  }

  const trimmedName = String(name).trim();
  const needExpiryCheck = need_expiry_check === true || need_expiry_check === 1 ? 1 : 0;

  try {
    // 检查是否与其他记录名称重复
    const [existing] = await pool.execute(
      'SELECT id FROM qualification_types WHERE name = ? AND id != ?',
      [trimmedName, id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '资质名称已存在' });
    }

    const [result] = await pool.execute(
      `UPDATE qualification_types
       SET name = ?, need_expiry_check = ?
       WHERE id = ?`,
      [trimmedName, needExpiryCheck, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '资质种类不存在' });
    }

    await logOperation(req, '更新资质种类', 'qualification_type', id, `名称: ${trimmedName}`);

    res.json({ success: true, message: '资质种类已更新' });
  } catch (err) {
    console.error('更新资质种类失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '资质名称已存在' });
    }
    res.status(500).json({ error: '更新失败' });
  }
});

// API：删除资质种类（需 supplier_qualifications_edit 编辑权限）
// 删除后联动将 entry_supplier_qualifications 中对应资质的 current_status 置为 inactive。
app.delete('/api/qualification-types/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: '缺少资质种类ID' });

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      'DELETE FROM qualification_types WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '资质种类不存在' });
    }

    // 联动停用已录入的该资质记录
    await connection.execute(
      `UPDATE entry_supplier_qualifications
       SET current_status = 'inactive'
       WHERE qualification_type_id = ?`,
      [id]
    );

    await connection.commit();

    await logOperation(req, '删除资质种类', 'qualification_type', id, '');

    res.json({ success: true, message: '资质种类已删除，相关已录入资质已停用' });
  } catch (err) {
    await connection.rollback();
    console.error('删除资质种类失败:', err);
    res.status(500).json({ error: '删除失败' });
  } finally {
    connection.release();
  }
});

// API：下载资质种类 CSV 模板（需 supplier_qualifications 查看权限）
app.get('/api/qualification-types/template', requirePermission('supplier_qualifications'), (req, res) => {
  const csv = '\uFEFF' + QUALIFICATION_TYPE_CSV_HEADERS + '\n' + QUALIFICATION_TYPE_CSV_SAMPLE + '\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=qualification-types-template.csv');
  res.send(csv);
});

// API：从 CSV 导入资质种类（需 supplier_qualifications_edit 编辑权限）
// 仅新增，不会替换或删除已有记录；如与现有资质名称重复则整单拒绝。
app.post('/api/qualification-types/import', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const { csv } = req.body;
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: '缺少 CSV 内容' });
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return res.status(400).json({ error: 'CSV 文件中缺少数据行' });
  }

  const headers = rows[0].map(h => h.trim());
  const requiredHeaders = ['资质名称'];
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
    if (!s) return 1;
    const lower = s.toLowerCase();
    if (s === '是' || s === '1' || lower === 'true' || lower === 'yes' || lower === 'y') return 1;
    return 0;
  }

  const insertList = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0].trim() === '') continue;
    if (cells.every(c => c.trim() === '')) continue;

    const name = cell('资质名称', cells);
    if (!name) {
      return res.status(400).json({ error: `第 ${i + 1} 行缺少资质名称` });
    }

    insertList.push({
      name,
      need_expiry_check: parseBool(cell('是否需要过期检查', cells))
    });
  }

  if (insertList.length === 0) {
    return res.status(400).json({ error: 'CSV 中没有可导入的有效数据' });
  }

  // 校验 CSV 内部是否有重复名称
  const seenInFile = new Set();
  for (const item of insertList) {
    const key = item.name.toLowerCase();
    if (seenInFile.has(key)) {
      return res.status(400).json({ error: `CSV 中资质名称 "${item.name}" 存在重复` });
    }
    seenInFile.add(key);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 检查与系统中已有名称是否重复
    const [existingRows] = await connection.execute('SELECT name FROM qualification_types');
    const existingSet = new Set(existingRows.map(r => String(r.name).trim().toLowerCase()));

    for (const item of insertList) {
      if (existingSet.has(item.name.toLowerCase())) {
        await connection.rollback();
        return res.status(400).json({ error: `导入失败：资质名称 "${item.name}" 已存在` });
      }
    }

    for (const item of insertList) {
      const [result] = await connection.execute(
        'INSERT INTO qualification_types (name, need_expiry_check, created_by) VALUES (?, ?, ?)',
        [item.name, item.need_expiry_check, req.session.username]
      );

      await logOperation(req, '批量新增资质种类', 'qualification_type', result.insertId, `名称: ${item.name}`);
    }

    await connection.commit();

    await logOperation(req, '上传CSV资质种类', 'qualification_type', null, JSON.stringify({
      message: `通过 CSV 批量导入 ${insertList.length} 条资质种类`,
      count: insertList.length
    }));

    res.json({ success: true, message: `成功导入 ${insertList.length} 条资质种类` });
  } catch (err) {
    await connection.rollback();
    console.error('批量导入资质种类失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      const match = err.message && err.message.match(/Duplicate entry '([^']+)'/);
      const dupValue = match ? match[1] : '';
      return res.status(400).json({ error: dupValue ? `导入失败：资质名称 "${dupValue}" 已存在` : '导入失败：资质名称已存在' });
    }
    res.status(500).json({ error: '导入失败：' + err.message });
  } finally {
    connection.release();
  }
});

// ========== 供应商主数据管理 API ==========

// API：查询供应商列表（需 supplier_qualifications 查看权限）
app.get('/api/suppliers', requirePermission('supplier_qualifications'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, supplier_name, supplier_type, material_category, contact_person, contact_phone,
              status, remarks1, remarks2, created_by, created_at, updated_at
       FROM suppliers
       ORDER BY updated_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('查询供应商失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// API：新增供应商（需 supplier_qualifications_edit 编辑权限）
app.post('/api/suppliers', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const {
    supplier_name, supplier_type, material_category, contact_person, contact_phone,
    status, remarks1, remarks2
  } = req.body;

  if (!supplier_name || String(supplier_name).trim() === '') {
    return res.status(400).json({ error: '供方名称不能为空' });
  }

  const trimmedName = String(supplier_name).trim();

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM suppliers WHERE supplier_name = ?',
      [trimmedName]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '供方名称已存在' });
    }

    const [result] = await pool.execute(
      `INSERT INTO suppliers
       (supplier_name, supplier_type, material_category, contact_person, contact_phone,
        status, remarks1, remarks2, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trimmedName,
        supplier_type || null,
        material_category || null,
        contact_person || null,
        contact_phone || null,
        status || '正常',
        remarks1 || null,
        remarks2 || null,
        req.session.username
      ]
    );

    await logOperation(req, '新增供应商', 'supplier', result.insertId, `供方名称: ${trimmedName}`);

    res.json({ success: true, message: '供应商已新增', id: result.insertId });
  } catch (err) {
    console.error('新增供应商失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '供方名称已存在' });
    }
    res.status(500).json({ error: '新增失败' });
  }
});

// API：更新供应商（需 supplier_qualifications_edit 编辑权限）
app.put('/api/suppliers/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: '缺少供应商ID' });

  const {
    supplier_name, supplier_type, material_category, contact_person, contact_phone,
    status, remarks1, remarks2
  } = req.body;

  if (!supplier_name || String(supplier_name).trim() === '') {
    return res.status(400).json({ error: '供方名称不能为空' });
  }

  const trimmedName = String(supplier_name).trim();

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM suppliers WHERE supplier_name = ? AND id != ?',
      [trimmedName, id]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '供方名称已存在' });
    }

    const [result] = await pool.execute(
      `UPDATE suppliers
       SET supplier_name = ?, supplier_type = ?, material_category = ?, contact_person = ?,
           contact_phone = ?, status = ?, remarks1 = ?, remarks2 = ?
       WHERE id = ?`,
      [
        trimmedName,
        supplier_type || null,
        material_category || null,
        contact_person || null,
        contact_phone || null,
        status || '正常',
        remarks1 || null,
        remarks2 || null,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }

    await logOperation(req, '更新供应商', 'supplier', id, `供方名称: ${trimmedName}`);

    res.json({ success: true, message: '供应商已更新' });
  } catch (err) {
    console.error('更新供应商失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '供方名称已存在' });
    }
    res.status(500).json({ error: '更新失败' });
  }
});

// API：删除供应商（需 supplier_qualifications_edit 编辑权限）
app.delete('/api/suppliers/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: '缺少供应商ID' });

  try {
    const [result] = await pool.execute(
      'DELETE FROM suppliers WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }

    await logOperation(req, '删除供应商', 'supplier', id, '');

    res.json({ success: true, message: '供应商已删除' });
  } catch (err) {
    console.error('删除供应商失败:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// API：切换供应商状态（active/inactive），需 supplier_qualifications_edit 编辑权限
// 当设置为 inactive 时，同步将 entry_supplier_qualifications 中 supplier_name 匹配的记录 current_status 设为 inactive
app.put('/api/suppliers/:id/status', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: '缺少供应商ID' });

  const { status } = req.body;
  const statusValue = status === 'inactive' ? 'inactive' : 'active';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [supplierRows] = await connection.execute(
      'SELECT supplier_name, status FROM suppliers WHERE id = ?',
      [id]
    );
    if (supplierRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '供应商不存在' });
    }

    await connection.execute(
      'UPDATE suppliers SET status = ? WHERE id = ?',
      [statusValue, id]
    );

    if (statusValue === 'inactive') {
      await connection.execute(
        `UPDATE entry_supplier_qualifications
         SET current_status = 'inactive'
         WHERE supplier_name = ?`,
        [supplierRows[0].supplier_name]
      );
    }

    await connection.commit();

    await logOperation(req, statusValue === 'inactive' ? '停用供应商' : '启用供应商',
      'supplier', id, `供方名称: ${supplierRows[0].supplier_name}`);

    res.json({ success: true, message: statusValue === 'inactive' ? '供应商已停用' : '供应商已启用' });
  } catch (err) {
    await connection.rollback();
    console.error('切换供应商状态失败:', err);
    res.status(500).json({ error: '切换状态失败' });
  } finally {
    connection.release();
  }
});

// API：下载供应商 CSV 模板（需 supplier_qualifications 查看权限）
app.get('/api/suppliers/template', requirePermission('supplier_qualifications'), (req, res) => {
  const csv = '\uFEFF' + SUPPLIER_CSV_HEADERS + '\n' + SUPPLIER_CSV_SAMPLE + '\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=suppliers-template.csv');
  res.send(csv);
});

// API：从 CSV 导入供应商（需 supplier_qualifications_edit 编辑权限）
// 仅新增，不会替换或删除已有记录；如与现有供方名称重复则整单拒绝。
app.post('/api/suppliers/import', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const { csv } = req.body;
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: '缺少 CSV 内容' });
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return res.status(400).json({ error: 'CSV 文件中缺少数据行' });
  }

  const headers = rows[0].map(h => h.trim());
  const requiredHeaders = ['供方名称'];
  const missing = requiredHeaders.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    return res.status(400).json({ error: `CSV 表头缺少必填列: ${missing.join(', ')}` });
  }

  function cell(name, cells) {
    const idx = headers.indexOf(name);
    return idx >= 0 && idx < cells.length ? cells[idx].trim() : '';
  }

  const insertList = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0].trim() === '') continue;
    if (cells.every(c => c.trim() === '')) continue;

    const supplierName = cell('供方名称', cells);
    if (!supplierName) {
      return res.status(400).json({ error: `第 ${i + 1} 行缺少供方名称` });
    }

    insertList.push({
      supplier_name: supplierName,
      supplier_type: cell('供应商类型', cells) || null,
      material_category: cell('物资分类', cells) || null,
      contact_person: cell('联系人', cells) || null,
      contact_phone: cell('电话', cells) || null,
      status: cell('状态', cells) || '正常',
      remarks1: cell('备注1', cells) || null,
      remarks2: cell('备注2', cells) || null
    });
  }

  if (insertList.length === 0) {
    return res.status(400).json({ error: 'CSV 中没有可导入的有效数据' });
  }

  // 校验 CSV 内部是否有重复供方名称
  const seenInFile = new Set();
  for (const item of insertList) {
    const key = item.supplier_name.toLowerCase();
    if (seenInFile.has(key)) {
      return res.status(400).json({ error: `CSV 中供方名称 "${item.supplier_name}" 存在重复` });
    }
    seenInFile.add(key);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 检查与系统中已有名称是否重复
    const [existingRows] = await connection.execute('SELECT supplier_name FROM suppliers');
    const existingSet = new Set(existingRows.map(r => String(r.supplier_name).trim().toLowerCase()));

    for (const item of insertList) {
      if (existingSet.has(item.supplier_name.toLowerCase())) {
        await connection.rollback();
        return res.status(400).json({ error: `导入失败：供方名称 "${item.supplier_name}" 已存在` });
      }
    }

    for (const item of insertList) {
      const [result] = await connection.execute(
        `INSERT INTO suppliers
         (supplier_name, supplier_type, material_category, contact_person, contact_phone,
          status, remarks1, remarks2, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.supplier_name,
          item.supplier_type,
          item.material_category,
          item.contact_person,
          item.contact_phone,
          item.status,
          item.remarks1,
          item.remarks2,
          req.session.username
        ]
      );

      await logOperation(req, '批量新增供应商', 'supplier', result.insertId, `供方名称: ${item.supplier_name}`);
    }

    await connection.commit();

    await logOperation(req, '上传CSV供应商', 'supplier', null, JSON.stringify({
      message: `通过 CSV 批量导入 ${insertList.length} 条供应商`,
      count: insertList.length
    }));

    res.json({ success: true, message: `成功导入 ${insertList.length} 条供应商` });
  } catch (err) {
    await connection.rollback();
    console.error('批量导入供应商失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      const match = err.message && err.message.match(/Duplicate entry '([^']+)'/);
      const dupValue = match ? match[1] : '';
      return res.status(400).json({ error: dupValue ? `导入失败：供方名称 "${dupValue}" 已存在` : '导入失败：供方名称已存在' });
    }
    res.status(500).json({ error: '导入失败：' + err.message });
  } finally {
    connection.release();
  }
});

// ========== 产品列表 API ==========

// API：查询产品列表（需 supplier_qualifications 查看权限）
app.get('/api/product-list', requirePermission('supplier_qualifications'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, company_name, product_name, model, manufacturer, status,
              created_by, created_at, updated_at
       FROM product_list
       ORDER BY company_name, product_name, model`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('查询产品列表失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// API：新增产品（需 supplier_qualifications_edit 编辑权限）
app.post('/api/product-list', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const { company_name, product_name, model, manufacturer } = req.body;

  if (!company_name || String(company_name).trim() === '') {
    return res.status(400).json({ error: '公司名称不能为空' });
  }
  if (!product_name || String(product_name).trim() === '') {
    return res.status(400).json({ error: '产品名不能为空' });
  }

  const trimmedCompany = String(company_name).trim();
  const trimmedProduct = String(product_name).trim();
  const trimmedModel = model ? String(model).trim() : '';
  const trimmedManufacturer = manufacturer ? String(manufacturer).trim() : null;

  try {
    // 校验公司名称必须存在于 suppliers.supplier_name
    const [supplierRows] = await pool.execute(
      'SELECT id FROM suppliers WHERE supplier_name = ?',
      [trimmedCompany]
    );
    if (supplierRows.length === 0) {
      return res.status(400).json({ error: `公司名称 "${trimmedCompany}" 不存在于供应商主数据中` });
    }

    // 校验整条记录是否已存在（公司、产品名、型号、生产商均相同）
    const [existing] = await pool.execute(
      `SELECT id FROM product_list
       WHERE company_name = ? AND product_name = ? AND COALESCE(model, "") = ? AND COALESCE(manufacturer, "") = ?`,
      [trimmedCompany, trimmedProduct, trimmedModel, trimmedManufacturer || '']
    );
    if (existing.length > 0) {
      return res.status(400).json({
        error: `记录已存在：${trimmedCompany} / ${trimmedProduct} / ${trimmedModel || '(无型号)'} / ${trimmedManufacturer || '(无生产商)'}`
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO product_list
       (company_name, product_name, model, manufacturer, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trimmedCompany, trimmedProduct, trimmedModel || null, trimmedManufacturer, 'active', req.session.username]
    );

    await logOperation(req, '新增产品', 'product_list', result.insertId,
      `公司: ${trimmedCompany}, 产品: ${trimmedProduct}`);

    res.json({ success: true, message: '产品已新增', id: result.insertId });
  } catch (err) {
    console.error('新增产品失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该产品已存在' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: `公司名称 "${trimmedCompany}" 不存在于供应商主数据中` });
    }
    res.status(500).json({ error: '新增失败' });
  }
});

// API：更新产品（需 supplier_qualifications_edit 编辑权限）
app.put('/api/product-list/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: '缺少产品ID' });

  const { company_name, product_name, model, manufacturer, status } = req.body;

  if (!company_name || String(company_name).trim() === '') {
    return res.status(400).json({ error: '公司名称不能为空' });
  }
  if (!product_name || String(product_name).trim() === '') {
    return res.status(400).json({ error: '产品名不能为空' });
  }

  const trimmedCompany = String(company_name).trim();
  const trimmedProduct = String(product_name).trim();
  const trimmedModel = model ? String(model).trim() : '';
  const trimmedManufacturer = manufacturer ? String(manufacturer).trim() : null;
  const statusValue = status === 'inactive' ? 'inactive' : 'active';

  try {
    const [supplierRows] = await pool.execute(
      'SELECT id FROM suppliers WHERE supplier_name = ?',
      [trimmedCompany]
    );
    if (supplierRows.length === 0) {
      return res.status(400).json({ error: `公司名称 "${trimmedCompany}" 不存在于供应商主数据中` });
    }

    const [existing] = await pool.execute(
      `SELECT id FROM product_list
       WHERE company_name = ? AND product_name = ? AND COALESCE(model, "") = ? AND COALESCE(manufacturer, "") = ? AND id != ?`,
      [trimmedCompany, trimmedProduct, trimmedModel, trimmedManufacturer || '', id]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        error: `记录已存在：${trimmedCompany} / ${trimmedProduct} / ${trimmedModel || '(无型号)'} / ${trimmedManufacturer || '(无生产商)'}`
      });
    }

    const [result] = await pool.execute(
      `UPDATE product_list
       SET company_name = ?, product_name = ?, model = ?, manufacturer = ?, status = ?
       WHERE id = ?`,
      [trimmedCompany, trimmedProduct, trimmedModel || null, trimmedManufacturer, statusValue, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '产品不存在' });
    }

    await logOperation(req, '更新产品', 'product_list', id,
      `公司: ${trimmedCompany}, 产品: ${trimmedProduct}`);

    res.json({ success: true, message: '产品已更新' });
  } catch (err) {
    console.error('更新产品失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该产品已存在' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: `公司名称 "${trimmedCompany}" 不存在于供应商主数据中` });
    }
    res.status(500).json({ error: '更新失败' });
  }
});

// API：删除产品（需 supplier_qualifications_edit 编辑权限）
app.delete('/api/product-list/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: '缺少产品ID' });

  try {
    const [result] = await pool.execute(
      'DELETE FROM product_list WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '产品不存在' });
    }

    await logOperation(req, '删除产品', 'product_list', id, '');

    res.json({ success: true, message: '产品已删除' });
  } catch (err) {
    console.error('删除产品失败:', err);
    res.status(500).json({ error: '删除失败' });
  }
});

// API：切换产品状态（active/inactive），需 supplier_qualifications_edit 编辑权限
// 当设置为 inactive 时，同步将 entry_supplier_qualifications 中匹配
// company_name + product_name + model + manufacturer 的记录 current_status 设为 inactive
app.put('/api/product-list/:id/status', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: '缺少产品ID' });

  const { status } = req.body;
  const statusValue = status === 'inactive' ? 'inactive' : 'active';

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [productRows] = await connection.execute(
      'SELECT company_name, product_name, model, manufacturer, status FROM product_list WHERE id = ?',
      [id]
    );
    if (productRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '产品不存在' });
    }

    await connection.execute(
      'UPDATE product_list SET status = ? WHERE id = ?',
      [statusValue, id]
    );

    if (statusValue === 'inactive') {
      const p = productRows[0];
      await connection.execute(
        `UPDATE entry_supplier_qualifications eq
         INNER JOIN product_list pl ON eq.prudoct_list_id = pl.id
         SET eq.current_status = 'inactive'
         WHERE pl.company_name = ?
           AND pl.product_name = ?
           AND COALESCE(pl.model, '') = ?
           AND COALESCE(pl.manufacturer, '') = ?`,
        [p.company_name, p.product_name, p.model || '', p.manufacturer || '']
      );
    }

    await connection.commit();

    await logOperation(req, statusValue === 'inactive' ? '停用产品' : '启用产品',
      'product_list', id, `公司: ${productRows[0].company_name}, 产品: ${productRows[0].product_name}`);

    res.json({ success: true, message: statusValue === 'inactive' ? '产品已停用' : '产品已启用' });
  } catch (err) {
    await connection.rollback();
    console.error('切换产品状态失败:', err);
    res.status(500).json({ error: '切换状态失败' });
  } finally {
    connection.release();
  }
});

// API：下载产品列表 CSV 模板（需 supplier_qualifications 查看权限）
app.get('/api/product-list/template', requirePermission('supplier_qualifications'), (req, res) => {
  const csv = '\uFEFF' + PRODUCT_LIST_CSV_HEADERS + '\n' + PRODUCT_LIST_CSV_SAMPLE + '\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=product-list-template.csv');
  res.send(csv);
});

// API：从 CSV 导入产品（需 supplier_qualifications_edit 编辑权限）
// 仅新增，不会替换或删除已有记录；公司名称必须在 suppliers.supplier_name 中存在。
app.post('/api/product-list/import', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const { csv } = req.body;
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: '缺少 CSV 内容' });
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    return res.status(400).json({ error: 'CSV 文件中缺少数据行' });
  }

  const headers = rows[0].map(h => h.trim());
  const requiredHeaders = ['公司名称', '产品名'];
  const missing = requiredHeaders.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    return res.status(400).json({ error: `CSV 表头缺少必填列: ${missing.join(', ')}` });
  }

  function cell(name, cells) {
    const idx = headers.indexOf(name);
    return idx >= 0 && idx < cells.length ? cells[idx].trim() : '';
  }

  const insertList = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length === 1 && cells[0].trim() === '') continue;
    if (cells.every(c => c.trim() === '')) continue;

    const companyName = cell('公司名称', cells);
    const productName = cell('产品名', cells);
    if (!companyName) {
      return res.status(400).json({ error: `第 ${i + 1} 行缺少公司名称` });
    }
    if (!productName) {
      return res.status(400).json({ error: `第 ${i + 1} 行缺少产品名` });
    }

    insertList.push({
      company_name: companyName,
      product_name: productName,
      model: cell('型号', cells) || '',
      manufacturer: cell('生产商', cells) || null
    });
  }

  if (insertList.length === 0) {
    return res.status(400).json({ error: 'CSV 中没有可导入的有效数据' });
  }

  // 校验 CSV 内部是否有重复（整条记录：公司、产品名、型号、生产商均相同）
  const seenInFile = new Map();
  for (let i = 0; i < insertList.length; i++) {
    const item = insertList[i];
    const key = `${item.company_name}\t${item.product_name}\t${item.model}\t${item.manufacturer || ''}`.toLowerCase();
    if (seenInFile.has(key)) {
      const firstRow = seenInFile.get(key) + 2;
      const currentRow = i + 2;
      return res.status(400).json({
        error: `CSV 中第 ${firstRow} 行与第 ${currentRow} 行重复：${item.company_name} / ${item.product_name} / ${item.model || '(无型号)'} / ${item.manufacturer || '(无生产商)'}`
      });
    }
    seenInFile.set(key, i);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 校验所有公司名称是否存在于 suppliers
    const [supplierRows] = await connection.execute('SELECT supplier_name FROM suppliers');
    const supplierSet = new Set(supplierRows.map(r => String(r.supplier_name).trim().toLowerCase()));
    for (const item of insertList) {
      if (!supplierSet.has(item.company_name.toLowerCase())) {
        await connection.rollback();
        return res.status(400).json({ error: `导入失败：公司名称 "${item.company_name}" 不存在于供应商主数据中` });
      }
    }

    // 检查与数据库中已有记录是否重复（整条记录一致才视为重复）
    const [existingRows] = await connection.execute(
      'SELECT company_name, product_name, COALESCE(model, "") AS model, COALESCE(manufacturer, "") AS manufacturer FROM product_list'
    );
    const existingSet = new Set(
      existingRows.map(r => `${r.company_name}\t${r.product_name}\t${r.model}\t${r.manufacturer}`.toLowerCase())
    );

    for (let i = 0; i < insertList.length; i++) {
      const item = insertList[i];
      const key = `${item.company_name}\t${item.product_name}\t${item.model}\t${item.manufacturer || ''}`.toLowerCase();
      if (existingSet.has(key)) {
        await connection.rollback();
        return res.status(400).json({
          error: `导入失败：第 ${i + 2} 行 [${item.company_name} / ${item.product_name} / ${item.model || '(无型号)'} / ${item.manufacturer || '(无生产商)'}] 与系统中已有记录重复`
        });
      }
    }

    for (const item of insertList) {
      const [result] = await connection.execute(
        `INSERT INTO product_list
         (company_name, product_name, model, manufacturer, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [
          item.company_name,
          item.product_name,
          item.model || null,
          item.manufacturer,
          req.session.username
        ]
      );

      await logOperation(req, '批量新增产品', 'product_list', result.insertId,
        `公司: ${item.company_name}, 产品: ${item.product_name}`);
    }

    await connection.commit();

    await logOperation(req, '上传CSV产品列表', 'product_list', null, JSON.stringify({
      message: `通过 CSV 批量导入 ${insertList.length} 条产品`,
      count: insertList.length
    }));

    res.json({ success: true, message: `成功导入 ${insertList.length} 条产品` });
  } catch (err) {
    await connection.rollback();
    console.error('批量导入产品失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      const match = err.message && err.message.match(/Duplicate entry '([^']+)'/);
      const dupValue = match ? match[1] : '';
      return res.status(400).json({ error: dupValue ? `导入失败："${dupValue}" 已存在` : '导入失败：记录已存在' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(400).json({ error: '导入失败：公司名称不存在于供应商主数据中' });
    }
    res.status(500).json({ error: '导入失败：' + err.message });
  } finally {
    connection.release();
  }
});

// ========== 录入供应商资质 API ==========

// API：查询指定供应商或产品的资质记录（需 supplier_qualifications 查看权限）
app.get('/api/entry-supplier-qualifications', requirePermission('supplier_qualifications'), async (req, res) => {
  const supplierId = parseInt(req.query.supplier_id, 10);
  const productListId = parseInt(req.query.product_list_id, 10);

  if (!supplierId && !productListId) {
    return res.status(400).json({ error: '缺少供应商ID或产品ID' });
  }

  try {
    let whereClause = '';
    let params = [];
    if (productListId) {
      whereClause = 'WHERE prudoct_list_id = ?';
      params = [productListId];
    } else {
      whereClause = 'WHERE supplier_id = ?';
      params = [supplierId];
    }

    const [rows] = await pool.execute(
      `SELECT id, supplier_id, supplier_name, qualification_type_id, qualification_name,
              prudoct_list_id, issue_date, expiry_date, current_status, permanent_valid, description, remarks
       FROM entry_supplier_qualifications
       ${whereClause}
       ORDER BY qualification_name, issue_date`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('查询供应商资质记录失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// API：批量保存供应商资质（需 supplier_qualifications_edit 编辑权限）
// 包含 id 的记录执行 UPDATE，否则执行 INSERT。
app.post('/api/entry-supplier-qualifications/batch', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const { records } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: '缺少要保存的资质记录' });
  }

  const normalizedRecords = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const recordId = r.id ? parseInt(r.id, 10) : null;
    const qualificationTypeId = parseInt(r.qualification_type_id, 10);
    const qualificationName = r.qualification_name ? String(r.qualification_name).trim() : '';
    const productListId = r.prudoct_list_id ? parseInt(r.prudoct_list_id, 10) : null;

    if (!qualificationTypeId) {
      return res.status(400).json({ error: `第 ${i + 1} 条记录缺少资质ID` });
    }
    if (!qualificationName) {
      return res.status(400).json({ error: `第 ${i + 1} 条记录缺少资质名称` });
    }

    let supplierId;
    let supplierName;
    if (productListId) {
      const [productRows] = await pool.execute(
        `SELECT p.company_name, s.id AS supplier_id
         FROM product_list p
         LEFT JOIN suppliers s ON s.supplier_name = p.company_name
         WHERE p.id = ?`,
        [productListId]
      );
      if (productRows.length === 0) {
        return res.status(400).json({ error: `第 ${i + 1} 条记录对应的产品不存在` });
      }
      if (!productRows[0].supplier_id) {
        return res.status(400).json({ error: `第 ${i + 1} 条记录对应的公司未在供应商表中登记` });
      }
      supplierId = productRows[0].supplier_id;
      supplierName = productRows[0].company_name;
    } else {
      supplierId = parseInt(r.supplier_id, 10);
      supplierName = r.supplier_name ? String(r.supplier_name).trim() : '';
      if (!supplierId) {
        return res.status(400).json({ error: `第 ${i + 1} 条记录缺少供应商ID或产品ID` });
      }
      if (!supplierName) {
        return res.status(400).json({ error: `第 ${i + 1} 条记录缺少供应商名称` });
      }
    }

    const permanentValid = r.permanent_valid === true || r.permanent_valid === 1 || String(r.permanent_valid).trim() === '1' ? 1 : 0;
    const issueDate = r.issue_date ? String(r.issue_date).trim() : null;
    const expiryDate = permanentValid ? null : (r.expiry_date ? String(r.expiry_date).trim() : null);

    normalizedRecords.push({
      id: recordId,
      supplier_id: supplierId,
      supplier_name: supplierName,
      prudoct_list_id: productListId,
      qualification_type_id: qualificationTypeId,
      qualification_name: qualificationName,
      issue_date: issueDate,
      expiry_date: expiryDate,
      current_status: r.current_status ? String(r.current_status).trim() : 'active',
      permanent_valid: permanentValid,
      description: r.description ? String(r.description).trim() : null,
      remarks: r.remarks ? String(r.remarks).trim() : null
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    let insertCount = 0;
    let updateCount = 0;

    for (const item of normalizedRecords) {
      if (item.id) {
        const [result] = await connection.execute(
          `UPDATE entry_supplier_qualifications
           SET supplier_name = ?, qualification_type_id = ?, qualification_name = ?,
               prudoct_list_id = ?, issue_date = ?, expiry_date = ?, current_status = ?, permanent_valid = ?,
               description = ?, remarks = ?
           WHERE id = ? AND supplier_id = ?`,
          [
            item.supplier_name,
            item.qualification_type_id,
            item.qualification_name,
            item.prudoct_list_id,
            item.issue_date,
            item.expiry_date,
            item.current_status,
            item.permanent_valid,
            item.description,
            item.remarks,
            item.id,
            item.supplier_id
          ]
        );
        if (result.affectedRows > 0) updateCount++;
      } else {
        await connection.execute(
          `INSERT INTO entry_supplier_qualifications
           (supplier_id, supplier_name, qualification_type_id, qualification_name,
            prudoct_list_id, issue_date, expiry_date, current_status, permanent_valid,
            description, remarks, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.supplier_id,
            item.supplier_name,
            item.qualification_type_id,
            item.qualification_name,
            item.prudoct_list_id,
            item.issue_date,
            item.expiry_date,
            item.current_status,
            item.permanent_valid,
            item.description,
            item.remarks,
            req.session.username
          ]
        );
        insertCount++;
      }
    }

    await connection.commit();

    await logOperation(req, '保存供应商资质', 'entry_supplier_qualification', null, JSON.stringify({
      message: `批量保存供应商资质`,
      insert_count: insertCount,
      update_count: updateCount
    }));

    res.json({ success: true, message: `成功保存：新增 ${insertCount} 条，更新 ${updateCount} 条` });
  } catch (err) {
    await connection.rollback();
    console.error('批量保存供应商资质失败:', err);
    res.status(500).json({ error: '保存失败：' + err.message });
  } finally {
    connection.release();
  }
});

// API：删除供应商资质记录（需 supplier_qualifications_edit 编辑权限）
app.delete('/api/entry-supplier-qualifications/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) {
    return res.status(400).json({ error: '缺少资质记录ID' });
  }

  try {
    const [result] = await pool.execute(
      'DELETE FROM entry_supplier_qualifications WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '资质记录不存在' });
    }

    await logOperation(req, '删除供应商资质', 'entry_supplier_qualification', id, JSON.stringify({
      message: `删除供应商资质记录 ID:${id}`
    }));

    res.json({ success: true, message: '资质记录已删除' });
  } catch (err) {
    console.error('删除供应商资质记录失败:', err);
    res.status(500).json({ error: '删除失败：' + err.message });
  }
});

// 首页（需认证）：登录后进入侧边栏导航页
app.get('/', requireAuthPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'nav-sidebar.html'));
});

// 模板资源改为从数据库加载（见 loadTemplates 函数）
// 原 templates/print-templates.js 与 templates/print-style.css 已通过 scripts/migrate-templates.js 导入数据库

// 横向模板集合
const LANDSCAPE_TEMPLATES = new Set(['mixingrecord', 'labelrecord', 'outsourcingrecord', 'mixingproduction1', 'mixingproduction2']);

// 图片基础 URL：模板中使用了相对路径如 images/logo.png，
// Puppeteer 通过 page.setContent() 加载时无法解析相对路径，
// 需要在 HTML 中注入 <base> 标签指向图片所在服务器地址。
// 如果图片放在 Nginx 的 /var/www/pdf-print/images/ 下，这里就是 http://服务器IP/
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL || 'http://172.19.40.91/';

// ========== 会话与认证（零依赖，无需额外 npm 包） ==========
const sessions = new Map(); // sid -> { username, createdAt }

const SESSION_COOKIE_NAME = 'sid';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 小时

// 默认账号已迁移到数据库，见 sql/db-setup.sql

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookie(req) {
  const cookie = req.headers.cookie || '';
  const result = {};
  cookie.split(';').forEach(pair => {
    const [k, v] = pair.trim().split('=');
    if (k) result[k] = decodeURIComponent(v || '');
  });
  return result;
}

function getSession(req) {
  const cookies = parseCookie(req);
  const sid = cookies[SESSION_COOKIE_NAME];
  if (!sid) return null;
  const session = sessions.get(sid);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_MAX_AGE_MS) {
    sessions.delete(sid);
    return null;
  }
  return session;
}

function setSessionCookie(res, sid) {
  const maxAgeSec = Math.floor(SESSION_MAX_AGE_MS / 1000);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function requireAuth(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '未登录或会话已过期' });
  }
  req.session = session;
  next();
}

function requireAuthPage(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.redirect('/login');
  }
  req.session = session;
  next();
}

function requireAdmin(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: '未登录或会话已过期' });
  }
  if (session.username !== 'admin') {
    return res.status(403).json({ error: '只有管理员可以执行此操作' });
  }
  req.session = session;
  next();
}

function requireAdminPage(req, res, next) {
  const session = getSession(req);
  if (!session) {
    return res.redirect('/login');
  }
  if (session.username !== 'admin') {
    return res.status(403).send('只有管理员可以访问此页面');
  }
  req.session = session;
  next();
}

// ========== 用户功能权限（feature_key 级别 ACL） ==========
const PERMISSION_FEATURES = [
  'print', 'logs', 'dashboard', 'template_admin', 'operation_logs', 'training_records',
  'supplier_qualifications', 'supplier_qualifications_edit',
  'workflow_design', 'workflow_view_task', 'workflow_transfer_task', 'workflow_recall_task',
  'ocr_recognize', 'ocr_template_design', 'backup_management', 'instrument_meter'
];

async function checkPermission(username, featureKey) {
  // admin 拥有所有权限
  if (username === 'admin') return true;

  try {
    const [rows] = await pool.execute(
      'SELECT is_allowed FROM user_permissions WHERE username = ? AND feature_key = ?',
      [username, featureKey]
    );
    if (rows.length === 0) return false;
    return rows[0].is_allowed === 1;
  } catch (err) {
    console.error('权限查询失败:', err);
    return false;
  }
}

function requirePermission(featureKey) {
  return async (req, res, next) => {
    const session = getSession(req);
    if (!session) {
      return res.status(401).json({ error: '未登录或会话已过期' });
    }
    if (await checkPermission(session.username, featureKey)) {
      req.session = session;
      return next();
    }
    return res.status(403).json({ error: '没有权限执行此操作' });
  };
}

function requirePermissionPage(featureKey) {
  return async (req, res, next) => {
    const session = getSession(req);
    if (!session) {
      return res.redirect('/login');
    }
    if (await checkPermission(session.username, featureKey)) {
      req.session = session;
      return next();
    }
    return res.status(403).send('没有权限访问此页面');
  };
}

function getUsernameFromReq(req) {
  return req.session ? req.session.username : null;
}

// ==================== 通用审批流引擎初始化 ====================

// 工作流超时提醒邮件发送器（与营业执照提醒共用 SMTP 配置）
const WORKFLOW_SMTP_HOST = process.env.SMTP_HOST || '172.22.44.75';
const WORKFLOW_SMTP_PORT = parseInt(process.env.SMTP_PORT || '25', 10);
const WORKFLOW_SMTP_FROM = process.env.SMTP_FROM || 'DIC@aptar.com';

const workflowMailer = nodemailer.createTransport({
  host: WORKFLOW_SMTP_HOST,
  port: WORKFLOW_SMTP_PORT,
  auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined,
  tls: { rejectUnauthorized: false }
});

setupWorkflowRoutes(app, {
  requireAuth,
  requirePermission,
  getUsername: getUsernameFromReq
});

setupOcrRoutes(app, {
  requireAuth,
  requirePermission,
  getUsername: getUsernameFromReq
});

workflowEngine = app.get('workflowEngine');

// 注入超时提醒邮件发送逻辑
workflowEngine.sendReminder = async (task) => {
  try {
    let toEmail = null;
    if (task.assignee_username) {
      const [rows] = await pool.execute(
        'SELECT email FROM users WHERE username = ? AND status = 1',
        [task.assignee_username]
      );
      if (rows.length > 0 && rows[0].email) {
        toEmail = rows[0].email;
      }
    }
    if (!toEmail) {
      console.log(`[审批超时提醒] 无法获取审批人 ${task.assignee_username} 的邮箱，跳过发送`);
      return;
    }
    await workflowMailer.sendMail({
      from: WORKFLOW_SMTP_FROM,
      to: toEmail,
      subject: '审批任务即将超时提醒',
      html: `<p>您有一个审批任务已逾期或即将逾期，请及时处理。</p>
             <p>业务标识：${task.business_key || ''}</p>
             <p>任务ID：${task.id}</p>`
    });
    console.log(`[审批超时提醒] 已发送给 ${toEmail}，任务ID=${task.id}`);
  } catch (e) {
    console.error('发送审批超时提醒邮件失败:', e.message);
  }
};

// 注册供应商资质模块钩子：流程结束时记录日志
workflowEngine.registerModule('supplier_qualifications', {
  onProcessFinish: async ({ instance, result }) => {
    try {
      await pool.execute(
        `INSERT INTO supplier_qualification_logs
         (username, action, supplier_id, supplier_name, detail, ip_address, computer_name, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'system',
          '流程结束',
          null,
          instance.business_key || '',
          JSON.stringify({ instance_id: instance.id, result }),
          '127.0.0.1',
          'system',
          'workflow-engine'
        ]
      );
    } catch (e) {
      console.error('记录供应商资质流程结束日志失败:', e.message);
    }
  },
  onTaskReject: async ({ instance, task, result }) => {
    try {
      await pool.execute(
        `INSERT INTO supplier_qualification_logs
         (username, action, supplier_id, supplier_name, detail, ip_address, computer_name, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'system',
          '流程驳回',
          null,
          instance.business_key || '',
          JSON.stringify({ instance_id: instance.id, task_id: task?.id, result }),
          '127.0.0.1',
          'system',
          'workflow-engine'
        ]
      );
    } catch (e) {
      console.error('记录供应商资质流程驳回日志失败:', e.message);
    }
  }
});

// 启动审批超时扫描（每 5 分钟）
workflowEngine.startTimeoutCheck(5 * 60 * 1000);

/**
 * 获取客户端 IP、User-Agent，并尝试反向解析电脑名称
 */
function getClientInfo(req) {
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  return { ip, userAgent };
}

const dnsReverse = util.promisify(dns.reverse);

async function resolveComputerName(ip) {
  if (!ip) return '';
  const cleanIp = ip.split(',')[0].trim();
  if (!cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1') return '';
  try {
    const hostnames = await dnsReverse(cleanIp);
    return hostnames && hostnames.length > 0 ? hostnames[0] : '';
  } catch (e) {
    return '';
  }
}

/**
 * 记录供应商资质操作日志
 */
async function logSupplierOperation(req, action, supplierId, supplierName, detail) {
  try {
    const session = req.session || getSession(req) || {};
    const username = session.username || 'unknown';
    const { ip, userAgent } = getClientInfo(req);
    const computerName = await resolveComputerName(ip);

    await pool.execute(
      `INSERT INTO supplier_qualification_logs
       (username, action, supplier_id, supplier_name, detail, ip_address, computer_name, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, action, supplierId || null, supplierName || '', detail ? JSON.stringify(detail) : null, ip, computerName, userAgent]
    );
  } catch (err) {
    console.error('供应商资质日志记录失败:', err.message);
  }
}

/**
 * 根据查询内容前缀判断查询类型
 * - 以 "SCRW" 开头：按单据编号查询生产任务
 * - 其他：默认同样查询 Make_Task（可按需改为其他表/字段）
 *
 * @param {string} querydata 用户输入的查询内容
 * @returns {string} 查询类型标识
 */
function getQueryType(querydata) {
  if (typeof querydata === 'string' && querydata.toUpperCase().startsWith('SCRW')) {
    return 'SCRW';
  }
  return 'DEFAULT';
}

/**
 * 从 MSSQL（ERP1）直接查询真实生产数据（替代原 Dify 工作流）
 *
 * 说明：
 * 1. 以 SCRW 开头的查询使用 Make_Task 表，按 p_content1 匹配
 * 2. 其他查询类型请在下方 switch 中补充对应的 SQL
 * 3. 所有查询均使用参数化输入，防止 SQL 注入
 *
 * @param {string} querydata 用户输入的查询内容
 * @returns {Array} 原始数据数组，元素字段：mingcheng, guige, xinghao, peifang, pici, beizhu, num
 */
async function fetchMssqlData(querydata) {
  const type = getQueryType(querydata);
  let sql;

  switch (type) {
    case 'SCRW':
      // 用户提供的单据编号查询：Make_Task 表
      sql = `
        SELECT
          CAST(p_name AS NVARCHAR(MAX)) AS mingcheng,
          p_content1 AS pici,
          CAST(p_brand AS NVARCHAR(MAX)) AS xinghao,
          CAST(p_size AS NVARCHAR(MAX)) AS guige,
          CAST(p_content3 AS NVARCHAR(MAX)) AS peifang,
          CAST(content AS NVARCHAR(MAX)) AS beizhu,
          CAST(num AS NVARCHAR(MAX)) AS num
        FROM Make_Task
        WHERE num = @querydata
      `;
      break;
    default:
      // 默认也按 p_content1 查询；如其他前缀需要走不同表/字段，请在此处修改
      sql = `
        SELECT
          CAST(p_name AS NVARCHAR(MAX)) AS mingcheng,
          p_content1 AS pici,
          CAST(p_brand AS NVARCHAR(MAX)) AS xinghao,
          CAST(p_size AS NVARCHAR(MAX)) AS guige,
          CAST(p_content3 AS NVARCHAR(MAX)) AS peifang,
          CAST(content AS NVARCHAR(MAX)) AS beizhu,
          CAST(num AS NVARCHAR(MAX)) AS num
        FROM Make_Task
        WHERE p_content1 = @querydata
      `;
      break;
  }

  const request = mssqlPool.request();
  request.input('querydata', mssql.NVarChar, querydata);
  const result = await request.query(sql);
  return result.recordset || [];
}

/**
 * 从数据库加载模板资源
 *
 * 1. 读取全局 CSS（template_css 表）
 * 2. 读取所有生效的模板版本 JS 代码，拼接成一个可执行脚本
 *
 * 说明：
 * - 模板代码从数据库读取后，支持在线更新而无需重启服务
 * - 首次启动前请先执行 sql/template-tables.sql 和 scripts/migrate-templates.js
 */
async function loadTemplates() {
  // 1. 加载全局 CSS
  const [cssRows] = await pool.execute(
    'SELECT css_content FROM template_css WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
  );
  if (cssRows.length === 0) {
    throw new Error('数据库中未找到生效的全局 CSS，请先执行模板迁移脚本');
  }
  const cssCode = cssRows[0].css_content;

  // 2. 加载所有生效的模板版本 JS 代码
  const [versionRows] = await pool.execute(`
    SELECT v.js_code, t.render_function_name
    FROM template_versions v
    JOIN templates t ON v.template_id = t.id
    WHERE v.is_active = 1 AND t.is_active = 1
    ORDER BY t.sort_order ASC
  `);

  if (versionRows.length === 0) {
    throw new Error('数据库中未找到生效的模板版本，请先执行模板迁移脚本');
  }

  const jsCode = versionRows.map(row => row.js_code).join('\n');
  return { jsCode, cssCode };
}

/**
 * 在 Node 端执行模板 JS，获取渲染函数
 */
function getRenderFunctions(jsCode) {
  // 构造一个沙箱函数，把模板代码跑一遍，提取渲染函数
  const sandbox = new Function(`
    const module = { exports: {} };
    ${jsCode}
    return {
      renderCover:     typeof renderCover     !== 'undefined' ? renderCover     : null,
      renderBatchRecord: typeof renderBatchRecord !== 'undefined' ? renderBatchRecord : null,
      renderMixingRecord: typeof renderMixingRecord !== 'undefined' ? renderMixingRecord : null,
      renderCalenderingRecord: typeof renderCalenderingRecord !== 'undefined' ? renderCalenderingRecord : null,
      renderVulcanizingRecord: typeof renderVulcanizingRecord !== 'undefined' ? renderVulcanizingRecord : null,
      renderTrimmingRecord: typeof renderTrimmingRecord !== 'undefined' ? renderTrimmingRecord : null,
      renderCleaningRecord: typeof renderCleaningRecord !== 'undefined' ? renderCleaningRecord : null,
      renderMaterialBalance: typeof renderMaterialBalance !== 'undefined' ? renderMaterialBalance : null,
      renderLabelRecord: typeof renderLabelRecord !== 'undefined' ? renderLabelRecord : null,
      renderOutsourcingRecord: typeof renderOutsourcingRecord !== 'undefined' ? renderOutsourcingRecord : null,
      renderInnerPackingRecord: typeof renderInnerPackingRecord !== 'undefined' ? renderInnerPackingRecord : null,
      renderBatchingCleanup: typeof renderBatchingCleanup !== 'undefined' ? renderBatchingCleanup : null,
      renderMixingCleanup: typeof renderMixingCleanup !== 'undefined' ? renderMixingCleanup : null,
      renderCalenderingCleanup: typeof renderCalenderingCleanup !== 'undefined' ? renderCalenderingCleanup : null,
      renderVulcanizingCleanup: typeof renderVulcanizingCleanup !== 'undefined' ? renderVulcanizingCleanup : null,
      renderTrimmingCleanup: typeof renderTrimmingCleanup !== 'undefined' ? renderTrimmingCleanup : null,
      renderWashingCleanup: typeof renderWashingCleanup !== 'undefined' ? renderWashingCleanup : null,
      renderInnerPackagingCleanup: typeof renderInnerPackagingCleanup !== 'undefined' ? renderInnerPackagingCleanup : null,
      renderOuterPackagingCleanup: typeof renderOuterPackagingCleanup !== 'undefined' ? renderOuterPackagingCleanup : null,
      renderMixingCleanup1: typeof renderMixingCleanup1 !== 'undefined' ? renderMixingCleanup1 : null,
      renderMixingCleanup2: typeof renderMixingCleanup2 !== 'undefined' ? renderMixingCleanup2 : null,
      renderWashingPreCleanup: typeof renderWashingPreCleanup !== 'undefined' ? renderWashingPreCleanup : null,
      renderMixingProduction1: typeof renderMixingProduction1 !== 'undefined' ? renderMixingProduction1 : null,
      renderMixingProduction2: typeof renderMixingProduction2 !== 'undefined' ? renderMixingProduction2 : null,
      renderTestSampleVulcanizing: typeof renderTestSampleVulcanizing !== 'undefined' ? renderTestSampleVulcanizing : null,
      renderUserTrainingSummary: typeof renderUserTrainingSummary !== 'undefined' ? renderUserTrainingSummary : null
    };
  `);
  return sandbox();
}

/**
 * 根据前端传来的任务，拼装完整 HTML
 *
 * @param {Array} records   数据行
 * @param {Array} tasks     [{ template: 'workorder', copies: 2 }, ...]
 * @param {Object} fns      渲染函数字典
 * @param {string} cssCode  全局 CSS 内容
 */
function buildPrintHTML(records, tasks, fns, cssCode) {
  let bodyHTML = '';

  // 按任务顺序、按份数、按数据行 依次生成页面
  tasks.forEach((task) => {
    const tplName = task.template;
    const copies = task.copies || 1;

    const renderFn = fns[
      tplName === 'cover' ? 'renderCover'
        : tplName === 'batchrecord' ? 'renderBatchRecord'
        : tplName === 'mixingrecord' ? 'renderMixingRecord'
        : tplName === 'calenderingrecord' ? 'renderCalenderingRecord'
        : tplName === 'vulcanizingrecord' ? 'renderVulcanizingRecord'
        : tplName === 'trimmingrecord' ? 'renderTrimmingRecord'
        : tplName === 'cleaningrecord' ? 'renderCleaningRecord'
        : tplName === 'materialbalance' ? 'renderMaterialBalance'
        : tplName === 'labelrecord' ? 'renderLabelRecord'
        : tplName === 'outsourcingrecord' ? 'renderOutsourcingRecord'
        : tplName === 'innerpackingrecord' ? 'renderInnerPackingRecord'
        : tplName === 'batchingcleanup' ? 'renderBatchingCleanup'
        : tplName === 'mixingcleanup' ? 'renderMixingCleanup'
        : tplName === 'calenderingcleanup' ? 'renderCalenderingCleanup'
        : tplName === 'vulcanizingcleanup' ? 'renderVulcanizingCleanup'
        : tplName === 'trimmingcleanup' ? 'renderTrimmingCleanup'
        : tplName === 'washingcleanup' ? 'renderWashingCleanup'
        : tplName === 'innerpackagingcleanup' ? 'renderInnerPackagingCleanup'
        : tplName === 'outerpackagingcleanup' ? 'renderOuterPackagingCleanup'
        : tplName === 'mixingcleanup1' ? 'renderMixingCleanup1'
        : tplName === 'mixingcleanup2' ? 'renderMixingCleanup2'
        : tplName === 'washingprecleanup' ? 'renderWashingPreCleanup'
        : tplName === 'mixingproduction1' ? 'renderMixingProduction1'
        : tplName === 'mixingproduction2' ? 'renderMixingProduction2'
        : tplName === 'testsamplevulcanizing' ? 'renderTestSampleVulcanizing'
        : null
    ];

    if (!renderFn) {
      throw new Error('未知模板类型：' + tplName);
    }

    for (let c = 0; c < copies; c++) {
      records.forEach((row, idx) => {
        bodyHTML += renderFn(row, idx + 1);
      });
    }
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<base href="${IMAGE_BASE_URL}">
<title>Print</title>
<style>
${cssCode}
</style>
</head>
<body>
<div id="print-container">
${bodyHTML}
</div>
</body>
</html>`;

  return { html };
}

/**
 * 拼装用户培训记录个人汇总 HTML
 *
 * @param {Object} user      用户信息（含 username / chinese_name / department / position / hire_date）
 * @param {Array} records    培训记录列表
 * @param {Object} fns       渲染函数字典
 * @param {string} cssCode   全局 CSS 内容
 */
function buildTrainingSummaryHTML(user, records, fns, cssCode) {
  const ROWS_PER_PAGE = 16;
  const totalPages = Math.max(1, Math.ceil(records.length / ROWS_PER_PAGE));
  let bodyHTML = '';

  for (let page = 0; page < totalPages; page++) {
    const pageRecords = records.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    bodyHTML += fns.renderUserTrainingSummary({
      user,
      records: pageRecords,
      page: page + 1,
      totalPages
    }, page + 1);
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<base href="${IMAGE_BASE_URL}">
<title>用户培训记录个人汇总</title>
<style>
${cssCode}
</style>
</head>
<body>
<div id="print-container">
${bodyHTML}
</div>
</body>
</html>`;
}

/**
 * 使用 Puppeteer 为单组任务生成 PDF Buffer
 */
async function generatePDFBuffer(browser, records, tasks, fns, isLandscape, cssCode) {
  const { html } = buildPrintHTML(records, tasks, fns, cssCode);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buffer = await page.pdf({
    format: 'A4',
    landscape: isLandscape,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  await page.close();
  return buffer;
}

/**
 * 合并多个 PDF Buffer 为一个
 */
async function mergePDFs(buffers) {
  const mergedPdf = await PDFDocument.create();
  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(p => mergedPdf.addPage(p));
  }
  return Buffer.from(await mergedPdf.save());
}

/**
 * POST /api/print
 * Body: {
 *   querydata:     '单据编号',           // 用于后端重新查询真实数据
 *   selectedPici:  ['20240601A', ...],  // 用户选中的批次号列表
 *   tasks:         [{ template: 'workorder', copies: 2 }, ...]
 * }
 *
 * 安全设计：后端不信任前端传来的完整数据，只用 querydata 重新查 MSSQL，
 * 然后根据 selectedPici 筛选真实记录。即使前端 F12 改了表格内容，
 * 打印出来的 PDF 仍然是数据库里的真实值。
 */
app.post('/api/print', requirePermission('print'), async (req, res) => {
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
    // 1. 后端重新查询真实数据（关键安全步骤）
    const allRecords = await fetchMssqlData(querydata);
    const records = allRecords.filter(row => selectedPici.includes(row.pici));

    if (records.length === 0) {
      return res.status(400).json({ error: '选中的批次号在数据源中未找到，可能已被篡改' });
    }

    // 2. 从数据库加载模板
    const { jsCode, cssCode } = await loadTemplates();
    const fns = getRenderFunctions(jsCode);

    // 3. 按页面方向（纵向/横向）把连续任务分组，保持原始顺序
    const groups = [];
    for (const task of tasks) {
      const isLandscape = LANDSCAPE_TEMPLATES.has(task.template);
      if (groups.length === 0 || groups[groups.length - 1].isLandscape !== isLandscape) {
        groups.push({ isLandscape, tasks: [task] });
      } else {
        groups[groups.length - 1].tasks.push(task);
      }
    }

    // 4. 启动 Puppeteer 生成 PDF（优先使用系统 Chromium）
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

    // 为每组任务分别生成 PDF（同组同方向）
    const buffers = [];
    for (const group of groups) {
      const buffer = await generatePDFBuffer(browser, records, group.tasks, fns, group.isLandscape, cssCode);
      buffers.push(buffer);
    }

    await browser.close();
    browser = null;

    // 5. 如果只有一组直接返回，否则用 pdf-lib 合并，保持原始顺序
    let pdfBuffer;
    if (buffers.length === 1) {
      pdfBuffer = buffers[0];
    } else {
      pdfBuffer = await mergePDFs(buffers);
    }

    // 5. 记录打印日志（失败不影响返回PDF）
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
      await pool.execute(
        'INSERT INTO print_logs (username, querydata, selected_pici, templates, ip_address) VALUES (?, ?, ?, ?, ?)',
        [
          req.session.username,
          querydata,
          JSON.stringify(selectedPici),
          JSON.stringify(tasks),
          clientIp
        ]
      );
    } catch (logErr) {
      console.error('打印日志记录失败:', logErr.message);
    }

    // 6. 返回 PDF（inline 让浏览器直接预览）
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

/**
 * POST /api/print/training-summary
 * 生成指定用户的培训记录个人汇总 PDF
 *
 * Body: { username: '工号' }
 */
app.post('/api/print/training-summary', requirePermission('training_records'), async (req, res) => {
  const { username } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: '缺少用户名 username' });
  }

  let browser;
  try {
    // 1. 查询用户信息（已删除用户则取 username，其余字段留空）
    const [userRows] = await pool.execute(
      'SELECT username, chinese_name, department, position, hire_date FROM users WHERE username = ?',
      [username]
    );
    const user = userRows[0] || { username };

    // 2. 查询该用户的全部培训记录（按时间正序，PDF 中从早到晚排列）
    const [recordRows] = await pool.execute(
      `SELECT training_date, training_content, training_hours, training_form,
              assessment_method, assessment_result, trainer
       FROM training_records
       WHERE username = ?
       ORDER BY training_date ASC, id ASC`,
      [username]
    );

    // 3. 加载模板
    const { jsCode, cssCode } = await loadTemplates();
    const fns = getRenderFunctions(jsCode);
    if (!fns.renderUserTrainingSummary) {
      return res.status(500).json({ error: '未找到用户培训记录汇总模板 renderUserTrainingSummary' });
    }

    // 4. 生成 HTML 并转为 PDF
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

    // 5. 返回 PDF
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

/**
 * GET /api/print-logs
 * 查询打印日志
 * - 普通用户只能查看自己的日志
 * - admin 可以查看所有人的日志
 */
app.get('/api/print-logs', requirePermission('logs'), async (req, res) => {
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

/**
 * GET /api/print-logs/export
 * 导出打印日志为 CSV
 */
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

app.get('/api/print-logs/export', requirePermission('logs'), async (req, res) => {
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

    // CSV 表头
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

      const fields = [
        time,
        row.username || '',
        row.querydata || '',
        piciStr,
        templatesStr,
        row.ip_address || ''
      ];
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

/**
 * GET /api/operation-logs
 * 查询管理操作日志（仅管理员）
 */
app.get('/api/operation-logs', requirePermission('operation_logs'), async (req, res) => {
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

/**
 * GET /api/operation-logs/export
 * 导出操作日志为 CSV
 */
app.get('/api/operation-logs/export', requirePermission('operation_logs'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT username, action, target_type, target_id, detail, ip_address, created_at FROM operation_logs ORDER BY created_at DESC'
    );

    // CSV 表头
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

/**
 * GET /api/backups
 * 查询数据库备份记录
 */
app.get('/api/backups', requirePermission('backup_management'), async (req, res) => {
  try {
    const rows = await listBackups(50);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('查询备份记录失败:', err);
    res.status(500).json({ error: '查询备份记录失败' });
  }
});

/**
 * POST /api/backups/run
 * 手动触发数据库全量备份
 */
app.post('/api/backups/run', requirePermission('backup_management'), async (req, res) => {
  const username = req.session.username;

  // 先返回启动成功，备份在后台异步执行
  res.json({ success: true, message: '备份任务已启动，请稍后刷新列表查看结果。' });

  try {
    await runBackup(username);
  } catch (err) {
    // 错误已在 backup-service 内部记录并发送邮件
    console.error('手动备份执行失败:', err);
  }
});

/**
 * GET /api/instrument-meter
 * 查询 MIC 数据库中指定到期日期之前的仪器/仪表数据
 */
app.get('/api/instrument-meter', requirePermission('instrument_meter'), async (req, res) => {
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

/**
 * GET /api/instrument-meter/export
 * 导出仪器/仪表到期查询结果（CSV，带 UTF-8 BOM）
 */
app.get('/api/instrument-meter/export', requirePermission('instrument_meter'), async (req, res) => {
  const { expireDate } = req.query;
  if (!expireDate || !/^\d{4}-\d{2}-\d{2}$/.test(expireDate)) {
    return res.status(400).json({ error: '缺少或无效的到期日期，格式应为 YYYY-MM-DD' });
  }
  try {
    const rows = await queryInstruments(expireDate);
    if (rows.length === 0) {
      return res.status(404).json({ error: '没有可导出的数据' });
    }

    const headers = Object.keys(rows[0]);
    const csvRows = rows.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...csvRows].join('\n');

    const filename = `instrument-meter-${expireDate}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error('导出仪器/仪表数据失败:', err);
    res.status(500).json({ error: '导出失败: ' + err.message });
  }
});

/**
 * POST /api/search
 * Body: { querydata: '单据编号' }
 *
 * 安全设计：前端不再直接调用 Dify，而是通过本后端查询 MSSQL。
 * 数据库连接信息只存在于服务端，前端看不到、改不了。
 */
app.post('/api/search', requirePermission('print'), async (req, res) => {
  const { querydata } = req.body;
  if (!querydata || typeof querydata !== 'string') {
    return res.status(400).json({ error: '缺少查询条件 querydata' });
  }

  try {
    const records = await fetchMssqlData(querydata);
    res.json({ success: true, data: records });
  } catch (err) {
    console.error('查询失败:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * 记录管理员操作日志
 */
async function logOperation(req, action, targetType, targetId, detail) {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
    await pool.execute(
      'INSERT INTO operation_logs (username, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [
        req.session.username,
        action,
        targetType || null,
        targetId != null ? String(targetId) : null,
        detail || null,
        clientIp
      ]
    );
  } catch (err) {
    console.error('操作日志记录失败:', err.message);
  }
}

/**
 * ========== 模板版本管理 API（仅管理员） ==========
 */

// 查询所有模板（含当前生效版本信息）
app.get('/api/templates', requirePermission('template_admin'), async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT t.id, t.template_key, t.render_function_name, t.name, t.description,
             t.sort_order, t.is_active, t.current_version_id,
             v.version, v.reason, v.remarks, v.created_by, v.created_at AS version_created_at
      FROM templates t
      LEFT JOIN template_versions v ON t.current_version_id = v.id
      ORDER BY t.sort_order ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('查询模板列表失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// 查询单个模板及其所有版本
app.get('/api/templates/:id', requirePermission('template_admin'), async (req, res) => {
  const templateId = parseInt(req.params.id, 10);
  if (!templateId) {
    return res.status(400).json({ error: '缺少模板ID' });
  }

  try {
    const [templates] = await pool.execute(
      'SELECT * FROM templates WHERE id = ?',
      [templateId]
    );
    if (templates.length === 0) {
      return res.status(404).json({ error: '模板不存在' });
    }

    const [versions] = await pool.execute(
      'SELECT id, version, is_active, reason, remarks, created_by, created_at, updated_at FROM template_versions WHERE template_id = ? ORDER BY created_at DESC',
      [templateId]
    );

    res.json({ success: true, data: { template: templates[0], versions } });
  } catch (err) {
    console.error('查询模板详情失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// 新增/升级模板版本
app.post('/api/templates/:id/versions', requirePermission('template_admin'), async (req, res) => {
  const templateId = parseInt(req.params.id, 10);
  const { version, js_code, reason, remarks, activate } = req.body;

  if (!templateId) {
    return res.status(400).json({ error: '缺少模板ID' });
  }
  if (!version || typeof version !== 'string') {
    return res.status(400).json({ error: '缺少版本号 version' });
  }
  if (!js_code || typeof js_code !== 'string') {
    return res.status(400).json({ error: '缺少 JS 代码 js_code' });
  }

  // 基本语法校验：尝试构造函数
  try {
    new Function(js_code);
  } catch (syntaxErr) {
    return res.status(400).json({ error: 'JS 代码语法错误：' + syntaxErr.message });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [templates] = await connection.execute(
      'SELECT id, render_function_name FROM templates WHERE id = ?',
      [templateId]
    );
    if (templates.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '模板不存在' });
    }

    // 校验 JS 代码中是否定义了正确的渲染函数
    const expectedFunc = templates[0].render_function_name;
    const funcRegex = new RegExp(`function\\s+${expectedFunc}\\s*\\(`);
    if (!funcRegex.test(js_code)) {
      await connection.rollback();
      return res.status(400).json({ error: `JS 代码中未找到渲染函数 ${expectedFunc}` });
    }

    const [result] = await connection.execute(
      'INSERT INTO template_versions (template_id, version, js_code, reason, remarks, is_active, created_by) VALUES (?, ?, ?, ?, ?, 0, ?)',
      [templateId, version.trim(), js_code, reason || '', remarks || '', req.session.username]
    );
    const versionId = result.insertId;

    // 如果请求时指定了 activate=true，则直接激活该版本
    if (activate === true) {
      await connection.execute(
        'UPDATE template_versions SET is_active = 0 WHERE template_id = ?',
        [templateId]
      );
      await connection.execute(
        'UPDATE template_versions SET is_active = 1 WHERE id = ?',
        [versionId]
      );
      await connection.execute(
        'UPDATE templates SET current_version_id = ? WHERE id = ?',
        [versionId, templateId]
      );
    }

    await connection.commit();

    // 记录操作日志（不影响返回结果）
    await logOperation(
      req,
      activate === true ? '保存并激活模板版本' : '保存模板版本',
      'template',
      templateId,
      `版本号: ${version.trim()}, 修改原因: ${reason || '-'}, 备注: ${remarks || '-'}, 立即激活: ${activate === true}`
    );

    res.json({
      success: true,
      message: activate === true ? '版本已创建并激活' : '版本已创建',
      versionId: versionId,
      activated: activate === true
    });
  } catch (err) {
    await connection.rollback();
    console.error('创建模板版本失败:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该版本号已存在' });
    }
    res.status(500).json({ error: '创建失败' });
  } finally {
    connection.release();
  }
});

// 激活指定版本（同时失效该模板的其他版本）
app.put('/api/templates/:id/versions/:versionId/activate', requirePermission('template_admin'), async (req, res) => {
  const templateId = parseInt(req.params.id, 10);
  const versionId = parseInt(req.params.versionId, 10);

  if (!templateId || !versionId) {
    return res.status(400).json({ error: '缺少模板ID或版本ID' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [versions] = await connection.execute(
      'SELECT id FROM template_versions WHERE id = ? AND template_id = ?',
      [versionId, templateId]
    );
    if (versions.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: '版本不存在' });
    }

    await connection.execute(
      'UPDATE template_versions SET is_active = 0 WHERE template_id = ?',
      [templateId]
    );
    await connection.execute(
      'UPDATE template_versions SET is_active = 1 WHERE id = ?',
      [versionId]
    );
    await connection.execute(
      'UPDATE templates SET current_version_id = ? WHERE id = ?',
      [versionId, templateId]
    );

    await connection.commit();

    await logOperation(req, '激活模板版本', 'template', templateId, `版本ID: ${versionId}`);

    res.json({ success: true, message: '版本已激活' });
  } catch (err) {
    await connection.rollback();
    console.error('激活模板版本失败:', err);
    res.status(500).json({ error: '激活失败' });
  } finally {
    connection.release();
  }
});

// 查询某个版本的完整 JS 代码
app.get('/api/templates/:id/versions/:versionId/code', requirePermission('template_admin'), async (req, res) => {
  const templateId = parseInt(req.params.id, 10);
  const versionId = parseInt(req.params.versionId, 10);

  if (!templateId || !versionId) {
    return res.status(400).json({ error: '缺少模板ID或版本ID' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT v.js_code, t.render_function_name FROM template_versions v JOIN templates t ON v.template_id = t.id WHERE v.id = ? AND v.template_id = ?',
      [versionId, templateId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '版本不存在' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('查询版本代码失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// 样本数据，用于模板预览
const PREVIEW_SAMPLE_DATA = {
  mingcheng: '示例产品名称',
  guige: '10ml',
  xinghao: 'X-01',
  peifang: 'P-100',
  pici: '20260601A',
  beizhu: '预览用示例数据'
};

/**
 * 渲染单个模板为预览 HTML
 */
function renderTemplatePreview(jsCode, renderFunctionName, cssCode) {
  const sandbox = new Function(`
    const module = { exports: {} };
    ${jsCode}
    return typeof ${renderFunctionName} !== 'undefined' ? ${renderFunctionName} : null;
  `);
  const renderFn = sandbox();
  if (!renderFn) {
    throw new Error('未找到渲染函数：' + renderFunctionName);
  }
  const bodyHTML = renderFn(PREVIEW_SAMPLE_DATA, 1);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<base href="${IMAGE_BASE_URL}">
<title>模板预览</title>
<style>
${cssCode}
</style>
</head>
<body>
<div id="print-container">
${bodyHTML}
</div>
</body>
</html>`;
}

// 预览指定版本的渲染效果
app.get('/api/templates/:id/versions/:versionId/preview', requirePermission('template_admin'), async (req, res) => {
  const templateId = parseInt(req.params.id, 10);
  const versionId = parseInt(req.params.versionId, 10);

  if (!templateId || !versionId) {
    return res.status(400).json({ error: '缺少模板ID或版本ID' });
  }

  try {
    const [versionRows] = await pool.execute(
      'SELECT v.js_code, t.render_function_name FROM template_versions v JOIN templates t ON v.template_id = t.id WHERE v.id = ? AND v.template_id = ?',
      [versionId, templateId]
    );
    if (versionRows.length === 0) {
      return res.status(404).json({ error: '版本不存在' });
    }

    const [cssRows] = await pool.execute(
      'SELECT css_content FROM template_css WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    );
    if (cssRows.length === 0) {
      return res.status(404).json({ error: '未找到全局 CSS' });
    }

    const html = renderTemplatePreview(
      versionRows[0].js_code,
      versionRows[0].render_function_name,
      cssRows[0].css_content
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('模板预览失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// 预览临时 JS 代码（升级版本时查看修改效果）
app.post('/api/templates/:id/preview-code', requirePermission('template_admin'), async (req, res) => {
  const templateId = parseInt(req.params.id, 10);
  const { js_code } = req.body;

  if (!templateId) {
    return res.status(400).json({ error: '缺少模板ID' });
  }
  if (!js_code || typeof js_code !== 'string') {
    return res.status(400).json({ error: '缺少 JS 代码' });
  }

  // 基本语法校验
  try {
    new Function(js_code);
  } catch (syntaxErr) {
    return res.status(400).json({ error: 'JS 代码语法错误：' + syntaxErr.message });
  }

  try {
    const [templates] = await pool.execute(
      'SELECT render_function_name FROM templates WHERE id = ?',
      [templateId]
    );
    if (templates.length === 0) {
      return res.status(404).json({ error: '模板不存在' });
    }

    // 校验代码中是否包含正确的渲染函数
    const expectedFunc = templates[0].render_function_name;
    const funcRegex = new RegExp(`function\\s+${expectedFunc}\\s*\\(`);
    if (!funcRegex.test(js_code)) {
      return res.status(400).json({ error: `JS 代码中未找到渲染函数 ${expectedFunc}` });
    }

    const [cssRows] = await pool.execute(
      'SELECT css_content FROM template_css WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    );
    if (cssRows.length === 0) {
      return res.status(404).json({ error: '未找到全局 CSS' });
    }

    const html = renderTemplatePreview(js_code, expectedFunc, cssRows[0].css_content);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('临时预览失败:', err);
    res.status(500).json({ error: err.message });
  }
});

// 查询全局 CSS
app.get('/api/css', requirePermission('template_admin'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, css_content, is_active, updated_at FROM template_css WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '未找到全局 CSS' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('查询 CSS 失败:', err);
    res.status(500).json({ error: '查询失败' });
  }
});

// 更新全局 CSS
app.put('/api/css', requirePermission('template_admin'), async (req, res) => {
  const { css_content } = req.body;
  if (typeof css_content !== 'string') {
    return res.status(400).json({ error: '缺少 CSS 内容' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id FROM template_css WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '未找到全局 CSS' });
    }

    await pool.execute(
      'UPDATE template_css SET css_content = ?, updated_at = NOW() WHERE id = ?',
      [css_content, rows[0].id]
    );

    await logOperation(req, '更新全局CSS', 'css', rows[0].id, `CSS 长度: ${css_content.length}`);

    res.json({ success: true, message: 'CSS 已更新' });
  } catch (err) {
    console.error('更新 CSS 失败:', err);
    res.status(500).json({ error: '更新失败' });
  }
});

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pdf-print-server' });
});

// ========== OCR 纸质表格识别代理 ==========
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://127.0.0.1:5000/recognize';
const ocrUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 }
});

/**
 * POST /api/ocr/recognize
 * 前端上传手机拍摄的纸质表格照片，Node 转发给本地 Python OCR 服务。
 * Form 字段：
 *   image: 图片文件（必填）
 *   config: 字段配置 JSON 文件路径（如 ocr-service/fields.json）
 *   expected_aspect: 表格宽/高比，可选
 *   confidence_threshold: 置信度阈值，默认 0.65
 *   debug: true 时保存矫正后的图片到 ocr-service/debug
 */
app.post('/api/ocr/recognize', requireAuth, ocrUpload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '缺少图片文件 image' });
  }

  try {
    const form = new FormData();
    form.append('image', req.file.buffer, req.file.originalname);

    if (req.body.config) form.append('config', req.body.config);
    if (req.body.expected_aspect) form.append('expected_aspect', req.body.expected_aspect);
    if (req.body.confidence_threshold) form.append('confidence_threshold', req.body.confidence_threshold);
    if (req.body.debug) form.append('debug', req.body.debug);

    const response = await axios.post(OCR_SERVICE_URL, form, {
      headers: form.getHeaders(),
      timeout: 120000,
      maxBodyLength: 20 * 1024 * 1024,
      maxContentLength: 20 * 1024 * 1024
    });

    res.json(response.data);
  } catch (err) {
    console.error('OCR 服务调用失败:', err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    res.status(500).json({ error: 'OCR 服务调用失败: ' + err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`PDF 打印服务已启动: http://localhost:${PORT}`);
  console.log(`接口地址: POST http://localhost:${PORT}/api/print`);

  // 启动时测试 MariaDB 连接
  const dbOk = await testConnection();
  if (!dbOk) {
    console.warn('警告：数据库连接失败，登录功能将不可用，请检查 MariaDB 是否已启动及配置是否正确');
  }

  // 启动时测试 MSSQL 连接
  const mssqlOk = await testMssqlConnection();
  if (!mssqlOk) {
    console.warn('警告：MSSQL 连接失败，数据查询功能将不可用，请检查 ERP1 数据库配置及网络');
  }

  // 启动营业执照到期邮件提醒任务
  startDailyCheck();

  // 启动数据库每日凌晨 2 点自动备份任务
  startDailyBackup();
});
