/**
 * 工作流待办诊断 + 修复脚本 v2
 *
 * 背景：流程停在"等待处理人处理"，但处理人"我的待办"看不到任务。
 * 常见原因：
 *   a) 旧版引擎运行期间产生的待办，assignee_username 存成了字面量 "[变量:handler]"
 *   b) 节点未配置审批人（或动态变量当时无值），待办回退给了发起人
 *   c) 节点审批人配置的是固定人员，而不是 [变量:handler]（设计器配置缺口）
 *   d) 流程定义被中途修改，待办对应的节点已不存在（流程卡死）
 *
 * 用法（在服务器上、项目目录下执行）：
 *   node repair-workflow-assignees.js          # 诊断：打印全部运行中实例的待办明细与结论
 *   node repair-workflow-assignees.js --apply  # 诊断 + 修复可安全修复的待办
 *
 * 说明：
 *   - 修复仅重指派待办的 assignee_username，不改流程定义、不改历史记录
 *   - 已被"转交"过的待办不自动修复（那是管理员有意变更的）
 *   - 节点存在多个待办时不自动修复（避免会签场景重复指派），仅报告
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
  console.log(APPLY ? '=== 修复模式（--apply）：诊断后将更新数据库 ===\n' : '=== 诊断模式：仅报告，不修改（加 --apply 执行修复） ===\n');

  try {
    // 1. 运行中实例（含定义节点数据）
    const [instances] = await pool.execute(
      `SELECT i.id AS instance_id, i.business_key, i.created_by, i.current_node_ids,
              d.id AS def_id, d.name AS def_name, d.module_key, d.nodes_json
       FROM workflow_instances i
       LEFT JOIN workflow_definitions d ON i.definition_id = d.id
       WHERE i.status = 'running'
       ORDER BY i.id DESC`
    );
    if (instances.length === 0) {
      console.log('没有运行中的流程实例。');
      return;
    }

    // 2. 这些实例的全部待办任务
    const insIds = instances.map(i => i.instance_id);
    const [tasks] = await pool.execute(
      `SELECT t.id AS task_id, t.instance_id, t.node_id, t.node_name, t.assignee_username, t.created_at
       FROM workflow_tasks t
       WHERE t.instance_id IN (${insIds.map(() => '?').join(',')}) AND t.status = 'pending'
       ORDER BY t.instance_id, t.id`,
      insIds
    );

    // 3. 已转交的任务不自动修复
    const taskIds = tasks.map(t => t.task_id);
    const transferred = new Set();
    if (taskIds.length > 0) {
      const [histRows] = await pool.execute(
        `SELECT DISTINCT task_id FROM workflow_task_history
         WHERE action = 'transfer' AND task_id IN (${taskIds.map(() => '?').join(',')})`,
        taskIds
      );
      histRows.forEach(h => transferred.add(h.task_id));
    }

    // 4. 每个实例的流程变量（缓存）
    const varsCache = {};
    async function getVars(instanceId) {
      if (!(instanceId in varsCache)) {
        const [rows] = await pool.execute(
          'SELECT var_name, var_value FROM workflow_instance_vars WHERE instance_id = ? ORDER BY id ASC',
          [instanceId]
        );
        const v = {};
        rows.forEach(r => { v[r.var_name] = parseVarValue(r.var_value); });
        varsCache[instanceId] = v;
      }
      return varsCache[instanceId];
    }

    // 待办节点计数（同一实例同一节点的待办数，用于会签防重复修复）
    const pendingCountByNode = {};
    tasks.forEach(t => {
      const k = t.instance_id + ':' + t.node_id;
      pendingCountByNode[k] = (pendingCountByNode[k] || 0) + 1;
    });

    const fixActions = [];   // { taskId, from, to, reason }
    const manualItems = [];  // { tag, reason, advice }
    let okCount = 0;

    console.log(`运行中实例 ${instances.length} 个，待办任务 ${tasks.length} 条\n`);
    console.log('==== 待办任务明细 ====');

    for (const ins of instances) {
      const defNodes = ins.def_id ? (JSON.parse(ins.nodes_json || '[]')) : null;
      const nodeMap = new Map((defNodes || []).map(n => [n.id, n]));
      const vars = await getVars(ins.instance_id);
      const varBrief = Object.entries(vars)
        .filter(([k]) => !k.startsWith('__form_'))
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(', ') || '(无)';
      const insTag = `实例#${ins.instance_id} ${ins.business_key || ''} 【${ins.def_name || '定义缺失'}】发起人=${ins.created_by}`;

      const insTasks = tasks.filter(t => t.instance_id === ins.instance_id);
      console.log(`\n${insTag}`);
      console.log(`  流程变量: ${varBrief}`);

      if (insTasks.length === 0) {
        // 流程在跑但没有待办：检查当前节点是否"悬空"
        const curNodes = JSON.parse(ins.current_node_ids || '[]');
        if (curNodes.length > 0) {
          const names = curNodes.map(id => (nodeMap.get(id) ? nodeMap.get(id).name : id) + (nodeMap.has(id) ? '' : '(节点已不存在)'));
          manualItems.push({
            tag: insTag,
            reason: `流程停在节点 [${names.join('、')}] 但没有任何待办任务（流程定义可能被中途修改，或任务被取消）`,
            advice: '若节点已不存在：该实例无法继续审批，建议撤回后重新提交；否则可联系开发核查。'
          });
          console.log(`  ❌ 流程停在 [${names.join('、')}] 但没有待办任务（卡死）`);
        }
        continue;
      }

      for (const t of insTasks) {
        const tag = `任务#${t.task_id} 节点[${t.node_name}]`;
        const node = nodeMap.get(t.node_id);

        // 4.1 节点已不存在（定义被中途修改）
        if (!node) {
          manualItems.push({
            tag: `${tag} (${insTag})`,
            reason: `待办对应节点 ${t.node_id} 已不在当前流程定义中（定义被修改过）`,
            advice: '该待办无法正常处理。建议：发起人在"我提交的审批"撤回后重新提交；或按新定义重新配置流程。'
          });
          console.log(`  ❌ ${tag} 审批人=${t.assignee_username} → 节点已不在定义中（定义被中途修改）`);
          continue;
        }

        const rawAssignees = (node.config && Array.isArray(node.config.assignees))
          ? node.config.assignees.map(s => String(s).trim()).filter(Boolean)
          : [];
        const hasDynamic = rawAssignees.some(isPlaceholder);

        // 已转交：仅提示，不修复
        if (transferred.has(t.task_id)) {
          console.log(`  ℹ️  ${tag} 审批人=${t.assignee_username} | 节点配置=[${rawAssignees.join('、')}] → 已转交过，不自动处理`);
          continue;
        }

        // 4.2 assignee 本身是字面量占位符（旧引擎产物）
        if (isPlaceholder(t.assignee_username)) {
          const resolved = [];
          for (const raw of rawAssignees) {
            if (isPlaceholder(raw)) {
              const r = await engine.resolveAssignee(connAdapter, ins.instance_id, raw, vars);
              if (r) resolved.push(r);
            } else {
              resolved.push(raw);
            }
          }
          const target = resolved.find(r => !isPlaceholder(r));
          if (target && pendingCountByNode[ins.instance_id + ':' + t.node_id] === 1) {
            fixActions.push({ taskId: t.task_id, from: t.assignee_username, to: target, reason: '旧引擎字面量占位符' });
            console.log(`  🔧 ${tag} 审批人=${t.assignee_username} | 节点配置=[${rawAssignees.join('、')}] → 应为 ${target}（可修复）`);
          } else if (target) {
            manualItems.push({
              tag: `${tag} (${insTag})`,
              reason: `审批人是字面量 ${t.assignee_username}，应为 ${target}，但该节点有多个待办（会签），需人工确认`,
              advice: `管理员在"待办审批"页把多余待办转交/处理后，保留 ${target} 的那条。`
            });
            console.log(`  ⚠️  ${tag} 审批人=${t.assignee_username} → 应为 ${target}（多待办，需人工）`);
          } else {
            manualItems.push({
              tag: `${tag} (${insTag})`,
              reason: `审批人是字面量 ${t.assignee_username}，且流程变量无值（${rawAssignees.filter(isPlaceholder).join('、')} 未解析到）`,
              advice: '变量缺失说明前置节点表单未提交处理人（可能在旧代码时期审批）。建议撤回重新提交，或管理员把待办转交给处理人。'
            });
            console.log(`  ⚠️  ${tag} 审批人=${t.assignee_username} → 变量无值，无法自动解析`);
          }
          continue;
        }

        // 4.3 节点未配置审批人 → 任务按设计回退给了发起人（配置缺口）
        if (rawAssignees.length === 0) {
          manualItems.push({
            tag: `${tag} (${insTag})`,
            reason: `节点未配置审批人，待办回退给了发起人 ${t.assignee_username}`,
            advice: '修复步骤：① 流程设计器选中该节点，"审批人"填 [变量:handler]（须与前置节点表单的处理人字段变量名一致），保存；' +
                    '② 重新运行本脚本加 --apply，回退的待办会自动重指派给表单所选处理人。' +
                    '或：管理员直接在"待办审批"页把该待办转交给处理人。'
          });
          console.log(`  ⚠️  ${tag} 审批人=${t.assignee_username} | 节点配置审批人=空 → 配置缺口：回退给了发起人`);
          continue;
        }

        // 4.4 正常解析比对
        const resolved = [];
        const unresolved = [];
        for (const raw of rawAssignees) {
          if (isPlaceholder(raw)) {
            const r = await engine.resolveAssignee(connAdapter, ins.instance_id, raw, vars);
            if (r) resolved.push(r); else unresolved.push(raw);
          } else {
            resolved.push(raw);
          }
        }

        if (resolved.includes(t.assignee_username)) {
          okCount++;
          console.log(`  ✅ ${tag} 审批人=${t.assignee_username} | 节点配置=[${rawAssignees.join('、')}] 正常`);
          continue;
        }

        // 4.5 回退发起人：节点有动态审批人且能解析 → 可修复
        if (t.assignee_username === ins.created_by && hasDynamic && resolved.length > 0
            && pendingCountByNode[ins.instance_id + ':' + t.node_id] === 1) {
          const target = resolved.find(r => !isPlaceholder(r));
          if (target) {
            fixActions.push({ taskId: t.task_id, from: t.assignee_username + '（发起人回退）', to: target, reason: '动态审批人当时无值，回退发起人' });
            console.log(`  🔧 ${tag} 审批人=${t.assignee_username}（发起人） | 节点配置=[${rawAssignees.join('、')}] → 应为 ${target}（可修复）`);
            continue;
          }
        }

        // 4.6 审批人既不在解析结果中，也不是配置的固定审批人（定义改过）→ 单待办时可修复
        if (!rawAssignees.includes(t.assignee_username) && resolved.length > 0
            && pendingCountByNode[ins.instance_id + ':' + t.node_id] === 1) {
          const target = resolved.find(r => !isPlaceholder(r));
          if (target) {
            fixActions.push({ taskId: t.task_id, from: t.assignee_username, to: target, reason: '审批人与当前节点配置不符（定义已修改）' });
            console.log(`  🔧 ${tag} 审批人=${t.assignee_username} | 节点配置=[${rawAssignees.join('、')}] → 应为 ${target}（可修复）`);
            continue;
          }
        }

        // 4.7 其余情况：报告
        const reason = t.assignee_username === ins.created_by && hasDynamic
          ? `动态审批人 ${unresolved.join('、')||'（部分）'} 至今无变量值，待办回退给了发起人 ${t.assignee_username}`
          : `当前审批人 ${t.assignee_username} 与节点配置解析结果 [${resolved.join('、') || '无'}] 不一致${unresolved.length ? `（${unresolved.join('、')} 未解析到值）` : ''}`;
        manualItems.push({
          tag: `${tag} (${insTag})`,
          reason,
          advice: unresolved.length
            ? '变量缺失说明前置节点表单未提交处理人。建议撤回重新提交，或管理员把待办转交给处理人。'
            : '如确认配置正确，可管理员在"待办审批"页把待办转交给正确处理人。'
        });
        console.log(`  ⚠️  ${tag} 审批人=${t.assignee_username} | 节点配置=[${rawAssignees.join('、')}] | 解析=[${resolved.join('、') || '无'}] → 需人工`);
      }
    }

    // 5. 汇总 + 执行修复
    console.log('\n==== 汇总 ====');
    console.log(`正常待办: ${okCount} | 可自动修复: ${fixActions.length} | 需人工/配置处理: ${manualItems.length}`);

    if (fixActions.length > 0) {
      const names = [...new Set(fixActions.map(f => f.to))];
      const [userRows] = await pool.execute(
        `SELECT username FROM users WHERE username IN (${names.map(() => '?').join(',')})`,
        names
      );
      const validUsers = new Set(userRows.map(u => u.username));

      console.log(`\n${APPLY ? '开始修复' : '可修复清单（预览）'}：`);
      let fixed = 0;
      for (const f of fixActions) {
        if (!validUsers.has(f.to)) {
          console.log(`  ❌ 跳过 任务#${f.taskId}：目标审批人 ${f.to} 不在用户表中`);
          continue;
        }
        if (APPLY) {
          const [result] = await pool.execute(
            'UPDATE workflow_tasks SET assignee_username = ? WHERE id = ? AND status = ?',
            [f.to, f.taskId, 'pending']
          );
          if (result.affectedRows === 1) {
            fixed++;
            console.log(`  ✔ 已修复 任务#${f.taskId}（${f.reason}）：${f.from} → ${f.to}`);
          } else {
            console.log(`  ❌ 修复失败 任务#${f.taskId}：任务已不在待处理状态`);
          }
        } else {
          console.log(`  · 预览 任务#${f.taskId}（${f.reason}）：${f.from} → ${f.to}`);
        }
      }
      if (APPLY) console.log(`\n修复完成：${fixed}/${fixActions.length} 条已更新。`);
      else console.log('\n（以上为预览结果，确认无误后加 --apply 执行修复）');
    }

    if (manualItems.length > 0) {
      console.log(`\n==== 需人工/配置处理（${manualItems.length} 条） ====`);
      manualItems.forEach((m, i) => {
        console.log(`${i + 1}. ${m.tag}`);
        console.log(`   问题：${m.reason}`);
        console.log(`   建议：${m.advice}`);
      });
    }
  } catch (err) {
    console.error('执行失败:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
