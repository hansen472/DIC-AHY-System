/**
 * 工作流待办审批人修复脚本（修复动态审批人解析失败的存量待办）
 *
 * 背景：流程节点配置了 [变量:xxx] / [部门经理] 动态审批人，但任务创建时
 * 服务器运行的还是旧版引擎（不解析占位符），导致待办的 assignee_username
 * 存成了字面量 "[变量:handler]"，或因变量未写入而回退成了发起人。
 * 症状：流程显示停在处理人节点，但处理人"我的待办"中看不到任务。
 *
 * 用法（在服务器上、项目目录下执行）：
 *   node repair-workflow-assignees.js            # 预览：只报告，不修改
 *   node repair-workflow-assignees.js --apply    # 修复：把坏待办重新指派给解析出的审批人
 *
 * 注意：必须先同步最新代码并重启 node 服务再执行本脚本，
 *       否则后续审批产生的待办仍会损坏。
 */
const { pool } = require('./db-config');
const { WorkflowEngine } = require('./workflow-engine');

const APPLY = process.argv.includes('--apply');
const engine = new WorkflowEngine({});
// 连接适配器：resolveAssignee 的 [部门经理] 分支直接走连接池
const connAdapter = { execute: (sql, params) => pool.execute(sql, params) };

// 与引擎 resolveAssignee 一致的占位符判断
function isPlaceholder(s) {
  return /^\[(变量[:：]\s*.+|部门经理)\]$/.test(String(s || '').trim());
}

function parseVarValue(text) {
  try { return text ? JSON.parse(text) : null; } catch (e) { return text; }
}

(async () => {
  console.log(APPLY ? '=== 修复模式（--apply）：将更新数据库 ===\n' : '=== 预览模式：仅报告，不修改（加 --apply 执行修复） ===\n');

  try {
    // 1. 运行中实例的全部待办任务（附节点定义，用于判断动态审批人配置）
    const [tasks] = await pool.execute(
      `SELECT t.id AS task_id, t.instance_id, t.node_id, t.node_name, t.assignee_username,
              i.created_by, i.business_key, i.status AS instance_status,
              d.name AS def_name, d.nodes_json
       FROM workflow_tasks t
       JOIN workflow_instances i ON t.instance_id = i.id
       JOIN workflow_definitions d ON i.definition_id = d.id
       WHERE t.status = 'pending' AND i.status = 'running'
       ORDER BY t.instance_id, t.id`
    );
    if (tasks.length === 0) {
      console.log('没有运行中实例的待办任务，无需修复。');
      return;
    }

    // 2. 已被"转交"过的任务不处理（审批人是管理员有意变更的）
    const taskIds = tasks.map(t => t.task_id);
    const [histRows] = await pool.execute(
      `SELECT DISTINCT task_id FROM workflow_task_history
       WHERE action = 'transfer' AND task_id IN (${taskIds.map(() => '?').join(',')})`,
      taskIds
    );
    const transferred = new Set(histRows.map(h => h.task_id));

    // 3. 逐任务比对：当前审批人 vs 按当前流程变量重新解析出的审批人
    const varsCache = {};
    const fixActions = [];   // { taskId, from, to }
    const manualItems = [];  // 无法自动修复、需人工处理
    let checked = 0;

    for (const t of tasks) {
      const nodes = JSON.parse(t.nodes_json || '[]');
      const node = nodes.find(n => n.id === t.node_id);
      const assignees = (node && node.config && Array.isArray(node.config.assignees))
        ? node.config.assignees.map(s => String(s).trim()).filter(Boolean)
        : [];
      if (!assignees.some(isPlaceholder)) continue; // 固定审批人节点，跳过
      if (transferred.has(t.task_id)) continue;     // 已转交，跳过
      checked++;

      // 加载该实例的流程变量（缓存）
      if (!varsCache[t.instance_id]) {
        const [rows] = await pool.execute(
          'SELECT var_name, var_value FROM workflow_instance_vars WHERE instance_id = ? ORDER BY id ASC',
          [t.instance_id]
        );
        const v = {};
        rows.forEach(r => { v[r.var_name] = parseVarValue(r.var_value); });
        varsCache[t.instance_id] = v;
      }
      const vars = varsCache[t.instance_id];

      // 用生产引擎的解析逻辑重新解析每个审批人配置
      const resolved = [];
      let unresolvedPlaceholders = [];
      for (const raw of assignees) {
        if (isPlaceholder(raw)) {
          const r = await engine.resolveAssignee(connAdapter, t.instance_id, raw, vars);
          if (r) resolved.push(r);
          else unresolvedPlaceholders.push(raw);
        } else {
          resolved.push(raw);
        }
      }

      const tag = `任务#${t.task_id} [${t.node_name}] 实例#${t.instance_id} ${t.business_key || ''}`;

      // 情况一：assignee 本身就是字面量占位符（旧引擎产物）
      if (isPlaceholder(t.assignee_username)) {
        if (resolved.length > 0) {
          const target = resolved.find(r => !isPlaceholder(r));
          if (target) {
            fixActions.push({ taskId: t.task_id, from: t.assignee_username, to: target, tag });
            console.log(`🔧 待修复 ${tag}：审批人是字面量 ${t.assignee_username} → 应为 ${target}`);
          }
        } else {
          manualItems.push({ tag, reason: `审批人是字面量 ${t.assignee_username}，且流程变量缺失（${unresolvedPlaceholders.join('、')} 未解析到值）` });
          console.log(`⚠️ 需人工 ${tag}：审批人是字面量 ${t.assignee_username}，但变量至今无值，无法自动解析`);
        }
        continue;
      }

      // 情况二：审批人不在解析结果中（典型：变量缺失时回退成发起人）
      if (resolved.length > 0 && !resolved.includes(t.assignee_username)) {
        // 仅当当前审批人恰好是发起人（回退特征）时自动修复，其他差异只报告
        if (t.assignee_username === t.created_by) {
          const target = resolved.find(r => !isPlaceholder(r));
          if (target) {
            fixActions.push({ taskId: t.task_id, from: t.assignee_username + '（发起人回退）', to: target, tag });
            console.log(`🔧 待修复 ${tag}：审批人回退成了发起人 ${t.assignee_username} → 应为 ${target}`);
          }
        } else {
          manualItems.push({ tag, reason: `当前审批人 ${t.assignee_username} 与解析结果 [${resolved.join('、')}] 不一致` });
          console.log(`⚠️ 需人工 ${tag}：审批人 ${t.assignee_username} 与解析结果 [${resolved.join('、')}] 不一致（未自动修改）`);
        }
        continue;
      }

      // 情况三：回退成发起人且变量至今无值（配置/数据问题，需人工补填处理人）
      if (unresolvedPlaceholders.length > 0 && t.assignee_username === t.created_by) {
        manualItems.push({ tag, reason: `动态审批人 ${unresolvedPlaceholders.join('、')} 无变量值，回退给了发起人；请确认前置节点表单是否填写了处理人` });
        console.log(`⚠️ 需人工 ${tag}：${unresolvedPlaceholders.join('、')} 无变量值，待办回退给了发起人 ${t.assignee_username}`);
        continue;
      }

      console.log(`✅ 正常   ${tag}：审批人 ${t.assignee_username}`);
    }

    if (checked === 0) {
      console.log('\n没有发现配置动态审批人的待办任务，无需修复。');
      return;
    }

    // 4. 执行修复（校验目标用户存在后更新）
    if (fixActions.length > 0) {
      const names = [...new Set(fixActions.map(f => f.to))];
      const [userRows] = await pool.execute(
        `SELECT username FROM users WHERE username IN (${names.map(() => '?').join(',')})`,
        names
      );
      const validUsers = new Set(userRows.map(u => u.username));

      console.log(`\n=== 共 ${fixActions.length} 条待修复${APPLY ? '，开始修复' : '（预览）'} ===`);
      let fixed = 0;
      for (const f of fixActions) {
        if (!validUsers.has(f.to)) {
          console.log(`❌ 跳过 ${f.tag}：目标审批人 ${f.to} 不在用户表中`);
          continue;
        }
        if (APPLY) {
          const [result] = await pool.execute(
            'UPDATE workflow_tasks SET assignee_username = ? WHERE id = ? AND status = ?',
            [f.to, f.taskId, 'pending']
          );
          if (result.affectedRows === 1) {
            fixed++;
            console.log(`✔ 已修复 任务#${f.taskId}：${f.from} → ${f.to}`);
          } else {
            console.log(`❌ 修复失败 任务#${f.taskId}：任务已不在待处理状态`);
          }
        } else {
          console.log(`· 预览 任务#${f.taskId}：${f.from} → ${f.to}`);
        }
      }
      if (APPLY) console.log(`\n修复完成：${fixed}/${fixActions.length} 条已更新。`);
      else console.log('\n（以上为预览结果，确认无误后加 --apply 执行修复）');
    } else {
      console.log('\n没有需要自动修复的待办。');
    }

    if (manualItems.length > 0) {
      console.log(`\n=== ${manualItems.length} 条需人工处理 ===`);
      manualItems.forEach((m, i) => console.log(`${i + 1}. ${m.tag}\n   原因：${m.reason}`));
      console.log('建议：可用管理员账号在"待办审批"页把对应待办"转交"给正确的处理人。');
    }
  } catch (err) {
    console.error('执行失败:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
