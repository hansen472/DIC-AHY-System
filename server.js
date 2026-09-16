/**
 * 后端服务入口
 *
 * 业务路由已全部拆分到 routes/ 目录，认证中间件在 middleware/，通用服务在 services/。
 * 本文件仅负责：初始化 Express、挂载中间件、注册路由、启动定时任务。
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, mssqlPool, testConnection, testMssqlConnection } = require('./db-config');
const { coaPool, testCoaConnection } = require('./db-coa-config');
const { micPool } = require('./db-mic-config');
const { startDailyCheck } = require('./email-notifier');
const { setupWorkflowRoutes } = require('./workflow-routes');
const { runBackup, listBackups, startDailyBackup } = require('./backup-service');
const { queryInstruments, queryByAssetCodes } = require('./instrument-meter-service');
const { startWeeklyCheck } = require('./instrument-meter-notifier');
const { startWeeklyPush } = require('./weekly-overdue-workorder-notifier');
const { startDailyPush: startDailyOverduePush } = require('./daily-overdue-workorder-notifier');
const { startDailyPush: startQcMaintenancePush } = require('./qc-maintenance-notifier');
const { startDailyPush: startUnprocessedRequestPush } = require('./unprocessed-request-notifier');
const { startPolling: startNewRepairPolling } = require('./new-repair-notifier');
const { startPolling: startNewIssuePolling } = require('./new-issue-notifier');
const { setupOcrRoutes } = require('./ocr-routes');

// ========== 服务工厂 ==========
const createAuthMiddleware = require('./middleware/auth.middleware');
const { createLogOperation, createLogSupplierOperation, createLogPush } = require('./services/log.service');

const app = express();
const PORT = process.env.PORT || 3456;

// ========== 全局中间件 ==========
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ========== 初始化核心服务 ==========
const auth = createAuthMiddleware(pool);
const logOperation = createLogOperation(pool, auth.getSession);
const logSupplierOperation = createLogSupplierOperation(pool);
const logPush = createLogPush(pool);

// ========== 审批流引擎（延迟获取） ==========
let workflowEngine = null;
function getWorkflowEngine() {
  return workflowEngine;
}

// ========== 依赖注入对象 ==========
const routeDps = {
  pool,
  mssqlPool,
  coaPool,
  micPool,
  auth,
  logOperation,
  logSupplierOperation,
  logPush,
  getWorkflowEngine,
  queryInstruments,
  queryByAssetCodes,
};

// ========== 挂载页面路由（HTML sendFile） ==========
app.use(require('./routes/pages.routes')(auth));

// ========== 挂载 API 路由 ==========
app.use(require('./routes/auth.routes')({ pool, auth }));
app.use(require('./routes/organization.routes')({ pool, auth, logOperation }));
app.use(require('./routes/training.routes')({ pool, auth, logOperation }));
app.use(require('./routes/supplier.routes')({ pool, auth, logOperation, logSupplierOperation }));
app.use(require('./routes/print.routes')({ pool, mssqlPool, auth }));
app.use(require('./routes/template.routes')({ pool, auth, logOperation }));
app.use(require('./routes/deviation.routes')({ pool, auth, getWorkflowEngine }));
app.use(require('./routes/coa.routes')({ pool, coaPool, auth }));
app.use(require('./routes/instrument.routes')({ pool, micPool, auth, logPush }));
app.use(require('./routes/log.routes')({ pool, auth }));

// ========== 审批流路由（内部初始化 workflowEngine） ==========
setupWorkflowRoutes(app, {
  requireAuth: auth.requireAuth,
  requirePermission: auth.requirePermission,
  getUsername: auth.getUsernameFromReq,
});
// setupWorkflowRoutes 内部通过 app.set('workflowEngine', engine) 注册引擎
// 这里同步更新本地引用
workflowEngine = app.get('workflowEngine');

// ========== OCR 路由 ==========
setupOcrRoutes(app, {
  requireAuth: auth.requireAuth,
  requirePermission: auth.requirePermission,
});

// ========== 备份管理（路由较少，保留在入口文件） ==========
const { requirePermission } = auth;

app.get('/api/backups', requirePermission('backup_management'), async (req, res) => {
  try {
    const rows = await listBackups(50);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('查询备份记录失败:', err);
    res.status(500).json({ error: '查询备份记录失败' });
  }
});

app.post('/api/backups/run', requirePermission('backup_management'), async (req, res) => {
  const username = req.session.username;
  res.json({ success: true, message: '备份任务已启动，请稍后刷新列表查看结果。' });
  try {
    await runBackup(username);
  } catch (err) {
    console.error('手动备份执行失败:', err);
  }
});

// ========== 健康检查 ==========
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'pdf-print-server' });
});

// ========== 启动 ==========
app.listen(PORT, async () => {
  console.log(`PDF 打印服务已启动: http://localhost:${PORT}`);
  console.log(`接口地址: POST http://localhost:${PORT}/api/print`);

  // 启动时自动迁移：确保登录锁定功能所需的表和字段存在
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
        username    VARCHAR(50)  NOT NULL COMMENT '用户名',
        ip_address  VARCHAR(45)  NULL COMMENT 'IP地址',
        attempted_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '尝试时间',
        KEY idx_username (username),
        KEY idx_attempted_at (attempted_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录失败尝试记录表'
    `);
    const [cols] = await pool.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'locked_until'"
    );
    if (cols.length === 0) {
      await pool.execute(
        'ALTER TABLE users ADD COLUMN locked_until DATETIME NULL COMMENT \'账户锁定截止时间，NULL表示未锁定\''
      );
      console.log('[迁移] 已自动添加 users.locked_until 列');
    }
    const [pwCols] = await pool.execute(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_changed_at'"
    );
    if (pwCols.length === 0) {
      await pool.execute(
        'ALTER TABLE users ADD COLUMN password_changed_at DATETIME NULL COMMENT \'密码最后修改时间\''
      );
      await pool.execute('UPDATE users SET password_changed_at = NOW() WHERE password_changed_at IS NULL');
      console.log('[迁移] 已自动添加 users.password_changed_at 列并回填数据');
    }
    console.log('[迁移] 账户锁定与密码有效期功能表结构已就绪');
  } catch (migErr) {
    console.error('[迁移] 账户锁定表初始化失败:', migErr.message);
  }

  // 启动时测试数据库连接
  const dbOk = await testConnection();
  if (!dbOk) {
    console.warn('警告：数据库连接失败，登录功能将不可用，请检查 MariaDB 是否已启动及配置是否正确');
  }

  const mssqlOk = await testMssqlConnection();
  if (!mssqlOk) {
    console.warn('警告：MSSQL 连接失败，数据查询功能将不可用，请检查 ERP1 数据库配置及网络');
  }

  const coaOk = await testCoaConnection();
  if (!coaOk) {
    console.warn('警告：Azure SQL (COA) 连接失败，COA 产品数据同步功能将不可用');
  }

  // 启动定时任务
  startDailyCheck();
  startWeeklyCheck();
  startWeeklyPush();
  startDailyOverduePush();
  startQcMaintenancePush();
  startUnprocessedRequestPush();
  startNewRepairPolling();
  startNewIssuePolling();
  startDailyBackup();
});
