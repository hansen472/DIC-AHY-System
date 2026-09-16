/**
 * 组织管理路由：公司、部门、用户 CRUD + 权限管理 + 账户状态
 */
const express = require('express');
const { hashPassword, validatePassword } = require('../services/auth.service');

module.exports = function setupOrganizationRoutes(deps) {
  const { pool, auth, logOperation } = deps;
  const router = express.Router();
  const { requireAdmin, requireAuth, requirePermission, PERMISSION_FEATURES } = auth;

  // ========== 公司管理 ==========

  // API：查询公司列表（仅管理员，支持按公司名称搜索）
  router.get('/api/companies', requireAdmin, async (req, res) => {
    const { keyword } = req.query;
    try {
      let sql = 'SELECT id, company_name, company_address, cost_center, created_at, updated_at FROM companies';
      const params = [];
      if (keyword && String(keyword).trim()) {
        sql += ' WHERE company_name LIKE ?';
        params.push(`%${String(keyword).trim()}%`);
      }
      sql += ' ORDER BY id ASC';
      const [rows] = await pool.execute(sql, params);
      res.json({ success: true, data: rows });
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.status(500).json({ error: '公司管理功能未初始化，请先执行数据库迁移脚本 sql/companies.sql' });
      }
      console.error('查询公司列表失败:', err.message);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：新增公司（仅管理员）
  router.post('/api/companies', requireAdmin, async (req, res) => {
    const { company_name, company_address, cost_center } = req.body;
    if (!company_name || typeof company_name !== 'string' || !company_name.trim()) {
      return res.status(400).json({ error: '请输入公司名称' });
    }
    try {
      const [result] = await pool.execute(
        'INSERT INTO companies (company_name, company_address, cost_center) VALUES (?, ?, ?)',
        [company_name.trim(), (company_address || '').trim(), (cost_center || '').trim()]
      );
      res.json({ success: true, message: '公司已添加', id: result.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '该公司名称已存在' });
      }
      console.error('新增公司失败:', err.message);
      res.status(500).json({ error: '新增失败' });
    }
  });

  // API：修改公司（仅管理员）
  router.put('/api/companies/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: '无效的公司ID' });
    }
    const { company_name, company_address, cost_center } = req.body;
    if (!company_name || typeof company_name !== 'string' || !company_name.trim()) {
      return res.status(400).json({ error: '请输入公司名称' });
    }
    try {
      const [result] = await pool.execute(
        'UPDATE companies SET company_name = ?, company_address = ?, cost_center = ? WHERE id = ?',
        [company_name.trim(), (company_address || '').trim(), (cost_center || '').trim(), id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '公司不存在' });
      }
      res.json({ success: true, message: '公司信息已更新' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '该公司名称已存在' });
      }
      console.error('修改公司失败:', err.message);
      res.status(500).json({ error: '修改失败' });
    }
  });

  // API：删除公司（仅管理员）
  router.delete('/api/companies/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: '无效的公司ID' });
    }
    try {
      const [result] = await pool.execute('DELETE FROM companies WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '公司不存在' });
      }
      res.json({ success: true, message: '公司已删除' });
    } catch (err) {
      console.error('删除公司失败:', err.message);
      res.status(500).json({ error: '删除失败' });
    }
  });

  // ========== 部门管理 ==========

  // API：列出所有部门（仅管理员）
  router.get('/api/departments', requireAdmin, async (req, res) => {
    const { keyword } = req.query;
    try {
      let sql = `SELECT d.id, d.department_name, d.department_address, d.cost_center, d.department_manager,
                      d.manager_username, u.chinese_name AS manager_chinese_name,
                      d.company_id, c.company_name, d.created_at, d.updated_at
               FROM departments d
               LEFT JOIN companies c ON d.company_id = c.id
               LEFT JOIN users u ON d.manager_username = u.username`;
      const params = [];
      if (keyword && String(keyword).trim()) {
        sql += ' WHERE d.department_name LIKE ?';
        params.push(`%${String(keyword).trim()}%`);
      }
      sql += ' ORDER BY d.id ASC';
      const [rows] = await pool.execute(sql, params);
      res.json({ success: true, data: rows });
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.status(500).json({ error: '部门管理功能未初始化，请先执行数据库迁移脚本 sql/departments.sql' });
      }
      console.error('查询部门列表失败:', err.message);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：新增部门（仅管理员）
  router.post('/api/departments', requireAdmin, async (req, res) => {
    const { department_name, department_address, cost_center, department_manager, manager_username, company_id } = req.body;
    if (!department_name || typeof department_name !== 'string' || !department_name.trim()) {
      return res.status(400).json({ error: '请输入部门名称' });
    }
    try {
      const [result] = await pool.execute(
        'INSERT INTO departments (department_name, department_address, cost_center, department_manager, manager_username, company_id) VALUES (?, ?, ?, ?, ?, ?)',
        [department_name.trim(), (department_address || '').trim(), (cost_center || '').trim(), (department_manager || '').trim(), manager_username || null, company_id ? parseInt(company_id, 10) : null]
      );
      res.json({ success: true, message: '部门已添加', id: result.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '该部门名称已存在' });
      }
      console.error('新增部门失败:', err.message);
      res.status(500).json({ error: '新增失败' });
    }
  });

  // API：修改部门（仅管理员）
  router.put('/api/departments/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: '无效的部门ID' });
    }
    const { department_name, department_address, cost_center, department_manager, manager_username, company_id } = req.body;
    if (!department_name || typeof department_name !== 'string' || !department_name.trim()) {
      return res.status(400).json({ error: '请输入部门名称' });
    }
    try {
      const [result] = await pool.execute(
        'UPDATE departments SET department_name = ?, department_address = ?, cost_center = ?, department_manager = ?, manager_username = ?, company_id = ? WHERE id = ?',
        [department_name.trim(), (department_address || '').trim(), (cost_center || '').trim(), (department_manager || '').trim(), manager_username || null, company_id ? parseInt(company_id, 10) : null, id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '部门不存在' });
      }
      res.json({ success: true, message: '部门信息已更新' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '该部门名称已存在' });
      }
      console.error('修改部门失败:', err.message);
      res.status(500).json({ error: '修改失败' });
    }
  });

  // API：删除部门（仅管理员）
  router.delete('/api/departments/:id', requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: '无效的部门ID' });
    }
    try {
      const [result] = await pool.execute('DELETE FROM departments WHERE id = ?', [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '部门不存在' });
      }
      res.json({ success: true, message: '部门已删除' });
    } catch (err) {
      console.error('删除部门失败:', err.message);
      res.status(500).json({ error: '删除失败' });
    }
  });

  // API：获取部门简易列表（所有已登录用户可用，用于下拉选择）
  router.get('/api/departments/simple-list', requireAuth, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, department_name FROM departments ORDER BY department_name ASC`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('获取部门简易列表失败:', err.message);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // ========== 用户管理 ==========

  // API：列出所有用户（仅管理员）
  router.get('/api/users', requireAdmin, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.username, u.status, u.last_login, u.locked_until, u.password_changed_at,
              u.chinese_name, u.department, u.direct_manager, u.email, u.position, u.hire_date,
              u.company_id, c.company_name,
              u.department_id, d.department_name AS dept_name,
              u.direct_manager_username, dm.chinese_name AS direct_manager_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN users dm ON u.direct_manager_username = dm.username
       ORDER BY u.id ASC`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        console.error('[账户锁定] locked_until 列不存在，请执行: mysql -u root -p pdf_print_db < sql/login-attempts.sql');
        return res.status(500).json({ error: '账户锁定功能未初始化，请先执行数据库迁移脚本 sql/login-attempts.sql' });
      }
      console.error('查询用户列表失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：获取用户简易列表（所有已登录用户可用，排除 admin，用于流程设计器审批人选择）
  router.get('/api/users/simple-list', requireAuth, async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT username, chinese_name, department, status
       FROM users
       WHERE username != 'admin'
       ORDER BY username ASC`
      );
      res.json({ success: true, users: rows });
    } catch (err) {
      console.error('获取用户简易列表失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：新增用户（仅管理员）
  router.post('/api/users', requireAdmin, async (req, res) => {
    const { username, password, chinese_name, department, department_id, direct_manager, direct_manager_username, email, position, hire_date, company_id } = req.body;

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
    const pwdErr = validatePassword(password, trimmedUsername);
    if (pwdErr) {
      return res.status(400).json({ error: pwdErr });
    }

    // 简单校验邮箱格式（如有填写）
    const trimmedEmail = email ? String(email).trim() : '';
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Email 格式不正确' });
    }

    try {
      const [result] = await pool.execute(
        `INSERT INTO users
       (username, password_hash, status, password_changed_at, chinese_name, department, department_id, direct_manager, direct_manager_username, email, position, hire_date, company_id)
       VALUES (?, ?, 1, NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trimmedUsername,
          hashPassword(password),
          chinese_name ? String(chinese_name).trim() : null,
          department ? String(department).trim() : null,
          department_id ? parseInt(department_id, 10) : null,
          direct_manager ? String(direct_manager).trim() : null,
          direct_manager_username || null,
          trimmedEmail || null,
          position ? String(position).trim() : null,
          hire_date || null,
          company_id ? parseInt(company_id, 10) : null
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
  router.put('/api/users/:username/password', requireAdmin, async (req, res) => {
    const username = req.params.username;
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: '缺少新密码' });
    }
    const pwdErr = validatePassword(password, username);
    if (pwdErr) {
      return res.status(400).json({ error: pwdErr });
    }

    try {
      const [result] = await pool.execute(
        'UPDATE users SET password_hash = ?, password_changed_at = NOW() WHERE username = ?',
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

  // API：解锁用户账户（仅管理员）
  router.put('/api/users/:username/unlock', requireAdmin, async (req, res) => {
    const username = req.params.username;

    try {
      const [result] = await pool.execute(
        'UPDATE users SET locked_until = NULL WHERE username = ?',
        [username]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }

      // 清除失败尝试记录
      await pool.execute(
        'DELETE FROM login_attempts WHERE username = ?',
        [username]
      );

      // 解锁账户时同时重置密码修改时间，避免因密码过期再次被锁
      await pool.execute(
        'UPDATE users SET password_changed_at = NOW() WHERE username = ?',
        [username]
      );

      await logOperation(req, '解锁用户账户', 'user', username, `用户名: ${username}`);

      res.json({ success: true, message: '账户已解锁' });
    } catch (err) {
      console.error('解锁用户失败:', err);
      res.status(500).json({ error: '解锁失败' });
    }
  });

  // API：更新用户状态（禁用/启用）（仅管理员）
  router.put('/api/users/:username/status', requireAdmin, async (req, res) => {
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
  router.get('/api/users/:username/permissions', requireAdmin, async (req, res) => {
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
  router.put('/api/users/:username/permissions', requireAdmin, async (req, res) => {
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
  router.get('/api/users/by-department', requirePermission('training_records'), async (req, res) => {
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
  router.get('/api/users/:username', requireAdmin, async (req, res) => {
    const username = req.params.username;
    try {
      const [rows] = await pool.execute(
        `SELECT u.id, u.username, u.status, u.last_login, u.locked_until, u.password_changed_at,
              u.chinese_name, u.department, u.direct_manager, u.email, u.position, u.hire_date,
              u.company_id, c.company_name,
              u.department_id, d.department_name AS dept_name,
              u.direct_manager_username, dm.chinese_name AS direct_manager_name
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id
       LEFT JOIN departments d ON u.department_id = d.id
       LEFT JOIN users dm ON u.direct_manager_username = dm.username
       WHERE u.username = ?`,
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
  router.put('/api/users/:username', requireAdmin, async (req, res) => {
    const username = req.params.username;
    const { chinese_name, department, department_id, direct_manager, direct_manager_username, email, position, hire_date, company_id } = req.body;

    const trimmedEmail = email ? String(email).trim() : '';
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Email 格式不正确' });
    }

    try {
      const [result] = await pool.execute(
        `UPDATE users SET
         chinese_name = ?,
         department = ?,
         department_id = ?,
         direct_manager = ?,
         direct_manager_username = ?,
         email = ?,
         position = ?,
         hire_date = ?,
         company_id = ?
       WHERE username = ?`,
        [
          chinese_name ? String(chinese_name).trim() : null,
          department ? String(department).trim() : null,
          department_id ? parseInt(department_id, 10) : null,
          direct_manager ? String(direct_manager).trim() : null,
          direct_manager_username || null,
          trimmedEmail || null,
          position ? String(position).trim() : null,
          hire_date || null,
          company_id ? parseInt(company_id, 10) : null,
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

  return router;
};
