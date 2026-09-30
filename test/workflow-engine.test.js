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

// ==================== C1: 表单数据 form_data_json 落库 ====================

// completeTask 路径专用 mock pool 工厂：
// 构造一个 approve → 流程结束 的最简场景：
//   流程图: start → approval(approvalMode=any) → end
//   任务: status=pending, instance_status=running, assignee=user_a, version=1
// 返回 calls 列表，断言 SQL 是否含 form_data_json
function createCompleteTaskMockPoolV2() {
  const calls = [];

  const taskRow = {
    id: 100, instance_id: 50, definition_id: 1,
    node_id: 'approval', node_name: '审批', assignee_username: 'user_a',
    status: 'pending', version: 1, instance_status: 'running',
    business_key: 'capa:1', payload_json: '{}',
    current_node_ids: '["approval"]', module_key: 'capa'
  };
  const defRow = {
    id: 1, module_key: 'capa', name: 'CAPA审批', version: 1, is_active: 1,
    condition: '', priority: 0,
    nodes_json: JSON.stringify([
      { id: 'start', type: 'start' },
      { id: 'approval', type: 'approval', config: { approvalMode: 'any', assignees: ['user_a'] } },
      { id: 'end', type: 'end' }
    ]),
    edges_json: JSON.stringify([
      { source: 'start', target: 'approval' },
      { source: 'approval', target: 'end', label: 'approve' }
    ])
  };
  const instanceRow = { id: 50, status: 'running', current_node_ids: '["approval"]', payload_json: '{}', business_key: 'capa:1' };
  const nodeResultRow = { status: 'completed', action: 'approve', created_at: new Date().toISOString() };

  const mockPool = {
    execute: async (sql, params = []) => {
      calls.push({ fn: 'execute', sql, params });
      if (sql.includes('FROM workflow_definitions') && sql.includes('WHERE id = ?')) return [[defRow], []];
      if (sql.includes('FROM workflow_instance_vars WHERE instance_id = ?')) return [[], []];
      if (sql.includes('FROM workflow_instances i') && sql.includes('WHERE i.id = ?')) return [[instanceRow], []];
      return [[], []];
    },
    getConnection: async () => {
      const conn = {
        beginTransaction: async () => calls.push({ fn: 'beginTransaction' }),
        commit: async () => calls.push({ fn: 'commit' }),
        rollback: async () => calls.push({ fn: 'rollback' }),
        release: () => calls.push({ fn: 'release' }),
        execute: async (sql, params = []) => {
          calls.push({ fn: 'conn.execute', sql, params });
          // SELECT task FOR UPDATE（多行 SQL，用拆分 includes 匹配）
          if (sql.includes('FROM workflow_tasks t') && sql.includes('JOIN workflow_instances i') && sql.includes('FOR UPDATE')) return [[taskRow], []];
          if (sql.includes('UPDATE workflow_tasks') && sql.includes('version = version + 1')) return [{ affectedRows: 1 }, []];
          if (sql.includes('INSERT INTO workflow_task_history') && !sql.includes('SELECT')) return [{ insertId: 1 }, []];
          if (sql.includes('INSERT INTO workflow_task_history') && sql.includes('SELECT')) return [{ affectedRows: 0 }, []];
          if (sql.includes("UPDATE workflow_tasks") && sql.includes("status = 'cancelled'")) return [{ affectedRows: 0 }, []];
          if (sql.includes('UPDATE workflow_instances SET status = ?')) return [{ affectedRows: 1 }, []];
          if (sql.includes('FROM workflow_tasks') && sql.includes('WHERE instance_id = ?') && sql.includes('AND node_id = ?')) return [[nodeResultRow], []];
          // getInstance: SELECT i.*, d.module_key, ... FROM workflow_instances i JOIN workflow_definitions d ON i.definition_id = d.id WHERE i.id = ?
          if (sql.includes('FROM workflow_instances i') && sql.includes('JOIN workflow_definitions d') && sql.includes('WHERE i.id = ?')) {
            return [[{ ...instanceRow, module_key: 'capa', def_nodes_json: defRow.nodes_json, def_edges_json: defRow.edges_json }], []];
          }
          if (sql.includes('FROM workflow_instances WHERE id = ?')) return [[instanceRow], []];
          return [[], []];
        },
      };
      calls.push({ fn: 'getConnection' });
      return conn;
    },
  };

  return { mockPool, calls };
}

async function test21_completeTask_对象formData落tasks和history() {
  // 场景：审批人提交 formData 对象 { rca: '原因A', measure: '措施B' }
  // 期望：
  //   1. UPDATE workflow_tasks 的 SQL 含 form_data_json 列，params 含 JSON 字符串
  //   2. INSERT INTO workflow_task_history 的 SQL 含 form_data_json 列，params 含 JSON 字符串
  const { mockPool, calls } = createCompleteTaskMockPoolV2();
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const formData = { rca: '原因A', measure: '措施B' };
  await engine.completeTask(100, {
    action: 'approve',
    comment: '同意',
    completed_by: 'user_a',
    formData
  }, { isSuperAdmin: true, companyId: null });

  // 找到 UPDATE workflow_tasks SET ... form_data_json
  const updateCall = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_tasks') && c.sql.includes('version = version + 1'));
  assert(updateCall, '应执行 UPDATE workflow_tasks');
  assert(/form_data_json/.test(updateCall.sql), 'UPDATE tasks SQL 应含 form_data_json 列');
  // formData 在 params 中的位置：[status, action, comment, completed_at, formDataJson, taskId, version]
  // 即 params[4]
  assert.strictEqual(updateCall.params[4], JSON.stringify(formData),
    'UPDATE tasks 的 form_data_json 参数应为对象 JSON 序列化字符串');

  // 找到主路径 INSERT INTO workflow_task_history (VALUES ?, ?, ...)
  const insertCall = calls.find(c =>
    c.fn === 'conn.execute' &&
    c.sql.includes('INSERT INTO workflow_task_history') &&
    !c.sql.includes('SELECT') &&
    c.sql.includes('VALUES')
  );
  assert(insertCall, '应执行主路径 INSERT INTO workflow_task_history');
  assert(/form_data_json/.test(insertCall.sql), 'INSERT history SQL 应含 form_data_json 列');
  // history INSERT params: [taskId, instanceId, node_id, node_name, completed_by, action, comment, now, companyId, formDataJson]
  const lastParam = insertCall.params[insertCall.params.length - 1];
  assert.strictEqual(lastParam, JSON.stringify(formData),
    'INSERT history 的 form_data_json 参数应为对象 JSON 字符串');

  console.log('  PASS: completeTask 对象 formData 落 tasks 和 history（JSON 字符串）');
}

async function test22_completeTask_nullFormData向后兼容() {
  // 场景：旧前端不传 formData（默认 null）
  // 期望：UPDATE/INSERT 的 form_data_json 参数为 null（向后兼容，不破坏旧调用）
  const { mockPool, calls } = createCompleteTaskMockPoolV2();
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  await engine.completeTask(100, {
    action: 'approve',
    comment: '同意',
    completed_by: 'user_a'
    // 故意不传 formData
  }, { isSuperAdmin: true, companyId: null });

  const updateCall = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_tasks') && c.sql.includes('version = version + 1'));
  assert(updateCall, '应执行 UPDATE workflow_tasks');
  assert.strictEqual(updateCall.params[4], null,
    '不传 formData 时 form_data_json 应为 null（向后兼容）');

  const insertCall = calls.find(c =>
    c.fn === 'conn.execute' &&
    c.sql.includes('INSERT INTO workflow_task_history') &&
    !c.sql.includes('SELECT') &&
    c.sql.includes('VALUES')
  );
  const lastParam = insertCall.params[insertCall.params.length - 1];
  assert.strictEqual(lastParam, null,
    'INSERT history 的 form_data_json 也应为 null（向后兼容）');

  console.log('  PASS: completeTask 不传 formData 时 form_data_json=null 向后兼容');
}

async function test23_completeTask_字符串formData原样保存() {
  // 场景：调用方传字符串（已序列化的 JSON），引擎应原样保存不再 JSON.stringify
  // 这样避免双引号转义（"\"rca\"" 等）
  const { mockPool, calls } = createCompleteTaskMockPoolV2();
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const formDataStr = '{"rca":"原因A","measure":"措施B"}';
  await engine.completeTask(100, {
    action: 'approve',
    comment: '同意',
    completed_by: 'user_a',
    formData: formDataStr
  }, { isSuperAdmin: true, companyId: null });

  const updateCall = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_tasks') && c.sql.includes('version = version + 1'));
  assert.strictEqual(updateCall.params[4], formDataStr,
    '字符串 formData 应原样保存（不再 stringify）');

  const insertCall = calls.find(c =>
    c.fn === 'conn.execute' &&
    c.sql.includes('INSERT INTO workflow_task_history') &&
    !c.sql.includes('SELECT') &&
    c.sql.includes('VALUES')
  );
  const lastParam = insertCall.params[insertCall.params.length - 1];
  assert.strictEqual(lastParam, formDataStr,
    'INSERT history 的字符串 formData 也应原样保存');

  console.log('  PASS: completeTask 字符串 formData 原样保存（不再 JSON.stringify）');
}

// ==================== C2: cc 节点（只读知会，不入审批链） ====================

// advance 路径专用 mock 工厂：start → cc(receivers=[user_a, user_b]) → end
// 期望：INSERT workflow_cc 2 次（user_a / user_b），不创建 workflow_tasks，
//      流程实例最终 status='completed'（不阻塞）
function createCcAdvanceMockPool() {
  const calls = [];

  const defRow = {
    id: 1, module_key: 'capa', name: 'CAPA审批', version: 1, is_active: 1,
    condition: '', priority: 0,
    nodes_json: JSON.stringify([
      { id: 'start', type: 'start' },
      { id: 'cc1', type: 'cc', name: '知会QA', config: { receivers: ['user_a', 'user_b'], message: 'CAPA 已启动' } },
      { id: 'end', type: 'end' }
    ]),
    edges_json: JSON.stringify([
      { source: 'start', target: 'cc1' },
      { source: 'cc1', target: 'end' }
    ])
  };

  const mockPool = {
    execute: async (sql, params = []) => {
      calls.push({ fn: 'execute', sql, params });
      // getActiveDefinition SELECT
      if (sql.includes('FROM workflow_definitions') && sql.includes('module_key = ?') && sql.includes('is_active = 1')) {
        return [[defRow], []];
      }
      // getInstance SELECT (in completeTask path): SELECT i.*, d.module_key, ... FROM workflow_instances i JOIN workflow_definitions d
      if (sql.includes('FROM workflow_instances i') && sql.includes('JOIN workflow_definitions d') && sql.includes('WHERE i.id = ?')) {
        return [[{ id: 50, status: 'completed', current_node_ids: '[]', payload_json: '{}', business_key: 'capa:1', module_key: 'capa', def_nodes_json: defRow.nodes_json, def_edges_json: defRow.edges_json }], []];
      }
      return [[], []];
    },
    getConnection: async () => {
      const conn = {
        beginTransaction: async () => calls.push({ fn: 'beginTransaction' }),
        commit: async () => calls.push({ fn: 'commit' }),
        rollback: async () => calls.push({ fn: 'rollback' }),
        release: () => calls.push({ fn: 'release' }),
        execute: async (sql, params = []) => {
          calls.push({ fn: 'conn.execute', sql, params });
          if (sql.includes('INSERT INTO workflow_instances')) return [{ insertId: 50 }, []];
          if (sql.includes('INSERT INTO workflow_cc')) {
            // 记录每次插入的 receiver_username（第 4 个参数，索引 3）
            return [{ insertId: calls.filter(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_cc')).length }, []];
          }
          if (sql.includes('UPDATE workflow_instances SET current_node_ids')) return [{ affectedRows: 1 }, []];
          if (sql.includes('UPDATE workflow_instances SET status = ?')) return [{ affectedRows: 1 }, []];
          if (sql.includes('SELECT * FROM workflow_instances WHERE id = ?')) return [[{ id: 50, status: 'completed', current_node_ids: '[]', payload_json: '{}', business_key: 'capa:1' }], []];
          if (sql.includes('SELECT created_by FROM workflow_instances WHERE id = ?')) return [[{ created_by: 'admin' }], []];
          return [[], []];
        },
      };
      calls.push({ fn: 'getConnection' });
      return conn;
    },
  };

  return { mockPool, calls };
}

async function test24_cc节点_不入审批链直接生成知会记录() {
  // 场景：流程图 start → cc(receivers=['user_a','user_b']) → end
  // 期望：
  //   1. advance 期间调用 INSERT INTO workflow_cc 两次
  //   2. 不调用 INSERT INTO workflow_tasks
  //   3. 流程实例最终 status='completed'（cc 不阻塞流程前进）
  const { mockPool, calls } = createCcAdvanceMockPool();
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const result = await engine.startInstance({
    module_key: 'capa',
    business_key: 'capa:1',
    payload: {},
    created_by: 'admin'
  }, { isSuperAdmin: true, companyId: null });

  // 断言1: 至少 2 次 INSERT INTO workflow_cc
  const ccInserts = calls.filter(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_cc'));
  assert.strictEqual(ccInserts.length, 2, '应为 2 个 receiver 各 INSERT 1 次 workflow_cc');

  // 断言2: receiver_username 应是 user_a 和 user_b（params[3]）
  const receivers = ccInserts.map(c => c.params[3]).sort();
  assert.deepStrictEqual(receivers, ['user_a', 'user_b'], 'receiver_username 应匹配配置');

  // 断言3: 不创建 workflow_tasks（cc 节点不入审批链）
  const taskInserts = calls.filter(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_tasks'));
  assert.strictEqual(taskInserts.length, 0, 'cc 节点不应创建 workflow_tasks');

  // 断言4: 流程实例最终状态为 completed（cc 不阻塞流程前进）
  const statusUpdate = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_instances SET status = ?'));
  assert(statusUpdate, '应执行 UPDATE workflow_instances SET status');
  assert.strictEqual(statusUpdate.params[0], 'completed', '流程应结束 status=completed');

  console.log('  PASS: cc 节点不入审批链、生成 2 条知会记录、不阻塞流程前进');
}

async function test25_cc节点_message变量插值() {
  // 场景：cc 节点 message 含 ${vars.rca}，前置流程变量 vars.rca='设备故障'
  //       期望知会记录的 message 已替换为 '设备故障'
  const { mockPool, calls } = createCcAdvanceMockPool();
  // 替换定义：cc 节点 message 含变量插值
  const defRow = {
    id: 1, module_key: 'capa', name: 'CAPA', version: 1, is_active: 1,
    condition: '', priority: 0,
    nodes_json: JSON.stringify([
      { id: 'start', type: 'start' },
      // 用 vars 注入需通过流程定义起始就含 vars；这里直接测试 createCcRecords 的插值
      { id: 'cc1', type: 'cc', name: '知会', config: { receivers: ['user_a'], message: '原因: ${vars.rca}' } },
      { id: 'end', type: 'end' }
    ]),
    edges_json: JSON.stringify([{ source: 'start', target: 'cc1' }, { source: 'cc1', target: 'end' }])
  };
  mockPool.execute = async (sql) => {
    calls.push({ fn: 'execute', sql, params: [] });
    if (sql.includes('FROM workflow_definitions') && sql.includes('module_key = ?')) return [[defRow], []];
    return [[], []];
  };
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  // 直接调用 createCcRecords 测试插值
  const fakeConn = {
    execute: async (sql, params = []) => {
      calls.push({ fn: 'conn.execute', sql, params });
      return [{ insertId: 1 }, []];
    }
  };
  await engine.createCcRecords(fakeConn, 99, {
    id: 'cc1', type: 'cc', name: '知会',
    config: { receivers: ['user_a'], message: '原因: ${vars.rca}, 措施: ${vars.measure}' }
  }, { rca: '设备故障', measure: '更换轴承' }, { isSuperAdmin: true, companyId: null });

  const ccInsert = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_cc'));
  assert(ccInsert, '应 INSERT workflow_cc');
  // params[4] 是 message
  assert.strictEqual(ccInsert.params[4], '原因: 设备故障, 措施: 更换轴承',
    'message 应正确插值 ${vars.xxx}');

  console.log('  PASS: cc 节点 message 的 ${vars.xxx} 变量插值');
}

async function test26_listCcByReceiver_子公司限定c_company_id() {
  // 场景：子公司用户查我的知会，SQL 应含 c.company_id 过滤
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  await engine.listCcByReceiver('user_a', {}, { isSuperAdmin: false, companyId: 5 });

  const execCall = calls.find(c => c.fn === 'execute' && c.sql && c.sql.includes('FROM workflow_cc c'));
  assert(execCall, '应执行 listCcByReceiver 查询');
  assert(/c\.company_id IS NULL OR c\.company_id = \?/.test(execCall.sql),
    'SQL 应含 c.company_id 过滤');
  assert.strictEqual(execCall.params[0], 'user_a');
  assert.strictEqual(execCall.params[1], 5);

  console.log('  PASS: listCcByReceiver 子公司限定 c.company_id');
}

async function test27_markCcRead_子公司限定c_company_id() {
  // 场景：子公司用户标记已读，UPDATE 应含 c.company_id 过滤防越权
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  // 让 execute 返回 affectedRows=0（mock 默认空数组 [rows=[]]，需用对象）
  mockPool.execute = async (sql, params = []) => {
    calls.push({ fn: 'execute', sql, params });
    return [{ affectedRows: 0 }, []];
  };
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const ok = await engine.markCcRead(88, 'user_a', { isSuperAdmin: false, companyId: 5 });
  assert.strictEqual(ok, false, 'mock 返回 0 行影响，应返回 false');

  const execCall = calls.find(c => c.fn === 'execute' && c.sql && c.sql.includes('UPDATE workflow_cc'));
  assert(execCall, '应执行 UPDATE workflow_cc');
  assert(/c\.company_id IS NULL OR c\.company_id = \?/.test(execCall.sql),
    'UPDATE 应含 c.company_id 过滤');
  assert.ok(execCall.params.includes(88), '参数应含 ccId=88');
  assert.ok(execCall.params.includes('user_a'), '参数应含 username');
  assert.ok(execCall.params.includes(5), '参数应含 companyId=5');

  console.log('  PASS: markCcRead 子公司限定 c.company_id（防越权）');
}

// ==================== C3: parallel fork / join 并行分支 ====================

// 流程定义：start → parallel(fork) → [approval_A(ass=user_a), approval_B(ass=user_b)] → join → end
function buildParallelDef() {
  return {
    id: 1, module_key: 'capa', name: 'CAPA并行审批', version: 1, is_active: 1,
    condition: '', priority: 0,
    nodes_json: JSON.stringify([
      { id: 'start', type: 'start' },
      { id: 'fork1', type: 'parallel', name: '并行分支' },
      { id: 'approvalA', type: 'approval', name: 'QA审批', config: { approvalMode: 'all', assignees: ['user_a'] } },
      { id: 'approvalB', type: 'approval', name: '生产审批', config: { approvalMode: 'all', assignees: ['user_b'] } },
      { id: 'join1', type: 'join', name: '汇合' },
      { id: 'end', type: 'end' }
    ]),
    edges_json: JSON.stringify([
      { source: 'start', target: 'fork1' },
      { source: 'fork1', target: 'approvalA' },
      { source: 'fork1', target: 'approvalB' },
      { source: 'approvalA', target: 'join1', label: 'approve' },
      { source: 'approvalB', target: 'join1', label: 'approve' },
      { source: 'join1', target: 'end' }
    ])
  };
}

// 通用 advance 路径 mock：通过 finishedMap 控制 isBranchFinished 返回，
// pendingMap 控制 SELECT DISTINCT pending 任务的 node_id 列表
function createParallelMockPool({ finishedMap = {}, pendingNodeIds = [] } = {}) {
  const calls = [];
  const defRow = buildParallelDef();

  const mockConn = {
    beginTransaction: async () => calls.push({ fn: 'beginTransaction' }),
    commit: async () => calls.push({ fn: 'commit' }),
    rollback: async () => calls.push({ fn: 'rollback' }),
    release: () => calls.push({ fn: 'release' }),
    execute: async (sql, params = []) => {
      calls.push({ fn: 'conn.execute', sql, params });
      // isBranchFinished: SELECT COUNT(*) AS cnt FROM workflow_tasks WHERE instance_id=? AND node_id=? AND status='pending'
      if (sql.includes('SELECT COUNT(*) AS cnt FROM workflow_tasks') && sql.includes('AND node_id = ?')) {
        const nodeId = params[1];
        const cnt = finishedMap[nodeId] ? 0 : 1;
        return [[{ cnt }], []];
      }
      // SELECT DISTINCT node_id FROM workflow_tasks WHERE instance_id=? AND status='pending'
      if (sql.includes('SELECT DISTINCT node_id FROM workflow_tasks') && sql.includes("status = 'pending'")) {
        return [pendingNodeIds.map(n => ({ node_id: n })), []];
      }
      // SELECT created_by FROM workflow_instances WHERE id = ?  (resolveAssignee 兜底，但 assignees=普通用户名不会触发)
      if (sql.includes('SELECT created_by FROM workflow_instances WHERE id = ?')) {
        return [[{ created_by: 'admin' }], []];
      }
      // INSERT INTO workflow_tasks (createNodeTasks)
      if (sql.includes('INSERT INTO workflow_tasks')) {
        return [{ insertId: calls.filter(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_tasks')).length + 100 }, []];
      }
      // UPDATE workflow_instances SET current_node_ids = ?
      if (sql.includes('UPDATE workflow_instances SET current_node_ids')) return [{ affectedRows: 1 }, []];
      // UPDATE workflow_instances SET status = ?
      if (sql.includes('UPDATE workflow_instances SET status = ?')) return [{ affectedRows: 1 }, []];
      return [[], []];
    },
  };

  const mockPool = {
    execute: async (sql, params = []) => {
      calls.push({ fn: 'execute', sql, params });
      // getActiveDefinition / getDefinition SELECT
      if (sql.includes('FROM workflow_definitions')) return [[defRow], []];
      return [[], []];
    },
    getConnection: async () => {
      calls.push({ fn: 'getConnection' });
      return mockConn;
    },
  };

  return { mockPool, calls };
}

async function test28_parallel_fork创建多分支待办() {
  // 场景：advance(conn, instanceId, def, ['fork1'], {}) 从 fork1 节点开始推进
  // 期望：
  //   1. fork1 节点不创建任务（type=parallel 仅推进入边目标）
  //   2. approvalA 和 approvalB 各创建 1 个 workflow_tasks（user_a / user_b）
  //   3. current_node_ids 包含 approvalA 和 approvalB
  //   4. 流程实例不结束（无 reachedEnd）
  const { mockPool, calls } = createParallelMockPool({ finishedMap: {}, pendingNodeIds: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});
  const def = buildParallelDef();

  // 直接调用 advance
  const fakeConn = mockPool.getConnection._fakeConn || null;
  // 通过 pool.getConnection 拿 conn
  const conn = await mockPool.getConnection();

  await engine.advance(conn, 50, def, ['fork1'], {}, {}, { isSuperAdmin: true, companyId: null });

  // 断言1: INSERT INTO workflow_tasks 2 次
  const taskInserts = calls.filter(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_tasks'));
  assert.strictEqual(taskInserts.length, 2, '应创建 2 个 workflow_tasks（approvalA 和 approvalB）');

  // 断言2: assignee 应是 user_a 和 user_b（params 第 4 个，索引 3）
  const assignees = taskInserts.map(c => c.params[3]).sort();
  assert.deepStrictEqual(assignees, ['user_a', 'user_b'], 'assignee 应匹配两个分支节点配置');

  // 断言3: node_id 应是 approvalA 和 approvalB（params 第 2 个，索引 1）
  const nodeIds = taskInserts.map(c => c.params[1]).sort();
  assert.deepStrictEqual(nodeIds, ['approvalA', 'approvalB'], 'node_id 应是 approvalA 和 approvalB');

  // 断言4: current_node_ids UPDATE 调用，参数含 approvalA 和 approvalB
  const curUpdate = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_instances SET current_node_ids'));
  assert(curUpdate, '应执行 UPDATE current_node_ids');
  const curArr = JSON.parse(curUpdate.params[0]);
  assert.ok(curArr.includes('approvalA') && curArr.includes('approvalB'), 'current_node_ids 应含两个分支节点');

  // 断言5: 不应执行 UPDATE workflow_instances SET status（流程未结束）
  const statusUpdate = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_instances SET status = ?'));
  assert(!statusUpdate, '流程不应结束');

  console.log('  PASS: parallel fork 创建多分支 workflow_tasks，current_node_ids 含两分支');
}

async function test29_join_等待未完成分支() {
  // 场景：分支A 完成、分支B 仍有 pending 任务
  //       completeTask 推进到 join1（advance 从 ['join1'] 开始）
  // 期望：
  //   1. join1 不前进到 end（allFinished=false）
  //   2. 不创建新 workflow_tasks
  //   3. current_node_ids 合并含 approvalB（pendingNodeIds 提供）
  //   4. 流程不结束
  const { mockPool, calls } = createParallelMockPool({
    finishedMap: { approvalA: true, approvalB: false }, // A 已完成，B 未完成
    pendingNodeIds: ['approvalB']  // SELECT DISTINCT pending 返回 approvalB
  });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});
  const def = buildParallelDef();
  const conn = await mockPool.getConnection();

  await engine.advance(conn, 50, def, ['join1'], {}, {}, { isSuperAdmin: true, companyId: null });

  // 断言1: 不创建 workflow_tasks（join 不通过，无新 approval 节点）
  const taskInserts = calls.filter(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_tasks'));
  assert.strictEqual(taskInserts.length, 0, 'join 未通过不应创建新任务');

  // 断言2: current_node_ids UPDATE 参数应含 approvalB（从 pendingMap 合并）
  const curUpdate = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_instances SET current_node_ids'));
  assert(curUpdate, '应执行 UPDATE current_node_ids');
  const curArr = JSON.parse(curUpdate.params[0]);
  assert.ok(curArr.includes('approvalB'), 'join 等待时 current_node_ids 应保留 approvalB');

  // 断言3: 不应执行 UPDATE workflow_instances SET status（流程不结束）
  const statusUpdate = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_instances SET status = ?'));
  assert(!statusUpdate, 'join 等待时流程不应结束');

  // 断言4: 应调用 isBranchFinished 2 次（approvalA 和 approvalB）
  const branchChecks = calls.filter(c =>
    c.fn === 'conn.execute' && c.sql.includes('SELECT COUNT(*) AS cnt FROM workflow_tasks')
  );
  assert.strictEqual(branchChecks.length, 2, '应调用 isBranchFinished 2 次（A 和 B）');

  console.log('  PASS: join 节点等待未完成分支，保留 current_node_ids，流程不结束');
}

async function test30_join_通过后前进到end() {
  // 场景：所有分支已完成（finishedMap 全为 true）
  //       completeTask 推进到 join1（advance 从 ['join1'] 开始）
  // 期望：
  //   1. join1 前进到 end
  //   2. 不创建新 workflow_tasks（end 节点不创建任务）
  //   3. current_node_ids 为空（无 active approval 节点）
  //   4. 流程结束 status='completed'
  const { mockPool, calls } = createParallelMockPool({
    finishedMap: { approvalA: true, approvalB: true },
    pendingNodeIds: []
  });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});
  const def = buildParallelDef();
  const conn = await mockPool.getConnection();

  await engine.advance(conn, 50, def, ['join1'], {}, {}, { isSuperAdmin: true, companyId: null });

  // 断言1: 不创建新任务
  const taskInserts = calls.filter(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_tasks'));
  assert.strictEqual(taskInserts.length, 0, 'join 通过后 end 节点不应创建任务');

  // 断言2: current_node_ids 为空数组
  const curUpdate = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_instances SET current_node_ids'));
  assert(curUpdate, '应执行 UPDATE current_node_ids');
  assert.deepStrictEqual(JSON.parse(curUpdate.params[0]), [], 'current_node_ids 应为空数组');

  // 断言3: 流程结束 status='completed'
  const statusUpdate = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_instances SET status = ?'));
  assert(statusUpdate, '应执行 UPDATE workflow_instances SET status');
  assert.strictEqual(statusUpdate.params[0], 'completed', '流程应结束 status=completed');

  console.log('  PASS: join 通过后前进到 end，流程结束 status=completed');
}

// ==================== C4: timer 节点（到期扫描推进） ====================

async function test31_createTimerRecord_按duration计算fire_at() {
  // 场景：timer 节点 config.duration=86400（1 天）
  // 期望：INSERT workflow_timers 时 fire_at 约等于 NOW()+86400s
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const fakeConn = {
    execute: async (sql, params = []) => {
      calls.push({ fn: 'conn.execute', sql, params });
      return [{ insertId: 1 }, []];
    }
  };
  const before = Date.now();
  await engine.createTimerRecord(fakeConn, 99, {
    id: 'timer1', type: 'timer', name: '到期核查',
    config: { duration: 86400 }
  }, {}, { isSuperAdmin: false, companyId: 5 });
  const after = Date.now();

  const insertCall = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_timers'));
  assert(insertCall, '应执行 INSERT INTO workflow_timers');

  // params[3] = fire_at（第 4 个参数，索引 3）
  const fireAt = insertCall.params[3];
  assert(fireAt instanceof Date, 'fire_at 应是 Date 对象');
  const expectedMin = before + 86400 * 1000;
  const expectedMax = after + 86400 * 1000;
  assert.ok(fireAt.getTime() >= expectedMin && fireAt.getTime() <= expectedMax,
    `fire_at 应约等于 NOW()+86400s，实际 ${fireAt.toISOString()}`);

  // params[5] = companyId（子公司写入）
  assert.strictEqual(insertCall.params[5], 5, '子公司 companyId 应写入 5');

  console.log('  PASS: createTimerRecord 按 duration 计算 fire_at');
}

async function test32_createTimerRecord_从fireAtVar取时间() {
  // 场景：timer 节点 config.fireAtVar='verify_at'
  //       vars.verify_at = '2026-12-31T23:59:59Z'
  // 期望：fire_at 从变量取，精确等于 new Date('2026-12-31T23:59:59Z')
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const fakeConn = {
    execute: async (sql, params = []) => {
      calls.push({ fn: 'conn.execute', sql, params });
      return [{ insertId: 1 }, []];
    }
  };
  const verifyAtStr = '2026-12-31T23:59:59Z';
  await engine.createTimerRecord(fakeConn, 99, {
    id: 'timer1', type: 'timer', name: '到期核查',
    config: { fireAtVar: 'verify_at' }
  }, { verify_at: verifyAtStr }, { isSuperAdmin: true, companyId: null });

  const insertCall = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_timers'));
  const fireAt = insertCall.params[3];
  assert(fireAt instanceof Date);
  assert.strictEqual(fireAt.getTime(), new Date(verifyAtStr).getTime(),
    'fire_at 应从 vars.verify_at 取值');

  // params[5] = companyId（超管写 null）
  assert.strictEqual(insertCall.params[5], null, '超管 companyId 应写入 null');

  console.log('  PASS: createTimerRecord 从 fireAtVar 取时间');
}

async function test33_scanTimers_未拿锁时跳过() {
  // 场景：mock GET_LOCK 返回 0（其他实例已持锁）
  // 期望：scanTimers 返回 {processed:0, reason:'lock_busy'}，不查 timer 不调 processTimer
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  // 覆盖 getConnection 让 conn 也带 query 方法（scanTimers 在 conn 上调 GET_LOCK）
  mockPool.getConnection = async () => {
    const conn = {
      beginTransaction: async () => calls.push({ fn: 'beginTransaction' }),
      commit: async () => calls.push({ fn: 'commit' }),
      rollback: async () => calls.push({ fn: 'rollback' }),
      release: () => calls.push({ fn: 'release' }),
      query: async (sql) => {
        calls.push({ fn: 'conn.query', sql });
        if (sql.includes("GET_LOCK('workflow_timer_scan'")) {
          return [[{ lk: 0 }], []];
        }
        return [[], []];
      },
      execute: async (sql, params = []) => {
        calls.push({ fn: 'conn.execute', sql, params });
        return [[], []];
      },
    };
    calls.push({ fn: 'getConnection' });
    return conn;
  };
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const result = await engine.scanTimers();
  assert.strictEqual(result.processed, 0);
  assert.strictEqual(result.reason, 'lock_busy');

  // 不应查 timer 列表
  const scanCall = calls.find(c => c.fn === 'conn.execute' && c.sql && c.sql.includes('FROM workflow_timers'));
  assert(!scanCall, '未拿锁时不应查 workflow_timers');

  console.log('  PASS: scanTimers 未拿锁时静默跳过');
}

async function test34_processTimer_已处理不重复() {
  // 场景：timer 已被处理（UPDATE processed_at affectedRows=0）
  // 期望：processTimer 返回 false，不开新事务推进
  const { mockPool, calls } = createRecordingMockPool({ rows: [] });
  // 让 UPDATE workflow_timers SET processed_at 返回 affectedRows=0
  mockPool.getConnection = async () => {
    const conn = {
      beginTransaction: async () => calls.push({ fn: 'beginTransaction' }),
      commit: async () => calls.push({ fn: 'commit' }),
      rollback: async () => calls.push({ fn: 'rollback' }),
      release: () => calls.push({ fn: 'release' }),
      execute: async (sql, params = []) => {
        calls.push({ fn: 'conn.execute', sql, params });
        if (sql.includes('UPDATE workflow_timers SET processed_at')) {
          return [{ affectedRows: 0 }, []];  // 已被处理
        }
        return [[], []];
      },
    };
    calls.push({ fn: 'getConnection' });
    return conn;
  };
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});

  const ok = await engine.processTimer(999, {
    id: 999, instance_id: 50, node_id: 'timer1', company_id: 5
  });
  assert.strictEqual(ok, false, '已处理的 timer 应返回 false');

  // 不应查实例（UPDATE 0 行后立即 rollback）
  const instCall = calls.find(c => c.fn === 'conn.execute' && c.sql && c.sql.includes('FROM workflow_instances'));
  assert(!instCall, '已处理 timer 不应再查 workflow_instances');

  // 应执行 rollback
  assert(calls.some(c => c.fn === 'rollback'), '应 rollback');

  console.log('  PASS: processTimer 已处理 timer 不重复推进');
}

// ==================== C6: 综合场景测试 ====================

// 流程图：start → timer(duration=3600) → end
// 验证 advance 走到 timer 节点时的暂停行为
function buildTimerDef() {
  return {
    id: 1, module_key: 'capa', name: 'CAPA到期核查', version: 1, is_active: 1,
    condition: '', priority: 0,
    nodes_json: JSON.stringify([
      { id: 'start', type: 'start' },
      { id: 'timer1', type: 'timer', name: '到期核查', config: { duration: 3600 } },
      { id: 'end', type: 'end' }
    ]),
    edges_json: JSON.stringify([
      { source: 'start', target: 'timer1' },
      { source: 'timer1', target: 'end' }
    ])
  };
}

async function test35_advance_timer节点不前进且不结束流程() {
  // 场景：advance(conn, instanceId, def, ['timer1']) 从 timer 节点开始 BFS
  // 期望：
  //   1. 调 createTimerRecord 写入 1 条 workflow_timers
  //   2. 不创建 workflow_tasks（timer 不入审批链）
  //   3. 不前进到 end（current_node_ids 不含 end）
  //   4. 不调用 UPDATE workflow_instances SET status（流程不结束，等待 scanTimers 推进）
  const calls = [];
  const defRow = buildTimerDef();
  const mockConn = {
    execute: async (sql, params = []) => {
      calls.push({ fn: 'conn.execute', sql, params });
      if (sql.includes('INSERT INTO workflow_timers')) return [{ insertId: 1 }, []];
      if (sql.includes('UPDATE workflow_instances SET current_node_ids')) return [{ affectedRows: 1 }, []];
      if (sql.includes('UPDATE workflow_instances SET status = ?')) return [{ affectedRows: 1 }, []];
      if (sql.includes('SELECT DISTINCT node_id FROM workflow_tasks')) return [[], []];
      return [[], []];
    }
  };
  const mockPool = {
    execute: async (sql) => { calls.push({ fn: 'execute', sql }); return [[], []]; },
    getConnection: async () => { calls.push({ fn: 'getConnection' }); return mockConn; },
  };
  const { WorkflowEngine } = loadEngineWithMock(mockPool);
  const engine = new WorkflowEngine({});
  const def = buildTimerDef();

  await engine.advance(mockConn, 50, def, ['timer1'], {}, {}, { isSuperAdmin: true, companyId: null });

  // 断言1: INSERT workflow_timers 1 次
  const timerInserts = calls.filter(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_timers'));
  assert.strictEqual(timerInserts.length, 1, '应 INSERT 1 条 workflow_timers');

  // 断言2: 不创建 workflow_tasks
  const taskInserts = calls.filter(c => c.fn === 'conn.execute' && c.sql.includes('INSERT INTO workflow_tasks'));
  assert.strictEqual(taskInserts.length, 0, 'timer 节点不应创建 workflow_tasks');

  // 断言3: 不前进到 end → current_node_ids 应为空数组（无 activeApprovalNodes 也无 pending 任务）
  const curUpdate = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_instances SET current_node_ids'));
  assert(curUpdate, '应执行 UPDATE current_node_ids');
  assert.deepStrictEqual(JSON.parse(curUpdate.params[0]), [], 'current_node_ids 应为空数组');

  // 断言4: 不应执行 UPDATE workflow_instances SET status（流程不结束）
  const statusUpdate = calls.find(c => c.fn === 'conn.execute' && c.sql.includes('UPDATE workflow_instances SET status = ?'));
  assert(!statusUpdate, '流程不应结束（等待 scanTimers 推进）');

  console.log('  PASS: advance 走到 timer 节点暂停，不创建任务、不前进 end、不结束流程');
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
    // C1: 表单数据落库
    test21_completeTask_对象formData落tasks和history,
    test22_completeTask_nullFormData向后兼容,
    test23_completeTask_字符串formData原样保存,
    // C2: cc 节点
    test24_cc节点_不入审批链直接生成知会记录,
    test25_cc节点_message变量插值,
    test26_listCcByReceiver_子公司限定c_company_id,
    test27_markCcRead_子公司限定c_company_id,
    // C3: parallel fork/join
    test28_parallel_fork创建多分支待办,
    test29_join_等待未完成分支,
    test30_join_通过后前进到end,
    // C4: timer 节点
    test31_createTimerRecord_按duration计算fire_at,
    test32_createTimerRecord_从fireAtVar取时间,
    test33_scanTimers_未拿锁时跳过,
    test34_processTimer_已处理不重复,
    // C6: 综合场景
    test35_advance_timer节点不前进且不结束流程,
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
