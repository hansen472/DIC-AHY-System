/**
 * 单独导入「用户培训记录个人汇总」模板
 *
 * 执行方式：
 *   node scripts/migrate-user-training-summary.js
 *
 * 说明：
 * - 只处理 renderUserTrainingSummary 一个模板
 * - 不导入全局 CSS，不影响其他模板数据
 * - 如数据库中已存在该模板，会更新其 1.0.0 版本代码并重新激活
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pool } = require('../db-config');

const TEMPLATES_JS_PATH = path.join(__dirname, '..', 'templates', 'print-templates.js');

const FUNC_NAME = 'renderUserTrainingSummary';
const TEMPLATE_KEY = 'usertrainingsummary';
const TEMPLATE_NAME = '用户培训记录个人汇总 — SOR-HR-010';
const SORT_ORDER = 26;

/**
 * 使用 vm 从源码中提取函数体
 * 比正则/大括号计数更健壮，可正确处理正则字面量、模板字符串等
 */
function extractFunction(code, funcName) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(code, context);

  const fn = context[funcName];
  if (typeof fn !== 'function') {
    throw new Error(`未找到函数：${funcName}`);
  }

  return fn.toString();
}

async function migrateSingleTemplate(connection) {
  const jsCode = fs.readFileSync(TEMPLATES_JS_PATH, 'utf8');
  const funcCode = extractFunction(jsCode, FUNC_NAME);

  // 1. 插入或更新模板定义
  const [templateRows] = await connection.execute(
    'SELECT id FROM templates WHERE template_key = ?',
    [TEMPLATE_KEY]
  );

  let templateId;
  if (templateRows.length > 0) {
    templateId = templateRows[0].id;
    await connection.execute(
      'UPDATE templates SET render_function_name = ?, name = ?, sort_order = ?, is_active = 1, updated_at = NOW() WHERE id = ?',
      [FUNC_NAME, TEMPLATE_NAME, SORT_ORDER, templateId]
    );
    console.log('已更新模板定义：' + TEMPLATE_NAME);
  } else {
    const [result] = await connection.execute(
      'INSERT INTO templates (template_key, render_function_name, name, sort_order, is_active) VALUES (?, ?, ?, ?, 1)',
      [TEMPLATE_KEY, FUNC_NAME, TEMPLATE_NAME, SORT_ORDER]
    );
    templateId = result.insertId;
    console.log('已插入模板定义：' + TEMPLATE_NAME);
  }

  // 2. 插入或更新 1.0.0 版本
  const [versionRows] = await connection.execute(
    'SELECT id FROM template_versions WHERE template_id = ? AND version = ?',
    [templateId, '1.0.0']
  );

  let versionId;
  if (versionRows.length > 0) {
    versionId = versionRows[0].id;
    await connection.execute(
      'UPDATE template_versions SET js_code = ?, reason = ?, remarks = ?, is_active = 1, updated_at = NOW() WHERE id = ?',
      [funcCode, '单独导入', '从 print-templates.js 单独迁移用户培训记录个人汇总模板', versionId]
    );
    console.log('已更新版本 1.0.0');
  } else {
    const [result] = await connection.execute(
      'INSERT INTO template_versions (template_id, version, js_code, reason, remarks, is_active, created_by) VALUES (?, ?, ?, ?, ?, 1, ?)',
      [templateId, '1.0.0', funcCode, '单独导入', '从 print-templates.js 单独迁移用户培训记录个人汇总模板', 'system']
    );
    versionId = result.insertId;
    console.log('已插入版本 1.0.0');
  }

  // 3. 确保只有当前版本生效
  await connection.execute(
    'UPDATE template_versions SET is_active = 0 WHERE template_id = ? AND id != ?',
    [templateId, versionId]
  );
  await connection.execute(
    'UPDATE templates SET current_version_id = ? WHERE id = ?',
    [versionId, templateId]
  );
}

async function main() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await migrateSingleTemplate(connection);
    await connection.commit();
    console.log('\n用户培训记录个人汇总模板导入完成');
  } catch (err) {
    await connection.rollback();
    console.error('导入失败：', err);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
