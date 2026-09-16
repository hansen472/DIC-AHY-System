/**
 * 认证路由：登录、登出、会话、权限查询、密码修改
 */
const express = require('express');
const {
  LOGIN_MAX_FAILED_ATTEMPTS,
  PASSWORD_MAX_DAYS,
  PASSWORD_GRACE_DAYS,
  hashPassword,
} = require('../services/auth.service');

module.exports = function setupAuthRoutes(deps) {
  const { pool, auth } = deps;
  const router = express.Router();
  const { requireAuth, PERMISSION_FEATURES, checkPermission, createSession, destroySession, getSession } = auth;

  // POST /api/login
  router.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: '缺少用户名或密码' });
    }

    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';

    try {
      const [rows] = await pool.execute(
        'SELECT id, username, password_hash, status, locked_until, password_changed_at FROM users WHERE username = ?',
        [username]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }

      const user = rows[0];

      if (user.status !== 1) {
        return res.status(403).json({ error: '账号已被禁用' });
      }

      // 检查账户是否处于锁定状态
      if (user.locked_until) {
        const lockedUntil = new Date(user.locked_until);
        if (lockedUntil > new Date()) {
          const remainMin = Math.ceil((lockedUntil - new Date()) / 60000);
          return res.status(423).json({
            error: `账户已锁定，请在 ${remainMin} 分钟后再试`,
            locked: true,
            locked_until: user.locked_until
          });
        } else {
          await pool.execute('UPDATE users SET locked_until = NULL WHERE id = ?', [user.id]);
          await pool.execute('DELETE FROM login_attempts WHERE username = ?', [user.username]);
        }
      }

      if (hashPassword(password) !== user.password_hash) {
        await pool.execute(
          'INSERT INTO login_attempts (username, ip_address) VALUES (?, ?)',
          [user.username, clientIp]
        );

        const [attempts] = await pool.execute(
          'SELECT COUNT(*) AS cnt FROM login_attempts WHERE username = ? AND attempted_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)',
          [user.username]
        );
        const failedCount = attempts[0].cnt;
        const remaining = LOGIN_MAX_FAILED_ATTEMPTS - failedCount;

        if (remaining <= 0) {
          await pool.execute(
            'UPDATE users SET locked_until = DATE_ADD(NOW(), INTERVAL 30 MINUTE) WHERE id = ?',
            [user.id]
          );

          const [lockRows] = await pool.execute(
            'SELECT locked_until FROM users WHERE id = ?',
            [user.id]
          );
          const lockUntilStr = lockRows[0].locked_until;

          try {
            await pool.execute(
              'INSERT INTO operation_logs (username, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
              [user.username, '账户锁定', 'user', user.id, `24小时内密码错误累计${failedCount}次，账户已锁定30分钟`, clientIp]
            );
          } catch (logErr) {
            console.error('锁定日志记录失败:', logErr.message);
          }

          return res.status(423).json({
            error: '密码错误次数过多，账户已锁定 30 分钟',
            locked: true,
            locked_until: lockUntilStr
          });
        }

        return res.status(401).json({
          error: `用户名或密码错误（还可尝试 ${remaining} 次）`
        });
      }

      // 登录成功
      await pool.execute('DELETE FROM login_attempts WHERE username = ?', [user.username]);
      await pool.execute('UPDATE users SET last_login = NOW(), locked_until = NULL WHERE id = ?', [user.id]);

      createSession(res, user.username);

      try {
        await pool.execute(
          'INSERT INTO operation_logs (username, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
          [user.username, '用户登录', 'session', null, '登录成功', clientIp]
        );
      } catch (logErr) {
        console.error('登录日志记录失败:', logErr.message);
      }

      // 检查密码有效期
      let passwordExpiring = false;
      let passwordExpireDays = 0;
      if (user.password_changed_at) {
        const changedAt = new Date(user.password_changed_at.replace(' ', 'T'));
        const daysSinceChange = Math.floor((Date.now() - changedAt.getTime()) / (86400000));
        if (daysSinceChange > PASSWORD_MAX_DAYS + PASSWORD_GRACE_DAYS) {
          return res.status(403).json({
            error: '密码已过期超过宽限期，请修改密码后登录',
            passwordExpired: true
          });
        } else if (daysSinceChange > PASSWORD_MAX_DAYS) {
          passwordExpiring = true;
          passwordExpireDays = PASSWORD_MAX_DAYS + PASSWORD_GRACE_DAYS - daysSinceChange;
        }
      }

      res.json({
        success: true,
        message: '登录成功',
        passwordExpiring,
        passwordExpireDays
      });
    } catch (err) {
      console.error('登录查询失败:', err);
      res.status(500).json({ error: '服务器内部错误' });
    }
  });

  // POST /api/logout
  router.post('/api/logout', async (req, res) => {
    const username = destroySession(req, res);

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

  // GET /api/session
  router.get('/api/session', requireAuth, (req, res) => {
    res.json({ success: true, username: req.session.username });
  });

  // GET /api/my-permissions
  router.get('/api/my-permissions', requireAuth, async (req, res) => {
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

  return router;
};
