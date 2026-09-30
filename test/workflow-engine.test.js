// 阶段 A4：审批引擎核心单元测试
// 不连真实数据库，通过 mock 验证 GET_LOCK 去重逻辑（A3 改造）
// 运行方式: node test/workflow-engine.test.js

const assert = require('assert');

// ---------- mock db-config 的 pool ----------
// 测试只关心 scanOverdueTasks 路径，模拟一个可控的 pool
function createMockPool({ lockGot = true, overdueRows = [] } = {}) {
  const calls = []; // 记录所有 execute/query 调用，便于断言
  // 注意: mysql2 的 query/execute 返回 [rows, fields] 两项
  const mockConn = {
    query: async (sql) => {
      calls.push({ fn: 'conn.query', sql });
      if (sql.includes("GET_LOCK")) {
        return [[{ got: lockGot ? 1 : 0 }], []];
      }
      if (sql.includes("RELEASE_LOCK")) {
        return [[{ released: 1 }], []];
      }
      return [[], []];
    },
    release: () => calls.push({ fn: 'conn.release' }),
  };

  const mockPool = {
    getConnection: async () => {
      calls.push({ fn: 'getConnection' });
      return mockConn;
    },
    execute: async (sql) => {
      calls.push({ fn: 'execute', sql });
      if (sql.includes('FROM workflow_tasks t')) {
        return [overdueRows, []];
      }
      return [[], []];
    },
  };

  return { mockPool, calls };
}

// ---------- 加载被测模块（注入 mock pool） ----------
// workflow-engine.js 在文件顶部 require('./db-config') 解构出 pool
// 用 Node module cache 拦截：先 require mock 版 db-config，再 require workflow-engine
function loadEngineWithMock(mockPool) {
  // 清掉之前 require 的缓存，保证每次测试干净
  delete require.cache[require.resolve('../db-config')];
  delete require.cache[require.resolve('../workflow-engine')];

  // 注入 mock：db-config 模块导出 { pool: mockPool, ... }
  const dbConfigPath = require.resolve('../db-config');
  require.cache[dbConfigPath] = {
    id: dbConfigPath,
    filename: dbConfigPath,
    loaded: true,
    exports: { pool: mockPool, DB_HOST: 'mock', DB_NAME: 'mock' },
  };

  // require workflow-engine 会拿到注入后的 pool
  return require('../workflow-engine');
}

// ---------- 测试用例 ----------

async function test1_scanOverdueTasks_noLock_skip() {
  // 场景: GET_LOCK 返回 0（其他实例持有锁），应该直接 return，不执行后续 SELECT
  const { mockPool, calls } = createMockPool({ lockGot: false });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);

  const engine = new WorkflowEngine({});
  await engine.scanOverdueTasks();

  // 断言1: 拿了连接
  assert(calls.some(c => c.fn === 'getConnection'), '应调用 getConnection');
  // 断言2: 调了 GET_LOCK
  assert(calls.some(c => c.fn === 'conn.query' && c.sql.includes('GET_LOCK')), '应调用 GET_LOCK');
  // 断言3: 没有执行后续的 SELECT（因为没拿到锁）
  assert(!calls.some(c => c.fn === 'execute' && c.sql.includes('FROM workflow_tasks t')),
    '未拿到锁时不应执行扫描 SELECT');
  // 断言4: 不需要 RELEASE_LOCK（没拿到就不释放）
  assert(!calls.some(c => c.fn === 'conn.query' && c.sql.includes('RELEASE_LOCK')),
    '未拿到锁时不应调用 RELEASE_LOCK');
  // 断言5: 连接要归还
  assert(calls.some(c => c.fn === 'conn.release'), '应归还连接');

  console.log('  PASS: scanOverdueTasks 未拿到锁时静默跳过');
}

async function test2_scanOverdueTasks_gotLock_executes() {
  // 场景: GET_LOCK 返回 1，应执行扫描 SELECT 并发送提醒
  const fakeTask = { id: 999, assignee_username: 'u1', instance_id: 1, due_time: new Date() };
  const { mockPool, calls } = createMockPool({ lockGot: true, overdueRows: [fakeTask] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);

  let reminderCalledWith = null;
  const engine = new WorkflowEngine({
    sendReminder: async (task) => { reminderCalledWith = task; }
  });

  await engine.scanOverdueTasks();

  // 断言1: 拿到锁后执行了 SELECT
  assert(calls.some(c => c.fn === 'execute' && c.sql.includes('FROM workflow_tasks t')),
    '拿到锁后应执行扫描 SELECT');
  // 断言2: 发送了提醒
  assert.strictEqual(reminderCalledWith.id, 999, '应调用 sendReminder');
  // 断言3: UPDATE is_reminded 被调用
  assert(calls.some(c => c.fn === 'execute' && c.sql.includes('is_reminded = 1')),
    '应标记 is_reminded=1');
  // 断言4: 释放了锁
  assert(calls.some(c => c.fn === 'conn.query' && c.sql.includes('RELEASE_LOCK')),
    '应调用 RELEASE_LOCK');
  // 断言5: 归还连接
  assert(calls.some(c => c.fn === 'conn.release'), '应归还连接');

  console.log('  PASS: scanOverdueTasks 拿到锁后正常扫描+提醒+释放锁');
}

async function test3_scanOverdueTasks_noLock_doesNotSendReminder() {
  // 场景: 未拿到锁，绝不应该触发 sendReminder
  const { mockPool } = createMockPool({ lockGot: false, overdueRows: [{ id: 1 }] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);

  let reminderCount = 0;
  const engine = new WorkflowEngine({
    sendReminder: async () => { reminderCount++; }
  });

  await engine.scanOverdueTasks();
  assert.strictEqual(reminderCount, 0, '未拿到锁时不应调用 sendReminder');

  console.log('  PASS: scanOverdueTasks 未拿到锁时不发送提醒');
}

async function test4_module_exports_smoke() {
  // 冒烟: 模块可加载，导出 WorkflowEngine 和 evaluateExpression
  const { mockPool } = createMockPool({});
  const mod = loadEngineWithMock(mockPool);
  assert.strictEqual(typeof mod.WorkflowEngine, 'function', '应导出 WorkflowEngine 类');
  assert.strictEqual(typeof mod.evaluateExpression, 'function', '应导出 evaluateExpression');
  console.log('  PASS: 模块加载成功，导出符合预期');
}

async function test5_tenantContext子公司用户() {
  // 场景: 子公司用户登录后，租户上下文返回 { isSuperAdmin:false, companyId:5 }
  const { mockPool } = createMockPool({});
  const createAuth = require('../middleware/auth.middleware');
  const auth = createAuth(mockPool);

  // 用 createSession 模拟登录（普通子公司用户）
  const fakeRes = { setHeader: () => {} };
  auth.createSession(fakeRes, 'user_a', 5, false); // companyId=5, isSuperAdmin=false
  const req = { session: { username: 'user_a', companyId: 5, isSuperAdmin: false } };

  const ctx = auth.getTenantContextFromReq(req);
  assert.strictEqual(ctx.isSuperAdmin, false, '子公司用户 isSuperAdmin 应为 false');
  assert.strictEqual(ctx.companyId, 5, '子公司用户应返回 companyId=5');

  console.log('  PASS: 子公司用户租户上下文正确（isSuperAdmin=false, companyId=5）');
}

async function test6_tenantContext集团超管() {
  // 场景: admin 登录时 is_super_admin=1，跨租户访问
  const { mockPool } = createMockPool({});
  const createAuth = require('../middleware/auth.middleware');
  const auth = createAuth(mockPool);

  const fakeRes = { setHeader: () => {} };
  auth.createSession(fakeRes, 'admin', null, true); // companyId=null, isSuperAdmin=true
  const req = { session: { username: 'admin', companyId: null, isSuperAdmin: true } };

  const ctx = auth.getTenantContextFromReq(req);
  assert.strictEqual(ctx.isSuperAdmin, true, '集团超管 isSuperAdmin 应为 true');
  assert.strictEqual(ctx.companyId, null, '集团超管 companyId 应为 null');

  console.log('  PASS: 集团超管租户上下文正确（isSuperAdmin=true, companyId=null）');
}

async function test7_tenantContext未登录() {
  // 场景: 未登录请求，返回安全默认值
  const { mockPool } = createMockPool({});
  const createAuth = require('../middleware/auth.middleware');
  const auth = createAuth(mockPool);

  const ctx = auth.getTenantContextFromReq({}); // 无 session
  assert.strictEqual(ctx.isSuperAdmin, false, '未登录应 isSuperAdmin=false');
  assert.strictEqual(ctx.companyId, null, '未登录应 companyId=null');

  console.log('  PASS: 未登录返回安全默认值（isSuperAdmin=false, companyId=null）');
}

async function test8_tenantContext防呆非超管无company() {
  // 场景: session 损坏导致"非超管 + companyId=null"（不应发生但需兜底）
  // 引擎层若调用 getTenantContextFromReq 应拒绝查询
  const { mockPool } = createMockPool({});
  const createAuth = require('../middleware/auth.middleware');
  const auth = createAuth(mockPool);

  const req = { session: { username: 'bad_user', companyId: null, isSuperAdmin: false } };
  const ctx = auth.getTenantContextFromReq(req);
  // 这里只验证返回值，实际越权防护在 B3 引擎层做
  assert.strictEqual(ctx.isSuperAdmin, false, '损坏 session isSuperAdmin 应为 false');
  assert.strictEqual(ctx.companyId, null, '损坏 session companyId 应为 null');
  // 引擎层后续应判断: if (!isSuperAdmin && companyId==null) throw '用户未分配公司'

  console.log('  PASS: 损坏 session 兜底返回（引擎层应拒绝查询）');
}

async function test9_createSession参数防呆() {
  // 场景: 验证 createSession 各种参数组合都能正确入 session
  const { mockPool } = createMockPool({});
  const createAuth = require('../middleware/auth.middleware');
  const auth = createAuth(mockPool);

  // 不传任何可选参数：默认非超管 + companyId=null
  // 注意：登录路由会在前面拦截，但 createSession 自身不拦截，纯记录
  const fakeRes1 = { setHeader: () => {} };
  const sid1 = auth.createSession(fakeRes1, 'guest');
  // 这里没法直接读 sessions Map，但能确认调用不抛错
  assert.strictEqual(typeof sid1, 'string', '应返回 sid 字符串');
  assert.ok(sid1.length > 0, 'sid 非空');

  // companyId 传字符串数字（数据库可能返回字符串）
  const fakeRes2 = { setHeader: () => {} };
  const sid2 = auth.createSession(fakeRes2, 'user_b', '7', false);
  assert.strictEqual(typeof sid2, 'string', '应返回 sid 字符串');

  console.log('  PASS: createSession 参数兼容（默认值 + 字符串 companyId）');
}

// ---------- 跑测 ----------

async function main() {
  console.log('workflow-engine.test.js');
  console.log('---');
  const tests = [
    test4_module_exports_smoke,
    test1_scanOverdueTasks_noLock_skip,
    test2_scanOverdueTasks_gotLock_executes,
    test3_scanOverdueTasks_noLock_doesNotSendReminder,
    test5_tenantContext子公司用户,
    test6_tenantContext集团超管,
    test7_tenantContext未登录,
    test8_tenantContext防呆非超管无company,
    test9_createSession参数防呆,
  ];
  let failed = 0;
  for (const t of tests) {
    try {
      await t();
    } catch (e) {
      failed++;
      console.error(`  FAIL: ${t.name}`);
      console.error('    ' + e.message);
      console.error(e.stack);
    }
  }
  console.log('---');
  console.log(`结果: ${tests.length - failed}/${tests.length} 通过`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
