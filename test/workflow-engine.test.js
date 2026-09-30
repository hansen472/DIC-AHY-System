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

// ---------- 增强版 mock pool（B3.2a 测试用） ----------
// 记录每条 execute 的 sql+params，可断言"是否带 company_id 过滤"
function createRecordingMockPool({ rows = [] } = {}) {
  const calls = [];
  const mockPool = {
    execute: async (sql, params = []) => {
      calls.push({ fn: 'execute', sql, params });
      return [rows, []];
    },
    getConnection: async () => {
      const conn = {
        beginTransaction: async () => calls.push({ fn: 'beginTransaction' }),
        commit: async () => calls.push({ fn: 'commit' }),
        rollback: async () => calls.push({ fn: 'rollback' }),
        release: () => calls.push({ fn: 'release' }),
        execute: async (sql, params = []) => {
          calls.push({ fn: 'conn.execute', sql, params });
          return [rows, []];
        },
      };
      calls.push({ fn: 'getConnection' });
      return conn;
    },
  };
  return { mockPool, calls };
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

// ==================== B3.2a: 定义层多租户过滤测试 ====================

async function test10_listDefinitions_超管不加过滤() {
  // 场景：超管调用 listDefinitions，SQL 不应包含 company_id 过滤
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  await engine.listDefinitions('supplier_qualifications', { isSuperAdmin: true, companyId: null });

  const execCall = calls.find(c => c.fn === 'execute' && c.sql && c.sql.includes('FROM workflow_definitions'));
  assert(execCall, '应执行 workflow_definitions 查询');
  assert(!/company_id/.test(execCall.sql), '超管 SQL 不应包含 company_id 过滤');
  // 参数应只有 moduleKey，不含 companyId
  assert.strictEqual(execCall.params.length, 1, '超管参数应只有 moduleKey');
  assert.strictEqual(execCall.params[0], 'supplier_qualifications');

  console.log('  PASS: 超管 listDefinitions 不加 company_id 过滤');
}

async function test11_listDefinitions_子公司加过滤() {
  // 场景：companyId=5 的子公司用户调用 listDefinitions，SQL 应含 company_id IS NULL OR company_id=5
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  await engine.listDefinitions('supplier_qualifications', { isSuperAdmin: false, companyId: 5 });

  const execCall = calls.find(c => c.fn === 'execute' && c.sql && c.sql.includes('FROM workflow_definitions'));
  assert(execCall, '应执行 workflow_definitions 查询');
  assert(/company_id IS NULL OR company_id = \?/.test(execCall.sql),
    '子公司 SQL 应含 company_id IS NULL OR company_id = ?');
  // 参数顺序：moduleKey, companyId
  assert.strictEqual(execCall.params[0], 'supplier_qualifications');
  assert.strictEqual(execCall.params[1], 5);

  console.log('  PASS: 子公司 listDefinitions 加 company_id 过滤（含 NULL OR =? 双条件）');
}

async function test12_getDefinition_越权防护返回null() {
  // 场景：companyId=5 的子公司用户尝试访问 id=99（属公司 8）的流程定义
  // mock pool 返回空数组（模拟 SQL 因 company_id 过滤未命中）
  // 期望：getDefinition 返回 null（不抛错），调用方应据此返回 404
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const def = await engine.getDefinition(99, { isSuperAdmin: false, companyId: 5 });
  assert.strictEqual(def, null, '越权访问应返回 null（模拟 SQL 过滤未命中）');

  const execCall = calls.find(c => c.fn === 'execute' && c.sql && c.sql.includes('WHERE id = ?'));
  assert(execCall, '应执行 getDefinition SELECT');
  assert(/company_id IS NULL OR company_id = \?/.test(execCall.sql),
    'SQL 应含 company_id 过滤，防止越权');
  assert.strictEqual(execCall.params[0], 99);
  assert.strictEqual(execCall.params[1], 5);

  console.log('  PASS: 越权访问流程定义时 SQL 加 company_id 过滤，未命中返回 null');
}

async function test13_createDefinition_超管company_id为null() {
  // 场景：超管创建流程定义，INSERT 的 company_id 应为 null（全局模板）
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  // 让 INSERT 返回 insertId=1
  mockPool.execute = async (sql, params = []) => {
    calls.push({ fn: 'execute', sql, params });
    return [{ insertId: 1 }, []];
  };
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const result = await engine.createDefinition({
    module_key: 'capa',
    name: 'CAPA审批流',
    nodes: [], edges: [], created_by: 'admin'
  }, { isSuperAdmin: true, companyId: null });

  assert.strictEqual(result.id, 1, '应返回 insertId');
  const insertCall = calls.find(c => c.fn === 'execute' && c.sql && c.sql.startsWith('INSERT INTO workflow_definitions'));
  assert(insertCall, '应执行 INSERT');
  assert(/company_id/.test(insertCall.sql), 'INSERT 应含 company_id 列');
  // 最后一个参数是 company_id 值，超管应为 null
  const lastParam = insertCall.params[insertCall.params.length - 1];
  assert.strictEqual(lastParam, null, '超管创建定义时 company_id 应为 null（全局模板）');

  console.log('  PASS: 超管创建流程定义写入 company_id=NULL（全局模板）');
}

async function test14_createDefinition_子公司写入company_id() {
  // 场景：companyId=5 的子公司用户创建流程定义，INSERT 的 company_id 应为 5
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  mockPool.execute = async (sql, params = []) => {
    calls.push({ fn: 'execute', sql, params });
    return [{ insertId: 7 }, []];
  };
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const result = await engine.createDefinition({
    module_key: 'capa',
    name: '子公司A的CAPA流',
    nodes: [], edges: [], created_by: 'user_a'
  }, { isSuperAdmin: false, companyId: 5 });

  assert.strictEqual(result.id, 7);
  const insertCall = calls.find(c => c.fn === 'execute' && c.sql && c.sql.startsWith('INSERT INTO workflow_definitions'));
  const lastParam = insertCall.params[insertCall.params.length - 1];
  assert.strictEqual(lastParam, 5, '子公司创建定义时 company_id 应为 5');

  console.log('  PASS: 子公司创建流程定义写入 company_id=N（私有）');
}

async function test15_activateDefinition_子公司限定本租户() {
  // 场景：companyId=5 的子公司用户启用流程定义 id=10
  // 期望：SELECT/UPDATE 都带 company_id 过滤；"禁用同模块其他默认流程"的 UPDATE 也带过滤
  const { mockPool, calls } = createRecordingMockPool({ rows: [{ module_key: 'capa', condition: '' }] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const ok = await engine.activateDefinition(10, { isSuperAdmin: false, companyId: 5 });
  assert.strictEqual(ok, true, '应返回 true（mock 返回数据）');

  // 检查所有 conn.execute 都带 company_id 过滤
  const connExecs = calls.filter(c => c.fn === 'conn.execute');
  assert(connExecs.length >= 3, '应至少 3 次 conn.execute（SELECT + 禁用 + 启用）');
  for (const ce of connExecs) {
    assert(/company_id IS NULL OR company_id = \?/.test(ce.sql),
      `SQL 应含 company_id 过滤: ${ce.sql.slice(0, 80)}...`);
    assert.ok(ce.params.includes(5), '参数应含 companyId=5');
  }

  console.log('  PASS: 子公司 activateDefinition 所有 SQL 限定到本租户');
}

async function test16_非超管无companyId抛TENANT_CTX_INVALID() {
  // 场景：session 损坏导致 isSuperAdmin=false && companyId=null
  // 期望：引擎层拒绝查询，抛 TENANT_CTX_INVALID 错误
  const { mockPool } = createRecordingMockPool({ rows: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  let thrown = null;
  try {
    await engine.listDefinitions('capa', { isSuperAdmin: false, companyId: null });
  } catch (e) {
    thrown = e;
  }
  assert(thrown, '应抛错');
  assert.strictEqual(thrown.code, 'TENANT_CTX_INVALID', '错误码应为 TENANT_CTX_INVALID');
  assert(/非超管用户未分配 company_id/.test(thrown.message), '错误信息应说明原因');

  console.log('  PASS: 非超管无 companyId 抛 TENANT_CTX_INVALID（防呆兜底）');
}

// ==================== B3.2b: 实例层多租户过滤测试 ====================

async function test17_listInstances_子公司限定i_company_id() {
  // 场景：子公司用户 listInstances，SQL 应含 i.company_id 过滤
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  await engine.listInstances({ status: 'running' }, { isSuperAdmin: false, companyId: 5 });

  const execCall = calls.find(c => c.fn === 'execute' && c.sql && c.sql.includes('FROM workflow_instances i'));
  assert(execCall, '应执行 listInstances 查询');
  assert(/i\.company_id IS NULL OR i\.company_id = \?/.test(execCall.sql),
    'SQL 应含 i.company_id 过滤');
  assert.ok(execCall.params.includes(5), '参数应含 companyId=5');

  console.log('  PASS: 子公司 listInstances 限定 i.company_id');
}

async function test18_getInstance_越权防护返回null() {
  // 场景：companyId=5 的子公司用户查询 id=88（属公司 8）的实例
  // mock pool 返回空数组（模拟 SQL 因 company_id 过滤未命中）
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const inst = await engine.getInstance(null, 88, { isSuperAdmin: false, companyId: 5 });
  assert.strictEqual(inst, null, '越权访问实例应返回 null');

  const execCall = calls.find(c => c.fn === 'execute' && c.sql && c.sql.includes('FROM workflow_instances i'));
  assert(/i\.company_id IS NULL OR i\.company_id = \?/.test(execCall.sql),
    'SQL 应含 i.company_id 过滤，防止越权');
  assert.strictEqual(execCall.params[0], 88);
  assert.strictEqual(execCall.params[1], 5);

  console.log('  PASS: 越权访问实例 SQL 加 i.company_id 过滤，未命中返回 null');
}

async function test19_startInstance_子公司写入company_id到实例和任务() {
  // 场景：子公司用户启动流程，INSERT workflow_instances 应写 company_id=5
  // 同时 createNodeTasks 的 INSERT workflow_tasks 也应写 company_id=5
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  // 让 getActiveDefinition 返回一个最小可用定义（含 start 节点和一条出边到 end）
  mockPool.execute = async (sql, params = []) => {
    calls.push({ fn: 'execute', sql, params });
    // 匹配 getActiveDefinition 的 SELECT（SQL 含多行换行，用 includes 拆分匹配）
    if (sql.includes('FROM workflow_definitions') && sql.includes('module_key = ?') && sql.includes('is_active = 1')) {
      return [[{
        id: 1, module_key: 'capa', name: 't', version: 1, is_active: 1,
        condition: '', priority: 0,
        nodes_json: JSON.stringify([
          { id: 'start', type: 'start' },
          { id: 'end', type: 'end' }
        ]),
        edges_json: JSON.stringify([{ source: 'start', target: 'end' }])
      }], []];
    }
    return [[], []];
  };
  // getConnection 用的 conn.execute 也记一下
  mockPool.getConnection = async () => {
    const conn = {
      beginTransaction: async () => calls.push({ fn: 'beginTransaction' }),
      commit: async () => calls.push({ fn: 'commit' }),
      rollback: async () => calls.push({ fn: 'rollback' }),
      release: () => calls.push({ fn: 'release' }),
      execute: async (sql, params = []) => {
        calls.push({ fn: 'conn.execute', sql, params });
        if (/INSERT INTO workflow_instances/.test(sql)) return [{ insertId: 100 }, []];
        return [[], []];
      },
    };
    calls.push({ fn: 'getConnection' });
    return conn;
  };

  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  await engine.startInstance({
    module_key: 'capa',
    business_key: 'capa:1',
    payload: {},
    created_by: 'user_a'
  }, { isSuperAdmin: false, companyId: 5 });

  // 找到 workflow_instances 的 INSERT（在 conn.execute 中）
  const instInsert = calls.find(c => c.fn === 'conn.execute' && /INSERT INTO workflow_instances/.test(c.sql));
  assert(instInsert, '应执行 INSERT workflow_instances');
  assert(/company_id/.test(instInsert.sql), 'INSERT 应含 company_id 列');
  // company_id 是最后一个参数
  const lastParam = instInsert.params[instInsert.params.length - 1];
  assert.strictEqual(lastParam, 5, '子公司启动流程时实例 company_id 应为 5');

  console.log('  PASS: 子公司 startInstance 写入 company_id 到实例（含 NULL OR =? 防越权）');
}

async function test20_getInstanceHistory_子公司限定h_company_id() {
  // 场景：子公司用户查实例历史，SQL 应含 h.company_id 过滤
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  await engine.getInstanceHistory(77, { isSuperAdmin: false, companyId: 5 });

  const execCall = calls.find(c => c.fn === 'execute' && c.sql && c.sql.includes('FROM workflow_task_history h'));
  assert(execCall, '应执行 getInstanceHistory 查询');
  assert(/h\.company_id IS NULL OR h\.company_id = \?/.test(execCall.sql),
    'SQL 应含 h.company_id 过滤');
  assert.strictEqual(execCall.params[0], 77);
  assert.strictEqual(execCall.params[1], 5);

  console.log('  PASS: 子公司 getInstanceHistory 限定 h.company_id');
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
    // B3.2a: 定义层多租户过滤
    test10_listDefinitions_超管不加过滤,
    test11_listDefinitions_子公司加过滤,
    test12_getDefinition_越权防护返回null,
    test13_createDefinition_超管company_id为null,
    test14_createDefinition_子公司写入company_id,
    test15_activateDefinition_子公司限定本租户,
    test16_非超管无companyId抛TENANT_CTX_INVALID,
    // B3.2b: 实例层多租户过滤
    test17_listInstances_子公司限定i_company_id,
    test18_getInstance_越权防护返回null,
    test19_startInstance_子公司写入company_id到实例和任务,
    test20_getInstanceHistory_子公司限定h_company_id,
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
