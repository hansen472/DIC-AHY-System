/**
 * 单模板迁移脚本：仅导入 renderTSZLCP001 (实验室报告申请 — TS-ZL-CP-001)
 *
 * 执行方式：
 *   node scripts/migrate-tszlcp001.js
 *
 * 说明：
 * - 只处理 renderTSZLCP001 这一个模板
 * - 如果已存在则更新，不存在则新建
 * - 不影响其他已有模板和版本
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../db-config');

const TEMPLATES_JS_PATH = path.join(__dirname, '..', 'templates', 'print-templates.js');

const TARGET_FUNC = 'renderTSZLCP001';
const TARGET_META = { key: 'tszlcp001', name: '实验室报告申请 — TS-ZL-CP-001', sort: 26 };

/**
 * 从源码中提取函数体
 */
function extractFunction(code, funcName) {
  const regex = new RegExp(`(function\\s+${funcName}\\s*\\([^)]*\\)\\s*\\{)`);
  const match = code.match(regex);
  if (!match) {
    throw new Error(`未找到函数：${funcName}`);
  }

  const startIndex = match.index;
  const braceStart = code.indexOf('{', startIndex);

  let depth = 0;
  let inSingleString = false;
  let inDoubleString = false;
  let inTemplate = false;
  let inSingleComment = false;
  let inMultiComment = false;
  let escapeNext = false;

  for (let i = braceStart; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1] || '';

    if (escapeNext) { escapeNext = false; continue; }
    if (inSingleComment) { if (ch === '\n') inSingleComment = false; continue; }
    if (inMultiComment) { if (ch === '*' && next === '/') { inMultiComment = false; i++; } continue; }
    if (inSingleString) { if (ch === '\\') escapeNext = true; else if (ch === "'") inSingleString = false; continue; }
    if (inDoubleString) { if (ch === '\\') escapeNext = true; else if (ch === '"') inDoubleString = false; continue; }
    if (inTemplate) { if (ch === '\\') escapeNext = true; else if (ch === '`') inTemplate = false; continue; }

    if (ch === '/' && next === '/') { inSingleComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inMultiComment = true; i++; continue; }
    if (ch === "'") { inSingleString = true; continue; }
    if (ch === '"') { inDoubleString = true; continue; }
    if (ch === '`') { inTemplate = true; continue; }

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return code.substring(startIndex, i + 1);
    }
  }

  throw new Error(`函数 ${funcName} 的大括号未闭合`);
}

async function main() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const jsCode = fs.readFileSync(TEMPLATES_JS_PATH, 'utf8');
    const funcCode = extractFunction(jsCode, TARGET_FUNC);

    // 1. 插入或更新模板定义
    const [templateRows] = await connection.execute(
      'SELECT id FROM templates WHERE template_key = ?',
      [TARGET_META.key]
    );

    let templateId;
    if (templateRows.length > 0) {
      templateId = templateRows[0].id;
      await connection.execute(
        'UPDATE templates SET render_function_name = ?, name = ?, sort_order = ?, is_active = 1, updated_at = NOW() WHERE id = ?',
        [TARGET_FUNC, TARGET_META.name, TARGET_META.sort, templateId]
      );
      console.log(`已更新模板定义：${TARGET_META.name}`);
    } else {
      const [result] = await connection.execute(
        'INSERT INTO templates (template_key, render_function_name, name, sort_order, is_active) VALUES (?, ?, ?, ?, 1)',
        [TARGET_META.key, TARGET_FUNC, TARGET_META.name, TARGET_META.sort]
      );
      templateId = result.insertId;
      console.log(`已新建模板定义：${TARGET_META.name} (id=${templateId})`);
    }

    // 2. 插入或更新版本 1.0.0
    const [versionRows] = await connection.execute(
      'SELECT id FROM template_versions WHERE template_id = ? AND version = ?',
      [templateId, '1.0.0']
    );

    let versionId;
    if (versionRows.length > 0) {
      versionId = versionRows[0].id;
      await connection.execute(
        'UPDATE template_versions SET js_code = ?, reason = ?, remarks = ?, is_active = 1, updated_at = NOW() WHERE id = ?',
        [funcCode, '初始导入', '从 print-templates.js 迁移', versionId]
      );
      console.log(`已更新版本 1.0.0`);
    } else {
      const [result] = await connection.execute(
        'INSERT INTO template_versions (template_id, version, js_code, reason, remarks, is_active, created_by) VALUES (?, ?, ?, ?, ?, 1, ?)',
        [templateId, '1.0.0', funcCode, '初始导入', '从 print-templates.js 迁移', 'system']
      );
      versionId = result.insertId;
      console.log(`已新建版本 1.0.0 (id=${versionId})`);
    }

    // 3. 确保只有 1.0.0 生效
    await connection.execute(
      'UPDATE template_versions SET is_active = 0 WHERE template_id = ? AND id != ?',
      [templateId, versionId]
    );
    await connection.execute(
      'UPDATE templates SET current_version_id = ? WHERE id = ?',
      [versionId, templateId]
    );

    await connection.commit();
    console.log(`\n✅ ${TARGET_META.name} 迁移完成`);
  } catch (err) {
    await connection.rollback();
    console.error('迁移失败：', err);
    process.exit(1);
  } finally {
    connection.release();
    await pool.end();
  }
}

main();
