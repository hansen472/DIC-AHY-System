/**
 * 模板迁移脚本
 *
 * 将现有的 templates/print-templates.js 和 templates/print-style.css
 * 导入到数据库的模板版本管理表中。
 *
 * 执行方式：
 *   node scripts/migrate-templates.js
 *
 * 说明：
 * - 每个 render 函数作为一个模板版本导入
 * - 全局 CSS 导入 template_css 表
 * - 默认版本号为 1.0.0，状态为生效
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../db-config');

const TEMPLATES_JS_PATH = path.join(__dirname, '..', 'templates', 'print-templates.js');
const TEMPLATES_CSS_PATH = path.join(__dirname, '..', 'templates', 'print-style.css');

// 模板显示名称映射（与 index.html 中的模板列表保持一致）
const TEMPLATE_META = {
  renderCover: { key: 'cover', name: '模板 A：封皮 — SOR-SC-001', sort: 1 },
  renderBatchRecord: { key: 'batchrecord', name: '模板 B：配料工序生产记录 — SOR-SC-003', sort: 2 },
  renderMixingRecord: { key: 'mixingrecord', name: '模板 C：密炼工序生产记录 — SOR-SC-004（横向A4）', sort: 3 },
  renderCalenderingRecord: { key: 'calenderingrecord', name: '模板 D：压延工序生产记录 — SOR-SC-005', sort: 4 },
  renderVulcanizingRecord: { key: 'vulcanizingrecord', name: '模板 E：硫化工序生产记录 — SOR-SC-006', sort: 5 },
  renderTrimmingRecord: { key: 'trimmingrecord', name: '模板 F：除边工序生产记录 — SOR-SC-007', sort: 6 },
  renderCleaningRecord: { key: 'cleaningrecord', name: '模板 G：清洗工序生产记录 — SOR-SC-008', sort: 7 },
  renderMaterialBalance: { key: 'materialbalance', name: '模板 H：橡胶车间物料平衡单 — SOR-SC-013（双页）', sort: 8 },
  renderLabelRecord: { key: 'labelrecord', name: '模板 I：标签打印使用、销毁记录 — SOR-SC-050（横向A4）', sort: 9 },
  renderOutsourcingRecord: { key: 'outsourcingrecord', name: '模板 J：外包工序生产记录 — SOR-SC-053（横向A4）', sort: 10 },
  renderInnerPackingRecord: { key: 'innerpackingrecord', name: '模板 K：内包工序生产记录 — SOR-SC-068', sort: 11 },
  renderBatchingCleanup: { key: 'batchingcleanup', name: '模板 L：配料工序清场记录 — SOR-SC-079（双页）', sort: 12 },
  renderMixingCleanup: { key: 'mixingcleanup', name: '模板 M：密炼工序清场记录 — SOR-SC-080', sort: 13 },
  renderCalenderingCleanup: { key: 'calenderingcleanup', name: '模板 N：压延出片工序清场记录 — SOR-SC-081', sort: 14 },
  renderVulcanizingCleanup: { key: 'vulcanizingcleanup', name: '模板 O：硫化工序清场记录 — SOR-SC-082（双页）', sort: 15 },
  renderTrimmingCleanup: { key: 'trimmingcleanup', name: '模板 P：除边工序清场记录 — SOR-SC-083（双页）', sort: 16 },
  renderWashingCleanup: { key: 'washingcleanup', name: '模板 Q：清洗工序清场记录 — SOR-SC-084（双页）', sort: 17 },
  renderInnerPackagingCleanup: { key: 'innerpackagingcleanup', name: '模板 R：内包工序清场记录 — SOR-SC-085（双页）', sort: 18 },
  renderOuterPackagingCleanup: { key: 'outerpackagingcleanup', name: '模板 S：外包工序清场记录 — SOR-SC-086', sort: 19 },
  renderMixingProduction1: { key: 'mixingproduction1', name: '模板 T：开炼工序生产记录（1#） — SOR-SC-087（A4横版）', sort: 20 },
  renderMixingProduction2: { key: 'mixingproduction2', name: '模板 U：开炼工序生产记录（2#） — SOR-SC-088（A4横版）', sort: 21 },
  renderTestSampleVulcanizing: { key: 'testsamplevulcanizing', name: '模板 V：试样硫化生产记录 — SOR-SC-089', sort: 22 },
  renderMixingCleanup1: { key: 'mixingcleanup1', name: '模板 W：开炼工序清场记录（1#） — SOR-SC-091', sort: 23 },
  renderMixingCleanup2: { key: 'mixingcleanup2', name: '模板 X：开炼工序清场记录（2#） — SOR-SC-092', sort: 24 },
  renderWashingPreCleanup: { key: 'washingprecleanup', name: '模板 Y：清洗工序预清洗清场记录 — SOR-SC-093（双页）', sort: 25 }
};

/**
 * 从源码中提取函数体（包含 function 关键字和函数名）
 *
 * 特点：
 * - 识别字符串、模板字面量、单行/多行注释
 * - 大括号只在没有被上述内容包裹时才计数
 * - 可正确处理函数体内 ${...} 插值中的大括号
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

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    // 单行注释
    if (inSingleComment) {
      if (ch === '\n') inSingleComment = false;
      continue;
    }

    // 多行注释
    if (inMultiComment) {
      if (ch === '*' && next === '/') {
        inMultiComment = false;
        i++;
      }
      continue;
    }

    // 字符串和模板字面量
    if (inSingleString) {
      if (ch === '\\') escapeNext = true;
      else if (ch === "'") inSingleString = false;
      continue;
    }
    if (inDoubleString) {
      if (ch === '\\') escapeNext = true;
      else if (ch === '"') inDoubleString = false;
      continue;
    }
    if (inTemplate) {
      if (ch === '\\') escapeNext = true;
      else if (ch === '`') inTemplate = false;
      // 模板内 ${...} 仍需处理，但这里只要不被误识别为字符串/注释边界即可
      continue;
    }

    // 进入注释
    if (ch === '/' && next === '/') {
      inSingleComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inMultiComment = true;
      i++;
      continue;
    }

    // 进入字符串或模板字面量
    if (ch === "'") { inSingleString = true; continue; }
    if (ch === '"') { inDoubleString = true; continue; }
    if (ch === '`') { inTemplate = true; continue; }

    // 大括号计数
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return code.substring(startIndex, i + 1);
      }
    }
  }

  throw new Error(`函数 ${funcName} 的大括号未闭合`);
}

/**
 * 导入全局 CSS
 */
async function migrateCSS(connection) {
  const cssContent = fs.readFileSync(TEMPLATES_CSS_PATH, 'utf8');

  const [existing] = await connection.execute(
    'SELECT id FROM template_css WHERE name = ?',
    ['default']
  );

  if (existing.length > 0) {
    await connection.execute(
      'UPDATE template_css SET css_content = ?, is_active = 1, updated_at = NOW() WHERE name = ?',
      [cssContent, 'default']
    );
    console.log('已更新全局 CSS');
  } else {
    await connection.execute(
      'INSERT INTO template_css (name, css_content, is_active) VALUES (?, ?, 1)',
      ['default', cssContent]
    );
    console.log('已导入全局 CSS');
  }
}

/**
 * 导入模板及版本
 */
async function migrateTemplates(connection) {
  const jsCode = fs.readFileSync(TEMPLATES_JS_PATH, 'utf8');

  // 提取公共辅助函数（目前只有 mixingproduction1/2 用到）
  let helpersCode = '';
  try {
    const emptyCells = extractFunction(jsCode, '__emptyCells');
    const col2Cells = extractFunction(jsCode, '__col2Cells');
    helpersCode = `\n${emptyCells}\n${col2Cells}\n`;
  } catch (e) {
    console.warn('未找到公共辅助函数，跳过：', e.message);
  }

  for (const [funcName, meta] of Object.entries(TEMPLATE_META)) {
    try {
      let funcCode = extractFunction(jsCode, funcName);

      // 需要辅助函数的模板，把辅助函数拼到前面
      if (['renderMixingProduction1', 'renderMixingProduction2'].includes(funcName)) {
        funcCode = helpersCode + funcCode;
      }

      // 1. 插入或更新模板定义
      const [templateRows] = await connection.execute(
        'SELECT id FROM templates WHERE template_key = ?',
        [meta.key]
      );

      let templateId;
      if (templateRows.length > 0) {
        templateId = templateRows[0].id;
        await connection.execute(
          'UPDATE templates SET render_function_name = ?, name = ?, sort_order = ?, is_active = 1, updated_at = NOW() WHERE id = ?',
          [funcName, meta.name, meta.sort, templateId]
        );
      } else {
        const [result] = await connection.execute(
          'INSERT INTO templates (template_key, render_function_name, name, sort_order, is_active) VALUES (?, ?, ?, ?, 1)',
          [meta.key, funcName, meta.name, meta.sort]
        );
        templateId = result.insertId;
      }

      // 2. 如果该模板还没有版本记录，插入 1.0.0 版本并设为生效
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
      } else {
        const [result] = await connection.execute(
          'INSERT INTO template_versions (template_id, version, js_code, reason, remarks, is_active, created_by) VALUES (?, ?, ?, ?, ?, 1, ?)',
          [templateId, '1.0.0', funcCode, '初始导入', '从 print-templates.js 迁移', 'system']
        );
        versionId = result.insertId;
      }

      // 3. 确保只有当前版本生效，并更新 templates.current_version_id
      await connection.execute(
        'UPDATE template_versions SET is_active = 0 WHERE template_id = ? AND id != ?',
        [templateId, versionId]
      );
      await connection.execute(
        'UPDATE templates SET current_version_id = ? WHERE id = ?',
        [versionId, templateId]
      );

      console.log(`已导入模板：${meta.name}`);
    } catch (err) {
      console.error(`导入模板 ${funcName} 失败：`, err.message);
    }
  }
}

async function main() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await migrateCSS(connection);
    await migrateTemplates(connection);

    await connection.commit();
    console.log('\n模板迁移完成');
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
