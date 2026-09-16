/**
 * 模板版本管理路由：templates CRUD、版本管理、CSS 管理、预览
 */
const express = require('express');
const { renderTemplatePreview } = require('../services/print.service');

module.exports = function setupTemplateRoutes(deps) {
  const { pool, auth, logOperation } = deps;
  const router = express.Router();
  const { requirePermission } = auth;

  // GET /api/templates — 查询所有模板（含当前生效版本信息）
  router.get('/api/templates', requirePermission('template_admin'), async (req, res) => {
    try {
      const [rows] = await pool.execute(`
        SELECT t.id, t.template_key, t.render_function_name, t.name, t.description,
               t.sort_order, t.is_active, t.current_version_id, t.css_id,
               c.name AS css_name,
               v.version, v.reason, v.remarks, v.created_by, v.created_at AS version_created_at
        FROM templates t
        LEFT JOIN template_versions v ON t.current_version_id = v.id
        LEFT JOIN template_css c ON t.css_id = c.id
        ORDER BY t.sort_order ASC
      `);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询模板列表失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // PUT /api/templates/:id/css — 设置模板使用的 CSS 样式
  router.put('/api/templates/:id/css', requirePermission('template_admin'), async (req, res) => {
    const templateId = parseInt(req.params.id, 10);
    const { css_id } = req.body;
    if (!templateId) return res.status(400).json({ error: '缺少模板 ID' });
    if (css_id != null && typeof css_id !== 'number') {
      return res.status(400).json({ error: 'css_id 必须为数字或 null' });
    }
    try {
      await pool.execute(
        'UPDATE templates SET css_id = ?, updated_at = NOW() WHERE id = ?',
        [css_id || null, templateId]
      );
      await logOperation(req, '设置模板CSS', 'template', templateId, `css_id: ${css_id || 'null'}`);
      res.json({ success: true, message: '已更新' });
    } catch (err) {
      console.error('设置模板 CSS 失败:', err);
      res.status(500).json({ error: '更新失败' });
    }
  });

  // GET /api/templates/:id — 查询单个模板及其所有版本
  router.get('/api/templates/:id', requirePermission('template_admin'), async (req, res) => {
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

  // POST /api/templates/:id/versions — 新增/升级模板版本
  router.post('/api/templates/:id/versions', requirePermission('template_admin'), async (req, res) => {
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

  // PUT /api/templates/:id/versions/:versionId/activate — 激活指定版本
  router.put('/api/templates/:id/versions/:versionId/activate', requirePermission('template_admin'), async (req, res) => {
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

  // GET /api/templates/:id/versions/:versionId/code — 查询某个版本的完整 JS 代码
  router.get('/api/templates/:id/versions/:versionId/code', requirePermission('template_admin'), async (req, res) => {
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

  // GET /api/templates/:id/versions/:versionId/preview — 预览指定版本的渲染效果
  router.get('/api/templates/:id/versions/:versionId/preview', requirePermission('template_admin'), async (req, res) => {
    const templateId = parseInt(req.params.id, 10);
    const versionId = parseInt(req.params.versionId, 10);

    if (!templateId || !versionId) {
      return res.status(400).json({ error: '缺少模板ID或版本ID' });
    }

    try {
      const [versionRows] = await pool.execute(
        'SELECT v.js_code, t.render_function_name, t.css_id FROM template_versions v JOIN templates t ON v.template_id = t.id WHERE v.id = ? AND v.template_id = ?',
        [versionId, templateId]
      );
      if (versionRows.length === 0) {
        return res.status(404).json({ error: '版本不存在' });
      }

      // 加载该模板指定的 CSS
      const cssId = versionRows[0].css_id;
      let cssContent = '';
      if (cssId) {
        const [cssRows] = await pool.execute(
          'SELECT css_content FROM template_css WHERE id = ?', [cssId]
        );
        if (cssRows.length > 0) cssContent = cssRows[0].css_content;
      }

      const html = renderTemplatePreview(
        versionRows[0].js_code,
        versionRows[0].render_function_name,
        cssContent
      );

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      console.error('模板预览失败:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/templates/:id/preview-code — 预览临时 JS 代码（升级版本时查看修改效果）
  router.post('/api/templates/:id/preview-code', requirePermission('template_admin'), async (req, res) => {
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
        'SELECT render_function_name, css_id FROM templates WHERE id = ?',
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

      // 加载该模板指定的 CSS
      const cssId = templates[0].css_id;
      let cssContent = '';
      if (cssId) {
        const [cssRows] = await pool.execute(
          'SELECT css_content FROM template_css WHERE id = ?', [cssId]
        );
        if (cssRows.length > 0) cssContent = cssRows[0].css_content;
      }

      const html = renderTemplatePreview(js_code, expectedFunc, cssContent);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch (err) {
      console.error('临时预览失败:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ========== CSS 管理 ==========

  // GET /api/css — 查询全局 CSS
  router.get('/api/css', requirePermission('template_admin'), async (req, res) => {
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

  // PUT /api/css — 更新全局 CSS
  router.put('/api/css', requirePermission('template_admin'), async (req, res) => {
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

  // GET /api/css/list — 查询所有 CSS 样式列表
  router.get('/api/css/list', requirePermission('template_admin'), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        'SELECT id, name, is_active, updated_at, LEFT(css_content, 200) AS css_preview FROM template_css ORDER BY id ASC'
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询 CSS 列表失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // GET /api/css/:id — 查询单个 CSS 样式详情
  router.get('/api/css/:id', requirePermission('template_admin'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少 ID' });
    try {
      const [rows] = await pool.execute(
        'SELECT id, name, css_content, is_active, updated_at FROM template_css WHERE id = ?',
        [id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'CSS 不存在' });
      res.json({ success: true, data: rows[0] });
    } catch (err) {
      console.error('查询 CSS 失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // PUT /api/css/:id — 更新指定 ID 的 CSS 样式
  router.put('/api/css/:id', requirePermission('template_admin'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { css_content, name, is_active } = req.body;
    if (!id) return res.status(400).json({ error: '缺少 ID' });
    try {
      const sets = [];
      const params = [];
      if (typeof css_content === 'string') { sets.push('css_content = ?'); params.push(css_content); }
      if (typeof name === 'string' && name.trim()) { sets.push('name = ?'); params.push(name.trim()); }
      if (typeof is_active === 'number') { sets.push('is_active = ?'); params.push(is_active ? 1 : 0); }
      sets.push('updated_at = NOW()');
      params.push(id);
      await pool.execute(`UPDATE template_css SET ${sets.join(', ')} WHERE id = ?`, params);
      await logOperation(req, '更新CSS样式', 'css', id, `更新字段: ${sets.join(', ')}`);
      res.json({ success: true, message: 'CSS 已更新' });
    } catch (err) {
      console.error('更新 CSS 失败:', err);
      res.status(500).json({ error: '更新失败' });
    }
  });

  // POST /api/css — 新建 CSS 样式
  router.post('/api/css', requirePermission('template_admin'), async (req, res) => {
    const { name, css_content } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ error: '缺少样式名称' });
    if (typeof css_content !== 'string') return res.status(400).json({ error: '缺少 CSS 内容' });
    try {
      const [result] = await pool.execute(
        'INSERT INTO template_css (name, css_content, is_active) VALUES (?, ?, 1)',
        [name.trim(), css_content]
      );
      await logOperation(req, '新建CSS样式', 'css', result.insertId, `名称: ${name.trim()}`);
      res.json({ success: true, id: result.insertId, message: 'CSS 已创建' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '样式名称已存在' });
      console.error('创建 CSS 失败:', err);
      res.status(500).json({ error: '创建失败' });
    }
  });

  // DELETE /api/css/:id — 删除 CSS 样式
  router.delete('/api/css/:id', requirePermission('template_admin'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少 ID' });
    try {
      const [rows] = await pool.execute('SELECT name FROM template_css WHERE id = ?', [id]);
      if (rows.length === 0) return res.status(404).json({ error: 'CSS 不存在' });
      await pool.execute('DELETE FROM template_css WHERE id = ?', [id]);
      await logOperation(req, '删除CSS样式', 'css', id, `名称: ${rows[0].name}`);
      res.json({ success: true, message: 'CSS 已删除' });
    } catch (err) {
      console.error('删除 CSS 失败:', err);
      res.status(500).json({ error: '删除失败' });
    }
  });

  return router;
};
