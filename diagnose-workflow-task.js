/**
 * 工作流任务诊断脚本
 * 用法：node diagnose-workflow-task.js [taskId]
 * 默认查询 taskId=1
 */

const { pool } = require('./db-config');

async function main() {
  const taskId = parseInt(process.argv[2] || '1', 10);
  if (isNaN(taskId)) {
    console.error('请提供有效的任务ID，例如：node diagnose-workflow-task.js 1');
    process.exit(1);
  }

  try {
    console.log(`==== 诊断任务 #${taskId} ====\n`);

    const [taskRows] = await pool.execute(
      `SELECT t.*, i.definition_id, i.business_key, i.status as instance_status, i.current_node_ids, i.payload_json
       FROM workflow_tasks t
       JOIN workflow_instances i ON t.instance_id = i.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (taskRows.length === 0) {
      console.log('任务不存在');
      return;
    }

    const task = taskRows[0];
    console.log('--- 任务信息 ---');
    console.log('ID:', task.id);
    console.log('instance_id:', task.instance_id);
    console.log('node_id:', task.node_id);
    console.log('node_name:', task.node_name);
    console.log('assignee_username:', task.assignee_username);
    console.log('status:', task.status);
    console.log('action:', task.action);
    console.log('comment:', task.comment);
    console.log('created_at:', task.created_at);
    console.log('completed_at:', task.completed_at);
    console.log('due_time:', task.due_time);

    console.log('\n--- 关联实例信息 ---');
    console.log('definition_id:', task.definition_id);
    console.log('business_key:', task.business_key);
    console.log('instance_status:', task.instance_status);
    console.log('current_node_ids:', task.current_node_ids);

    const [historyRows] = await pool.execute(
      `SELECT h.*, t.assignee_username as original_assignee
       FROM workflow_task_history h
       LEFT JOIN workflow_tasks t ON h.task_id = t.id
       WHERE h.task_id = ?
       ORDER BY h.created_at ASC`,
      [taskId]
    );

    console.log('\n--- 任务历史 ---');
    if (historyRows.length === 0) {
      console.log('无历史记录');
    } else {
      historyRows.forEach((h, idx) => {
        console.log(`[${idx + 1}] ${h.created_at} | ${h.action} | ${h.assignee_username} | ${h.comment || ''}`);
      });
    }

    const [allTasksRows] = await pool.execute(
      `SELECT id, node_id, node_name, assignee_username, status, action, created_at, completed_at
       FROM workflow_tasks
       WHERE instance_id = ?
       ORDER BY id ASC`,
      [task.instance_id]
    );

    console.log('\n--- 同一实例的所有任务 ---');
    allTasksRows.forEach(t => {
      console.log(`#${t.id} ${t.node_name} ${t.assignee_username} status=${t.status} action=${t.action || '-'} created=${t.created_at} completed=${t.completed_at || '-'}`);
    });

    const [defRows] = await pool.execute(
      'SELECT * FROM workflow_definitions WHERE id = ?',
      [task.definition_id]
    );

    console.log('\n--- 流程定义 ---');
    if (defRows.length > 0) {
      const def = defRows[0];
      console.log('name:', def.name);
      console.log('module_key:', def.module_key);
      console.log('is_active:', def.is_active);
      console.log('nodes_json:', def.nodes_json);
      console.log('edges_json:', def.edges_json);
    }

    console.log('\n==== 诊断结束 ====');
  } catch (err) {
    console.error('诊断失败:', err.message);
  } finally {
    await pool.end();
  }
}

main();
