/**
 * 会话与认证中间件（零依赖，无需额外 npm 包）
 *
 * 通过工厂函数注入 pool，返回所有认证相关的中间件和工具方法。
 */
const crypto = require('crypto');

module.exports = function createAuthMiddleware(pool) {
  const sessions = new Map(); // sid -> { username, createdAt }

  const SESSION_COOKIE_NAME = 'sid';
  const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 小时

  // ========== 用户功能权限（feature_key 级别 ACL） ==========
  const PERMISSION_FEATURES = [
    'print', 'logs', 'dashboard', 'template_admin', 'operation_logs', 'training_records',
    'supplier_qualifications', 'supplier_qualifications_edit',
    'workflow_design', 'workflow_view_task', 'workflow_transfer_task', 'workflow_recall_task',
    'ocr_recognize', 'ocr_template_design', 'backup_management', 'instrument_meter',
    'coa_report'
  ];

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

  /**
   * 获取当前会话的租户上下文（多租户隔离用）
   *
   * 返回对象 { isSuperAdmin, companyId }：
   *   - isSuperAdmin=true  → 集团超管，跨租户访问，不按 company_id 过滤
   *   - isSuperAdmin=false && companyId 非 null → 子公司用户，所有 workflow 查询必须按 company_id 过滤
   *
   * 安全设计：登录时已校验"非超管必须有 company_id"，这里不可能出现"非超管 + companyId=null"。
   * 但仍保留兜底：若 session 损坏导致此状态，companyId 返回 null，引擎层应拒绝查询。
   */
  function getTenantContextFromReq(req) {
    if (!req.session) return { isSuperAdmin: false, companyId: null };
    return {
      isSuperAdmin: req.session.isSuperAdmin === true,
      companyId: req.session.companyId == null ? null : Number(req.session.companyId)
    };
  }

  /**
   * 创建新会话并设置 cookie（供 auth.routes 调用）
   * isSuperAdmin 默认 false（普通子公司用户）
   */
  function createSession(res, username, companyId = null, isSuperAdmin = false) {
    const sid = generateSessionId();
    sessions.set(sid, {
      username,
      companyId: companyId == null ? null : Number(companyId),
      isSuperAdmin: isSuperAdmin === true,
      createdAt: Date.now()
    });
    setSessionCookie(res, sid);
    return sid;
  }

  /**
   * 销毁会话（供 auth.routes 调用）
   */
  function destroySession(req, res) {
    const cookies = parseCookie(req);
    const sid = cookies[SESSION_COOKIE_NAME];
    let username = null;
    if (sid) {
      const session = sessions.get(sid);
      if (session) username = session.username;
      sessions.delete(sid);
    }
    clearSessionCookie(res);
    return username;
  }

  return {
    // 常量
    PERMISSION_FEATURES,
    // Cookie / 会话
    parseCookie,
    getSession,
    setSessionCookie,
    clearSessionCookie,
    createSession,
    destroySession,
    // 中间件
    requireAuth,
    requireAuthPage,
    requireAdmin,
    requireAdminPage,
    requirePermission,
    requirePermissionPage,
    // 工具
    checkPermission,
    getUsernameFromReq,
    getTenantContextFromReq,
  };
};
