/**
 * 通用审批流引擎
 *
 * 设计原则：
 * 1. 流程定义（workflow_definitions）保存节点与连线 JSON。
 * 2. 流程实例（workflow_instances）保存运行时状态。
 * 3. 任务（workflow_tasks）保存当前待办。
 * 4. 历史（workflow_task_history）记录所有审批动作，用于审计。
 * 5. 变量（workflow_instance_vars）保存流程级变量，供条件分支使用。
 *
 * 支持的节点类型：
 * - start：开始节点
 * - approval：审批节点（支持 all/any/ratio 三种会签模式）
 * - condition：条件分支节点
 * - end：结束节点
 *
 * 支持的连线标签：
 * - approve / 空：审批通过时走这条线
 * - reject：审批驳回时走这条线
 * - true / false：条件分支结果
 */

const { pool } = require('./db-config');

// ==================== 白名单表达式解析器 ====================

const FORBIDDEN_IDENTIFIERS = new Set([
  '__proto__', 'prototype', 'constructor',
  'eval', 'Function', 'setTimeout', 'setInterval',
  'process', 'require', 'global', 'window', 'document'
]);

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) { i++; continue; }

    // 双字符运算符
    const two = expr.slice(i, i + 2);
    if (['>=', '<=', '==', '!=', '&&', '||'].includes(two)) {
      tokens.push(two);
      i += 2;
      continue;
    }
    // 单字符运算符 / 括号
    if (['>', '<', '(', ')'].includes(c)) {
      tokens.push(c);
      i++;
      continue;
    }
    // 字符串
    if (c === "'" || c === '"') {
      const quote = c;
      let s = '';
      i++;
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < expr.length) {
          s += expr[i + 1];
          i += 2;
        } else {
          s += expr[i];
          i++;
        }
      }
      i++; // 跳过结束引号
      tokens.push({ type: 'string', value: s });
      continue;
    }
    // 数字
    if (/\d/.test(c) || (c === '-' && /\d/.test(expr[i + 1]))) {
      let s = '';
      if (c === '-') { s += c; i++; }
      while (i < expr.length && (/\d|\./.test(expr[i]))) {
        s += expr[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(s) });
      continue;
    }
    // 标识符（字段名）
    if (/[a-zA-Z_$]/.test(c)) {
      let s = '';
      while (i < expr.length && /[a-zA-Z0-9_$.]/.test(expr[i])) {
        s += expr[i];
        i++;
      }
      if (FORBIDDEN_IDENTIFIERS.has(s)) {
        throw new Error(`表达式包含禁用标识符：${s}`);
      }
      tokens.push({ type: 'ident', value: s });
      continue;
    }
    throw new Error(`表达式包含非法字符：${c}`);
  }
  return tokens;
}

function getValue(name, context) {
  if (FORBIDDEN_IDENTIFIERS.has(name)) return undefined;
  if (name.startsWith('payload.')) {
    const key = name.slice(8);
    return context.payload ? context.payload[key] : undefined;
  }
  if (name.startsWith('vars.')) {
    const key = name.slice(5);
    return context.vars ? context.vars[key] : undefined;
  }
  // 默认先查 payload，再查 vars
  if (context.payload && Object.prototype.hasOwnProperty.call(context.payload, name)) {
    return context.payload[name];
  }
  if (context.vars && Object.prototype.hasOwnProperty.call(context.vars, name)) {
    return context.vars[name];
  }
  return undefined;
}

function parseExpression(tokens) {
  let pos = 0;
  function peek() { return tokens[pos]; }
  function consume() { return tokens[pos++]; }
  function parseOr() {
    let left = parseAnd();
    while (peek() === '||') {
      consume();
      const right = parseAnd();
      left = { op: '||', left, right };
    }
    return left;
  }
  function parseAnd() {
    let left = parseCompare();
    while (peek() === '&&') {
      consume();
      const right = parseCompare();
      left = { op: '&&', left, right };
    }
    return left;
  }
  function parseCompare() {
    const left = parsePrimary();
    const op = peek();
    if (['>', '<', '>=', '<=', '==', '!='].includes(op)) {
      consume();
      const right = parsePrimary();
      return { op, left, right };
    }
    return left;
  }
  function parsePrimary() {
    const t = peek();
    if (!t) throw new Error('表达式不完整');
    if (t === '(') {
      consume();
      const node = parseOr();
      if (consume() !== ')') throw new Error('缺少右括号');
      return node;
    }
    if (t.type === 'number' || t.type === 'string') {
      consume();
      return { type: 'literal', value: t.value };
    }
    if (t.type === 'ident') {
      consume();
      return { type: 'var', name: t.value };
    }
    throw new Error('表达式语法错误');
  }
  const ast = parseOr();
  if (pos < tokens.length) throw new Error('表达式存在未解析内容');
  return ast;
}

function evalNode(node, context) {
  if (node.type === 'literal') return node.value;
  if (node.type === 'var') return getValue(node.name, context);
  const l = evalNode(node.left, context);
  const r = evalNode(node.right, context);
  switch (node.op) {
    case '>': return l > r;
    case '<': return l < r;
    case '>=': return l >= r;
    case '<=': return l <= r;
    case '==': return l == r;
    case '!=': return l != r;
    case '&&': return l && r;
    case '||': return l || r;
    default: throw new Error('未知运算符：' + node.op);
  }
}

function evaluateExpression(expr, context) {
  if (!expr || String(expr).trim() === '') return true;
  const tokens = tokenize(String(expr));
  const ast = parseExpression(tokens);
  return !!evalNode(ast, context);
}

// ==================== 工具函数 ====================

function now() {
  return new Date();
}

function addHours(date, hours) {
  if (!hours) return null;
  const d = new Date(date);
  d.setTime(d.getTime() + hours * 60 * 60 * 1000);
  return d;
}

function safeJson(obj, fallback = null) {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    return JSON.stringify(fallback);
  }
}

function parseJson(text, fallback = null) {
  try {
    return text ? JSON.parse(text) : fallback;
  } catch (e) {
    return fallback;
  }
}

function buildGraph(definition) {
  const nodes = Array.isArray(definition.nodes_json)
    ? definition.nodes_json
    : parseJson(definition.nodes_json, []);
  const edges = Array.isArray(definition.edges_json)
    ? definition.edges_json
    : parseJson(definition.edges_json, []);

  const nodeMap = new Map();
  nodes.forEach(n => nodeMap.set(n.id, n));
  const outgoing = new Map();
  const incoming = new Map();
  nodes.forEach(n => {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  });
  edges.forEach(e => {
    if (outgoing.has(e.source)) outgoing.get(e.source).push(e);
    if (incoming.has(e.target)) incoming.get(e.target).push(e);
  });
  return { nodes, edges, nodeMap, outgoing, incoming };
}

function findStartNode(graph) {
  for (const n of graph.nodes) {
    if (n.type === 'start') return n;
  }
  return null;
}

// ==================== 引擎类 ====================

class WorkflowEngine {
  constructor({ sendReminder } = {}) {
    this.sendReminder = sendReminder || (() => Promise.resolve());
    this.hooks = {};
    this.timer = null;
  }

  registerModule(moduleKey, hooks) {
    this.hooks[moduleKey] = hooks || {};
  }

  // ---------- 流程定义 ----------

  async getActiveDefinition(moduleKey, context = {}) {
    const [rows] = await pool.execute(
      `SELECT id, module_key, name, version, is_active, \`condition\`, priority, nodes_json, edges_json
       FROM workflow_definitions
       WHERE module_key = ? AND is_active = 1
       ORDER BY priority DESC, version DESC, id DESC`,
      [moduleKey]
    );
    for (const def of rows) {
      try {
        if (evaluateExpression(def.condition, context)) {
          return def;
        }
      } catch (e) {
        console.error(`[WorkflowEngine] 流程定义 ${def.id} 条件表达式错误:`, e.message);
      }
    }
    return null;
  }

  async createDefinition({ module_key, name, version = 1, condition = '', priority = 0, nodes, edges, created_by }) {
    const [result] = await pool.execute(
      `INSERT INTO workflow_definitions
       (module_key, name, version, is_active, \`condition\`, priority, nodes_json, edges_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [module_key, name, version, 0, condition, priority, safeJson(nodes, []), safeJson(edges, []), created_by]
    );
    return { id: result.insertId };
  }

  async updateDefinition(id, { name, condition, priority, nodes, edges }) {
    const [existing] = await pool.execute(
      'SELECT name, \`condition\`, priority, nodes_json, edges_json FROM workflow_definitions WHERE id = ?',
      [id]
    );
    if (existing.length === 0) return false;
    const old = existing[0];

    const finalName = name !== undefined ? name : old.name;
    const finalCondition = condition !== undefined ? condition : old.condition;
    const finalPriority = priority !== undefined ? priority : old.priority;
    const finalNodes = nodes !== undefined ? safeJson(nodes, []) : old.nodes_json;
    const finalEdges = edges !== undefined ? safeJson(edges, []) : old.edges_json;

    const [result] = await pool.execute(
      `UPDATE workflow_definitions
       SET name = ?, \`condition\` = ?, priority = ?, nodes_json = ?, edges_json = ?
       WHERE id = ?`,
      [finalName, finalCondition, finalPriority, finalNodes, finalEdges, id]
    );
    return result.affectedRows > 0;
  }

  async activateDefinition(id) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [defs] = await connection.execute(
        'SELECT module_key, \`condition\` FROM workflow_definitions WHERE id = ?',
        [id]
      );
      if (defs.length === 0) {
        await connection.rollback();
        return false;
      }
      const moduleKey = defs[0].module_key;
      const hasCondition = defs[0].condition && String(defs[0].condition).trim() !== '';

      // 无条件（默认）流程启用时，禁用同模块其他无条件流程，避免默认冲突
      if (!hasCondition) {
        await connection.execute(
          "UPDATE workflow_definitions SET is_active = 0 WHERE module_key = ? AND (\`condition\` IS NULL OR \`condition\` = '')",
          [moduleKey]
        );
      }
      await connection.execute(
        'UPDATE workflow_definitions SET is_active = 1 WHERE id = ?',
        [id]
      );
      await connection.commit();
      return true;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async deleteDefinition(id) {
    const [result] = await pool.execute(
      'DELETE FROM workflow_definitions WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  async listDefinitions(moduleKey) {
    let sql = `SELECT id, module_key, name, version, is_active, \`condition\`, priority, created_by, created_at, updated_at
               FROM workflow_definitions`;
    const params = [];
    if (moduleKey) {
      sql += ' WHERE module_key = ?';
      params.push(moduleKey);
    }
    sql += ' ORDER BY module_key ASC, priority DESC, version DESC, id DESC';
    const [rows] = await pool.execute(sql, params);
    return rows.map(r => ({
      ...r,
      nodes_json: parseJson(r.nodes_json, []),
      edges_json: parseJson(r.edges_json, [])
    }));
  }

  async getDefinition(id) {
    const [rows] = await pool.execute(
      `SELECT id, module_key, name, version, is_active, \`condition\`, priority, nodes_json, edges_json, created_by, created_at, updated_at
       FROM workflow_definitions WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    r.nodes_json = parseJson(r.nodes_json, []);
    r.edges_json = parseJson(r.edges_json, []);
    return r;
  }

  // ---------- 变量 ----------

  async loadInstanceVars(connection, instanceId) {
    const [rows] = await connection.execute(
      'SELECT var_name, var_value FROM workflow_instance_vars WHERE instance_id = ? ORDER BY id ASC',
      [instanceId]
    );
    const vars = {};
    rows.forEach(r => {
      vars[r.var_name] = parseJson(r.var_value, null);
    });
    return vars;
  }

  async saveInstanceVars(connection, instanceId, vars) {
    for (const [name, value] of Object.entries(vars)) {
      await connection.execute(
        `INSERT INTO workflow_instance_vars (instance_id, var_name, var_value)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE var_value = VALUES(var_value)`,
        [instanceId, name, safeJson(value)]
      );
    }
  }

  // ---------- 流程启动 / 路由 ----------

  async startInstance({ definition_id, module_key, business_key, payload, created_by }) {
    let definition;
    if (definition_id) {
      definition = await this.getDefinition(definition_id);
    } else if (module_key) {
      definition = await this.getActiveDefinition(module_key, { payload });
    }
    if (!definition) {
      throw new Error('未找到有效的流程定义');
    }

    const graph = buildGraph(definition);
    const startNode = findStartNode(graph);
    if (!startNode) {
      throw new Error('流程定义缺少开始节点');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const payloadJson = safeJson(payload);
      const [insResult] = await connection.execute(
        `INSERT INTO workflow_instances
         (definition_id, business_key, status, current_node_ids, payload_json, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [definition.id, business_key, 'running', safeJson([]), payloadJson, created_by]
      );
      const instanceId = insResult.insertId;

      const vars = {};
      await this.saveInstanceVars(connection, instanceId, vars);

      const nextNodeIds = graph.outgoing.get(startNode.id).map(e => e.target);
      await this.advance(connection, instanceId, definition, nextNodeIds, payload, vars);

      await connection.commit();

      const [instanceRows] = await connection.execute(
        'SELECT * FROM workflow_instances WHERE id = ?',
        [instanceId]
      );
      return instanceRows[0];
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async advance(connection, instanceId, definition, nodeIds, payload, vars) {
    const graph = buildGraph(definition);
    const queue = Array.from(new Set(nodeIds));
    const activeApprovalNodes = [];
    const reachedEnd = [];
    const visited = new Set();

    while (queue.length) {
      const nid = queue.shift();
      if (visited.has(nid)) continue;
      visited.add(nid);

      const node = graph.nodeMap.get(nid);
      if (!node) continue;

      if (node.type === 'start') {
        queue.push(...graph.outgoing.get(nid).map(e => e.target));
      } else if (node.type === 'condition') {
        const result = evaluateExpression(node.config?.condition, { payload, vars });
        const edges = graph.outgoing.get(nid);
        const matched = edges.filter(e => {
          const label = (e.label || '').toLowerCase();
          if (result) return label === 'true' || label === '';
          return label === 'false';
        });
        if (matched.length === 0 && edges.length > 0) {
          // 默认走第一条连线
          queue.push(edges[0].target);
        } else {
          queue.push(...matched.map(e => e.target));
        }
      } else if (node.type === 'approval') {
        activeApprovalNodes.push(nid);
      } else if (node.type === 'end') {
        reachedEnd.push(nid);
      }
    }

    await connection.execute(
      'UPDATE workflow_instances SET current_node_ids = ? WHERE id = ?',
      [safeJson(activeApprovalNodes), instanceId]
    );

    // 创建审批任务
    for (const nid of activeApprovalNodes) {
      const node = graph.nodeMap.get(nid);
      await this.createNodeTasks(connection, instanceId, node, vars);
    }

    // 如果没有待审批节点，说明流程到达终点
    if (activeApprovalNodes.length === 0) {
      const finalStatus = reachedEnd.length > 0 ? 'completed' : 'rejected';
      await connection.execute(
        'UPDATE workflow_instances SET status = ? WHERE id = ?',
        [finalStatus, instanceId]
      );
    }
  }

  async createNodeTasks(connection, instanceId, node, vars = {}) {
    const cfg = node.config || {};
    const rawAssignees = Array.isArray(cfg.assignees) ? cfg.assignees.filter(Boolean) : [];

    // 解析动态审批人：[变量:xxx] 读流程变量，[部门经理] 读发起人直属上级
    const assignees = [];
    for (const raw of rawAssignees) {
      const resolved = await this.resolveAssignee(connection, instanceId, raw, vars);
      if (resolved) assignees.push(resolved);
    }
    if (assignees.length === 0) {
      // 未指定审批人（或动态解析全部失败）时默认发给发起人（避免流程卡死）
      const [rows] = await connection.execute(
        'SELECT created_by FROM workflow_instances WHERE id = ?',
        [instanceId]
      );
      assignees.push(rows[0]?.created_by || 'admin');
    }

    const dueTime = cfg.dueHours ? addHours(now(), cfg.dueHours) : null;

    for (const assignee of assignees) {
      await connection.execute(
        `INSERT INTO workflow_tasks
         (instance_id, node_id, node_name, assignee_username, status, due_time)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [instanceId, node.id, node.name || node.id, assignee, 'pending', dueTime]
      );
    }
  }

  // 解析单个审批人配置：普通用户名原样返回；[变量:xxx]/[部门经理] 动态解析；失败返回 null
  async resolveAssignee(connection, instanceId, raw, vars) {
    const str = String(raw).trim();

    // [变量:xxx] → 从流程变量解析（变量由前置节点审批表单写入）
    const varMatch = str.match(/^\[变量[:：]\s*(.+)\]$/);
    if (varMatch) {
      const varName = varMatch[1].trim();
      const value = vars[varName];
      if (value) {
        console.log(`[WorkflowEngine] 动态审批人 [变量:${varName}] → ${value}`);
        return String(value);
      }
      console.warn(`[WorkflowEngine] 动态审批人 [变量:${varName}] 未解析到值`);
      return null;
    }

    // [部门经理] → 发起人的直属上级（users.direct_manager_username）
    if (str === '[部门经理]') {
      const [rows] = await connection.execute(
        `SELECT u.direct_manager_username
         FROM workflow_instances i
         JOIN users u ON u.username = i.created_by
         WHERE i.id = ?`,
        [instanceId]
      );
      const mgr = rows[0]?.direct_manager_username;
      if (mgr) {
        console.log(`[WorkflowEngine] 动态审批人 [部门经理] → ${mgr}`);
        return mgr;
      }
      console.warn('[WorkflowEngine] 发起人未配置直属上级，[部门经理] 解析失败');
      return null;
    }

    return str;
  }

  // ---------- 任务处理 ----------

  async getTask(taskId) {
    const [rows] = await pool.execute(
      `SELECT t.*, i.definition_id, i.business_key, i.payload_json, i.status as instance_status, i.current_node_ids
       FROM workflow_tasks t
       JOIN workflow_instances i ON t.instance_id = i.id
       WHERE t.id = ?`,
      [taskId]
    );
    if (rows.length === 0) return null;
    const task = rows[0];
    task.payload = parseJson(task.payload_json, {});
    task.current_node_ids = parseJson(task.current_node_ids, []);
    return task;
  }

  async completeTask(taskId, { action, comment = '', completed_by, variables = {} }) {
    if (!['approve', 'reject'].includes(action)) {
      throw new Error('action 必须是 approve 或 reject');
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [taskRows] = await connection.execute(
        `SELECT t.*, i.definition_id, i.business_key, i.payload_json, i.status as instance_status, i.current_node_ids, d.module_key
         FROM workflow_tasks t
         JOIN workflow_instances i ON t.instance_id = i.id
         JOIN workflow_definitions d ON i.definition_id = d.id
         WHERE t.id = ? FOR UPDATE`,
        [taskId]
      );
      if (taskRows.length === 0) throw new Error('任务不存在');
      const task = taskRows[0];
      console.log(`[WorkflowEngine] completeTask 读取任务 #${taskId} status=${task.status} instance_status=${task.instance_status}`);
      if (task.status !== 'pending') throw new Error('任务已处理');
      if (task.instance_status !== 'running') throw new Error('流程实例已结束');
      // 只有该任务的审批人本人可以处理，防止越权审批他人任务
      if (completed_by && task.assignee_username !== completed_by) {
        throw new Error('无权处理该任务：您不是该任务的审批人');
      }

      const instanceId = task.instance_id;
      const definition = await this.getDefinition(task.definition_id);
      const graph = buildGraph(definition);
      const node = graph.nodeMap.get(task.node_id);
      if (!node) throw new Error('流程节点不存在');

      const payload = parseJson(task.payload_json, {});
      const vars = await this.loadInstanceVars(connection, instanceId);

      // 保存流程变量更新
      Object.assign(vars, variables);
      await this.saveInstanceVars(connection, instanceId, vars);

      // 更新当前任务
      await connection.execute(
        `UPDATE workflow_tasks
         SET status = ?, action = ?, comment = ?, completed_at = ?
         WHERE id = ?`,
        [action === 'approve' ? 'completed' : 'rejected', action, comment, now(), taskId]
      );
      await connection.execute(
        `INSERT INTO workflow_task_history
         (task_id, instance_id, node_id, node_name, assignee_username, action, comment, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [taskId, instanceId, task.node_id, task.node_name, completed_by, action, comment, now()]
      );

      // 通知业务模块：单个任务已完成（节点表单数据随 variables 传递，供业务表同步）
      await this.invokeHook(definition.module_key, 'onTaskComplete', {
        instance: await this.getInstance(connection, instanceId),
        task,
        action,
        comment,
        variables: vars
      });

      // 判断审批节点是否达成最终结论
      const nodeResult = await this.resolveNodeResult(connection, instanceId, node);
      if (!nodeResult.decided) {
        await connection.commit();
        console.log(`[WorkflowEngine] 任务 ${taskId} 已处理，节点 ${node.id} 等待其他审批人`);
        return { taskId, nodeStatus: 'waiting' };
      }

      // 节点已决定：取消同节点其他待办
      await connection.execute(
        `UPDATE workflow_tasks
         SET status = 'cancelled'
         WHERE instance_id = ? AND node_id = ? AND status = 'pending'`,
        [instanceId, node.id]
      );
      await connection.execute(
        `INSERT INTO workflow_task_history
         (task_id, instance_id, node_id, node_name, assignee_username, action, comment, created_at)
         SELECT id, instance_id, node_id, node_name, assignee_username, 'cancel', '节点已达成结论，任务取消', ?
         FROM workflow_tasks
         WHERE instance_id = ? AND node_id = ? AND status = 'cancelled'`,
        [now(), instanceId, node.id]
      );

      // 根据结论路由到下一节点
      const edgeLabel = nodeResult.result === 'approve' ? 'approve' : 'reject';
      const nextEdges = graph.outgoing.get(node.id).filter(e => {
        const label = (e.label || '').toLowerCase();
        return label === edgeLabel || (edgeLabel === 'approve' && label === '');
      });
      if (nextEdges.length === 0) {
        // 没有后续连线，流程结束
        const finalStatus = nodeResult.result === 'approve' ? 'completed' : 'rejected';
        await connection.execute(
          'UPDATE workflow_instances SET status = ? WHERE id = ?',
          [finalStatus, instanceId]
        );
        await this.invokeHook(definition.module_key, nodeResult.result === 'approve' ? 'onProcessFinish' : 'onTaskReject', {
          instance: await this.getInstance(connection, instanceId),
          result: finalStatus
        });
        await connection.commit();
        console.log(`[WorkflowEngine] 任务 ${taskId} 处理完成，流程结束，状态: ${finalStatus}`);
        return { taskId, instanceStatus: finalStatus };
      }

      const nextNodeIds = nextEdges.map(e => e.target);
      await this.advance(connection, instanceId, definition, nextNodeIds, payload, vars);

      const instance = await this.getInstance(connection, instanceId);
      if (instance.status === 'completed') {
        await this.invokeHook(definition.module_key, 'onProcessFinish', { instance, result: 'completed' });
      } else if (instance.status === 'rejected') {
        await this.invokeHook(definition.module_key, 'onTaskReject', { instance, task, result: 'rejected' });
      }

      await connection.commit();
      console.log(`[WorkflowEngine] 任务 ${taskId} 处理完成，实例 ${instanceId} 状态: ${instance.status}`);
      return { taskId, instanceStatus: instance.status };
    } catch (err) {
      await connection.rollback();
      console.error(`[WorkflowEngine] 任务 ${taskId} 处理失败:`, err.message);
      throw err;
    } finally {
      connection.release();
    }
  }

  async resolveNodeResult(connection, instanceId, node) {
    const cfg = node.config || {};
    const mode = cfg.approvalMode || 'all';
    const [rows] = await connection.execute(
      `SELECT status, action FROM workflow_tasks
       WHERE instance_id = ? AND node_id = ?`,
      [instanceId, node.id]
    );
    if (rows.length === 0) return { decided: false };

    const total = rows.length;
    const completed = rows.filter(r => r.status !== 'pending').length;
    const approved = rows.filter(r => r.action === 'approve' || (r.status === 'completed' && r.action === 'approve')).length;
    const rejected = rows.filter(r => r.action === 'reject' || r.status === 'rejected').length;

    if (mode === 'any') {
      if (approved > 0) return { decided: true, result: 'approve' };
      if (rejected === total) return { decided: true, result: 'reject' };
      return { decided: false };
    }

    if (mode === 'ratio') {
      const ratio = parseFloat(cfg.ratio);
      if (!isNaN(ratio) && approved / total >= ratio) {
        return { decided: true, result: 'approve' };
      }
      if (completed === total) {
        return { decided: true, result: rejected > 0 ? 'reject' : 'approve' };
      }
      return { decided: false };
    }

    // 默认 all
    if (rejected > 0) return { decided: true, result: 'reject' };
    if (approved === total) return { decided: true, result: 'approve' };
    return { decided: false };
  }

  async transferTask(taskId, { new_assignee, comment = '', transferred_by }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [taskRows] = await connection.execute(
        `SELECT t.*, i.status as instance_status
         FROM workflow_tasks t
         JOIN workflow_instances i ON t.instance_id = i.id
         WHERE t.id = ? FOR UPDATE`,
        [taskId]
      );
      if (taskRows.length === 0) throw new Error('任务不存在');
      const task = taskRows[0];
      if (task.status !== 'pending') throw new Error('任务已处理');
      if (task.instance_status !== 'running') throw new Error('流程实例已结束');

      await connection.execute(
        `UPDATE workflow_tasks
         SET status = ?, action = ?, comment = ?, completed_at = ?
         WHERE id = ?`,
        ['transferred', 'transfer', comment, now(), taskId]
      );
      await connection.execute(
        `INSERT INTO workflow_task_history
         (task_id, instance_id, node_id, node_name, assignee_username, action, comment, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [taskId, task.instance_id, task.node_id, task.node_name, transferred_by, 'transfer', `转交给 ${new_assignee}`, now()]
      );

      await connection.execute(
        `INSERT INTO workflow_tasks
         (instance_id, node_id, node_name, assignee_username, status, due_time)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [task.instance_id, task.node_id, task.node_name, new_assignee, 'pending', task.due_time]
      );

      await connection.commit();
      return { taskId, transferred_to: new_assignee };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async recallInstance(instanceId, { recalled_by, comment = '' }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [insRows] = await connection.execute(
        `SELECT i.*, d.module_key
         FROM workflow_instances i
         JOIN workflow_definitions d ON i.definition_id = d.id
         WHERE i.id = ? AND i.status = 'running' FOR UPDATE`,
        [instanceId]
      );
      if (insRows.length === 0) throw new Error('流程实例不存在或已结束');
      const instance = insRows[0];

      await connection.execute(
        "UPDATE workflow_instances SET status = 'recalled' WHERE id = ?",
        [instanceId]
      );
      await connection.execute(
        `UPDATE workflow_tasks SET status = 'cancelled' WHERE instance_id = ? AND status = 'pending'`,
        [instanceId]
      );
      await connection.execute(
        `INSERT INTO workflow_task_history
         (task_id, instance_id, node_id, node_name, assignee_username, action, comment, created_at)
         SELECT id, instance_id, node_id, node_name, ?, 'recall', ?, ?
         FROM workflow_tasks
         WHERE instance_id = ? AND status = 'cancelled'`,
        [recalled_by, comment, now(), instanceId]
      );

      await this.invokeHook(instance.module_key, 'onProcessFinish', {
        instance: await this.getInstance(connection, instanceId),
        result: 'recalled'
      });

      await connection.commit();
      return { instanceId, status: 'recalled' };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  async getInstance(connection, instanceId) {
    const conn = connection || pool;
    const [rows] = await conn.execute(
      `SELECT i.*, d.module_key, d.name as definition_name, d.version
       FROM workflow_instances i
       JOIN workflow_definitions d ON i.definition_id = d.id
       WHERE i.id = ?`,
      [instanceId]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    r.payload = parseJson(r.payload_json, {});
    r.current_node_ids = parseJson(r.current_node_ids, []);
    // 附带流程变量（含各节点审批表单数据），供详情展示与业务同步使用
    r.vars = await this.loadInstanceVars(conn, instanceId);
    return r;
  }

  async listInstances({ module_key, business_key, status, limit = 100, offset = 0 }) {
    const conditions = [];
    const params = [];
    if (module_key) { conditions.push('d.module_key = ?'); params.push(module_key); }
    if (business_key) { conditions.push('i.business_key = ?'); params.push(business_key); }
    if (status) { conditions.push('i.status = ?'); params.push(status); }

    let sql = `SELECT i.*, d.module_key, d.name as definition_name, d.version
               FROM workflow_instances i
               JOIN workflow_definitions d ON i.definition_id = d.id`;
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY i.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await pool.execute(sql, params);
    return rows.map(r => {
      r.payload = parseJson(r.payload_json, {});
      r.current_node_ids = parseJson(r.current_node_ids, []);
      return r;
    });
  }

  // 查询指定用户发起的流程实例（含当前待审批节点名称），用于“我提交的审批”
  async getMyInstances(username, { limit = 100 } = {}) {
    const [rows] = await pool.execute(
      `SELECT i.*, d.module_key, d.name AS definition_name, d.version
       FROM workflow_instances i
       JOIN workflow_definitions d ON i.definition_id = d.id
       WHERE i.created_by = ?
       ORDER BY i.updated_at DESC
       LIMIT ?`,
      [username, limit]
    );
    const instances = rows.map(r => {
      r.payload = parseJson(r.payload_json, {});
      r.current_node_ids = parseJson(r.current_node_ids, []);
      return r;
    });
    if (instances.length === 0) return instances;

    // 批量查询这些实例的待办任务，汇总当前节点名称
    const ids = instances.map(i => i.id);
    const placeholders = ids.map(() => '?').join(',');
    const [taskRows] = await pool.execute(
      `SELECT instance_id, node_name FROM workflow_tasks
       WHERE status = 'pending' AND instance_id IN (${placeholders})`,
      ids
    );
    const nodeMap = {};
    taskRows.forEach(t => {
      if (!nodeMap[t.instance_id]) nodeMap[t.instance_id] = [];
      if (t.node_name && !nodeMap[t.instance_id].includes(t.node_name)) {
        nodeMap[t.instance_id].push(t.node_name);
      }
    });
    instances.forEach(i => { i.current_node_names = nodeMap[i.id] || []; });
    return instances;
  }

  async getInstanceHistory(instanceId) {
    const [rows] = await pool.execute(
      `SELECT h.*, t.assignee_username as original_assignee
       FROM workflow_task_history h
       LEFT JOIN workflow_tasks t ON h.task_id = t.id
       WHERE h.instance_id = ?
       ORDER BY h.created_at ASC`,
      [instanceId]
    );
    return rows;
  }

  async getTasksByAssignee(assignee, status = 'pending') {
    const [rows] = await pool.execute(
      `SELECT t.*, i.business_key, i.payload_json, i.status as instance_status, d.module_key, d.name as definition_name, d.nodes_json
       FROM workflow_tasks t
       JOIN workflow_instances i ON t.instance_id = i.id
       JOIN workflow_definitions d ON i.definition_id = d.id
       WHERE t.assignee_username = ? AND t.status = ?
       ORDER BY t.created_at DESC`,
      [assignee, status]
    );
    console.log(`[WorkflowEngine] getTasksByAssignee assignee=${assignee} status=${status} count=${rows.length} ids=${rows.map(r => r.id).join(',')}`);
    return rows.map(r => this.attachNodeConfig(r));
  }

  async getAllPendingTasks({ excludeCreatedBy } = {}) {
    let sql = `SELECT t.*, i.business_key, i.payload_json, i.status as instance_status, i.created_by as instance_created_by, d.module_key, d.name as definition_name, d.nodes_json
               FROM workflow_tasks t
               JOIN workflow_instances i ON t.instance_id = i.id
               JOIN workflow_definitions d ON i.definition_id = d.id
               WHERE t.status = 'pending'`;
    const params = [];
    // 排除当前用户自己发起的流程任务：自己提交的审批只在"我提交的审批"中展示
    if (excludeCreatedBy) {
      sql += ' AND i.created_by != ?';
      params.push(excludeCreatedBy);
    }
    sql += ' ORDER BY t.created_at DESC';
    const [rows] = await pool.execute(sql, params);
    console.log(`[WorkflowEngine] getAllPendingTasks count=${rows.length} ids=${rows.map(r => r.id).join(',')}`);
    return rows.map(r => this.attachNodeConfig(r));
  }

  // 为任务行附加所属节点的配置（含 formFields 表单定义），并移除全量节点数据以减小响应体积
  attachNodeConfig(taskRow) {
    taskRow.payload = parseJson(taskRow.payload_json, {});
    const nodes = parseJson(taskRow.nodes_json, []);
    const node = nodes.find(n => n.id === taskRow.node_id);
    taskRow.node_config = node ? (node.config || {}) : {};
    delete taskRow.nodes_json;
    return taskRow;
  }

  async getPendingTaskCount(assignee) {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM workflow_tasks WHERE assignee_username = ? AND status = 'pending'`,
      [assignee]
    );
    return rows[0]?.cnt || 0;
  }

  async getTasksByInstance(instanceId) {
    const [rows] = await pool.execute(
      `SELECT * FROM workflow_tasks WHERE instance_id = ? ORDER BY created_at ASC`,
      [instanceId]
    );
    return rows;
  }

  async invokeHook(moduleKey, hookName, data) {
    try {
      const hook = this.hooks[moduleKey]?.[hookName];
      if (typeof hook === 'function') {
        await hook(data);
      }
    } catch (e) {
      console.error(`工作流钩子 ${moduleKey}.${hookName} 执行失败:`, e.message);
    }
  }

  // ---------- 超时提醒 ----------

  startTimeoutCheck(intervalMs = 5 * 60 * 1000) {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(async () => {
      try {
        await this.scanOverdueTasks();
      } catch (e) {
        console.error('扫描审批超时任务失败:', e.message);
      }
    }, intervalMs);
  }

  stopTimeoutCheck() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async scanOverdueTasks() {
    const [rows] = await pool.execute(
      `SELECT t.*, i.business_key, d.module_key
       FROM workflow_tasks t
       JOIN workflow_instances i ON t.instance_id = i.id
       JOIN workflow_definitions d ON i.definition_id = d.id
       WHERE t.status = 'pending' AND t.due_time IS NOT NULL
         AND t.due_time < NOW() AND t.is_reminded = 0`
    );
    for (const task of rows) {
      try {
        await this.sendReminder(task);
        await pool.execute(
          'UPDATE workflow_tasks SET is_reminded = 1 WHERE id = ?',
          [task.id]
        );
      } catch (e) {
        console.error(`发送审批提醒失败 task=${task.id}:`, e.message);
      }
    }
  }
}

module.exports = { WorkflowEngine, evaluateExpression };
