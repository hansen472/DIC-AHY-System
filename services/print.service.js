/**
 * 打印服务：Chrome 检测、MSSQL 数据查询、模板加载、PDF 生成与合并
 */
const fs = require('fs');
const mssql = require('mssql');
const { PDFDocument } = require('pdf-lib');

// 横向模板集合
const LANDSCAPE_TEMPLATES = new Set(['mixingrecord', 'labelrecord', 'outsourcingrecord', 'mixingproduction1', 'mixingproduction2']);

// 图片基础 URL
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL || 'http://172.19.40.91/';

// 生产记录打印查询：数据库字段 → 网页显示字段 映射关系
const PRODUCTION_QUERY_FIELD_MAPPING = {
  source_table: 'Make_Task',
  fields: {
    'p_name':   { alias: 'mingcheng', display: '名称' },
    'p_content1': { alias: 'pici',    display: '批次' },
    'p_brand':  { alias: 'xinghao',   display: '型号' },
    'p_size':   { alias: 'guige',     display: '规格' },
    'p_content3': { alias: 'peifang', display: '配方' },
    'content':  { alias: 'beizhu',    display: '备注' },
    'num':      { alias: 'num',       display: '单据编号' }
  }
};

/**
 * 自动检测系统已安装的 Chrome/Chromium 路径
 */
function findChrome() {
  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/snap/bin/chromium',
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * 根据查询内容前缀判断查询类型
 */
function getQueryType(querydata) {
  if (typeof querydata === 'string' && querydata.toUpperCase().startsWith('SCRW')) {
    return 'SCRW';
  }
  return 'DEFAULT';
}

/**
 * 从 MSSQL（ERP1）直接查询真实生产数据
 */
async function fetchMssqlData(mssqlPool, querydata) {
  const type = getQueryType(querydata);
  let sql;

  switch (type) {
    case 'SCRW':
      sql = `
        SELECT
          CAST(p_name AS NVARCHAR(MAX)) AS mingcheng,
          p_content1 AS pici,
          CAST(p_brand AS NVARCHAR(MAX)) AS xinghao,
          CAST(p_size AS NVARCHAR(MAX)) AS guige,
          CAST(p_content3 AS NVARCHAR(MAX)) AS peifang,
          CAST(content AS NVARCHAR(MAX)) AS beizhu,
          CAST(num AS NVARCHAR(MAX)) AS num
        FROM Make_Task
        WHERE num = @querydata
      `;
      break;
    default:
      sql = `
        SELECT
          CAST(p_name AS NVARCHAR(MAX)) AS mingcheng,
          p_content1 AS pici,
          CAST(p_brand AS NVARCHAR(MAX)) AS xinghao,
          CAST(p_size AS NVARCHAR(MAX)) AS guige,
          CAST(p_content3 AS NVARCHAR(MAX)) AS peifang,
          CAST(content AS NVARCHAR(MAX)) AS beizhu,
          CAST(num AS NVARCHAR(MAX)) AS num
        FROM Make_Task
        WHERE p_content1 = @querydata
      `;
      break;
  }

  const request = mssqlPool.request();
  request.input('querydata', mssql.NVarChar, querydata);
  const result = await request.query(sql);
  return result.recordset || [];
}

/**
 * 从数据库加载模板资源
 */
async function loadTemplates(pool) {
  // 1. 加载所有 CSS 样式 → { [id]: css_content }
  const [cssRows] = await pool.execute(
    'SELECT id, css_content FROM template_css'
  );
  if (cssRows.length === 0) {
    throw new Error('数据库中未找到 CSS 样式，请先执行模板迁移脚本');
  }
  const cssMap = {};
  cssRows.forEach(r => { cssMap[r.id] = r.css_content; });

  // 2. 加载所有生效的模板版本 JS 代码
  const [versionRows] = await pool.execute(`
    SELECT v.js_code, t.render_function_name
    FROM template_versions v
    JOIN templates t ON v.template_id = t.id
    WHERE v.is_active = 1 AND t.is_active = 1
    ORDER BY t.sort_order ASC
  `);

  if (versionRows.length === 0) {
    throw new Error('数据库中未找到生效的模板版本，请先执行模板迁移脚本');
  }

  const jsCode = versionRows.map(row => row.js_code).join('\n');

  // 3. 加载每个模板的 css_id → { template_key: css_id }
  const [tplCssRows] = await pool.execute(
    'SELECT template_key, css_id FROM templates WHERE is_active = 1'
  );
  const templateCssMap = {};
  tplCssRows.forEach(r => { templateCssMap[r.template_key] = r.css_id; });

  return { jsCode, cssMap, templateCssMap };
}

/**
 * 根据任务列表中的模板 key，从 cssMap 中解析出对应的 CSS 代码
 */
function resolveCssForTasks(tasks, cssMap, templateCssMap) {
  const seen = new Set();
  let css = '';
  tasks.forEach(task => {
    const cssId = templateCssMap[task.template];
    if (cssId && !seen.has(cssId) && cssMap[cssId]) {
      css += cssMap[cssId] + '\n';
      seen.add(cssId);
    }
  });
  return css;
}

/**
 * 在 Node 端执行模板 JS，获取渲染函数
 */
function getRenderFunctions(jsCode) {
  const sandbox = new Function(`
    const module = { exports: {} };
    ${jsCode}
    return {
      renderCover:     typeof renderCover     !== 'undefined' ? renderCover     : null,
      renderBatchRecord: typeof renderBatchRecord !== 'undefined' ? renderBatchRecord : null,
      renderMixingRecord: typeof renderMixingRecord !== 'undefined' ? renderMixingRecord : null,
      renderCalenderingRecord: typeof renderCalenderingRecord !== 'undefined' ? renderCalenderingRecord : null,
      renderVulcanizingRecord: typeof renderVulcanizingRecord !== 'undefined' ? renderVulcanizingRecord : null,
      renderTrimmingRecord: typeof renderTrimmingRecord !== 'undefined' ? renderTrimmingRecord : null,
      renderCleaningRecord: typeof renderCleaningRecord !== 'undefined' ? renderCleaningRecord : null,
      renderMaterialBalance: typeof renderMaterialBalance !== 'undefined' ? renderMaterialBalance : null,
      renderLabelRecord: typeof renderLabelRecord !== 'undefined' ? renderLabelRecord : null,
      renderOutsourcingRecord: typeof renderOutsourcingRecord !== 'undefined' ? renderOutsourcingRecord : null,
      renderInnerPackingRecord: typeof renderInnerPackingRecord !== 'undefined' ? renderInnerPackingRecord : null,
      renderBatchingCleanup: typeof renderBatchingCleanup !== 'undefined' ? renderBatchingCleanup : null,
      renderMixingCleanup: typeof renderMixingCleanup !== 'undefined' ? renderMixingCleanup : null,
      renderCalenderingCleanup: typeof renderCalenderingCleanup !== 'undefined' ? renderCalenderingCleanup : null,
      renderVulcanizingCleanup: typeof renderVulcanizingCleanup !== 'undefined' ? renderVulcanizingCleanup : null,
      renderTrimmingCleanup: typeof renderTrimmingCleanup !== 'undefined' ? renderTrimmingCleanup : null,
      renderWashingCleanup: typeof renderWashingCleanup !== 'undefined' ? renderWashingCleanup : null,
      renderInnerPackagingCleanup: typeof renderInnerPackagingCleanup !== 'undefined' ? renderInnerPackagingCleanup : null,
      renderOuterPackagingCleanup: typeof renderOuterPackagingCleanup !== 'undefined' ? renderOuterPackagingCleanup : null,
      renderMixingCleanup1: typeof renderMixingCleanup1 !== 'undefined' ? renderMixingCleanup1 : null,
      renderMixingCleanup2: typeof renderMixingCleanup2 !== 'undefined' ? renderMixingCleanup2 : null,
      renderWashingPreCleanup: typeof renderWashingPreCleanup !== 'undefined' ? renderWashingPreCleanup : null,
      renderMixingProduction1: typeof renderMixingProduction1 !== 'undefined' ? renderMixingProduction1 : null,
      renderMixingProduction2: typeof renderMixingProduction2 !== 'undefined' ? renderMixingProduction2 : null,
      renderTestSampleVulcanizing: typeof renderTestSampleVulcanizing !== 'undefined' ? renderTestSampleVulcanizing : null,
      renderUserTrainingSummary: typeof renderUserTrainingSummary !== 'undefined' ? renderUserTrainingSummary : null
    };
  `);
  return sandbox();
}

/**
 * 根据前端传来的任务，拼装完整 HTML
 */
function buildPrintHTML(records, tasks, fns, cssCode) {
  let bodyHTML = '';

  tasks.forEach((task) => {
    const tplName = task.template;
    const copies = task.copies || 1;

    const renderFn = fns[
      tplName === 'cover' ? 'renderCover'
        : tplName === 'batchrecord' ? 'renderBatchRecord'
        : tplName === 'mixingrecord' ? 'renderMixingRecord'
        : tplName === 'calenderingrecord' ? 'renderCalenderingRecord'
        : tplName === 'vulcanizingrecord' ? 'renderVulcanizingRecord'
        : tplName === 'trimmingrecord' ? 'renderTrimmingRecord'
        : tplName === 'cleaningrecord' ? 'renderCleaningRecord'
        : tplName === 'materialbalance' ? 'renderMaterialBalance'
        : tplName === 'labelrecord' ? 'renderLabelRecord'
        : tplName === 'outsourcingrecord' ? 'renderOutsourcingRecord'
        : tplName === 'innerpackingrecord' ? 'renderInnerPackingRecord'
        : tplName === 'batchingcleanup' ? 'renderBatchingCleanup'
        : tplName === 'mixingcleanup' ? 'renderMixingCleanup'
        : tplName === 'calenderingcleanup' ? 'renderCalenderingCleanup'
        : tplName === 'vulcanizingcleanup' ? 'renderVulcanizingCleanup'
        : tplName === 'trimmingcleanup' ? 'renderTrimmingCleanup'
        : tplName === 'washingcleanup' ? 'renderWashingCleanup'
        : tplName === 'innerpackagingcleanup' ? 'renderInnerPackagingCleanup'
        : tplName === 'outerpackagingcleanup' ? 'renderOuterPackagingCleanup'
        : tplName === 'mixingcleanup1' ? 'renderMixingCleanup1'
        : tplName === 'mixingcleanup2' ? 'renderMixingCleanup2'
        : tplName === 'washingprecleanup' ? 'renderWashingPreCleanup'
        : tplName === 'mixingproduction1' ? 'renderMixingProduction1'
        : tplName === 'mixingproduction2' ? 'renderMixingProduction2'
        : tplName === 'testsamplevulcanizing' ? 'renderTestSampleVulcanizing'
        : null
    ];

    if (!renderFn) {
      throw new Error('未知模板类型：' + tplName);
    }

    for (let c = 0; c < copies; c++) {
      records.forEach((row, idx) => {
        bodyHTML += renderFn(row, idx + 1);
      });
    }
  });

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<base href="${IMAGE_BASE_URL}">
<title>Print</title>
<style>
${cssCode}
</style>
</head>
<body>
<div id="print-container">
${bodyHTML}
</div>
</body>
</html>`;

  return { html };
}

/**
 * 拼装用户培训记录个人汇总 HTML
 */
function buildTrainingSummaryHTML(user, records, fns, cssCode) {
  const ROWS_PER_PAGE = 16;
  const totalPages = Math.max(1, Math.ceil(records.length / ROWS_PER_PAGE));
  let bodyHTML = '';

  for (let page = 0; page < totalPages; page++) {
    const pageRecords = records.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    bodyHTML += fns.renderUserTrainingSummary({
      user,
      records: pageRecords,
      page: page + 1,
      totalPages
    }, page + 1);
  }

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<base href="${IMAGE_BASE_URL}">
<title>用户培训记录个人汇总</title>
<style>
${cssCode}
</style>
</head>
<body>
<div id="print-container">
${bodyHTML}
</div>
</body>
</html>`;
}

/**
 * 使用 Puppeteer 为单组任务生成 PDF Buffer
 */
async function generatePDFBuffer(browser, records, tasks, fns, isLandscape, cssCode) {
  const { html } = buildPrintHTML(records, tasks, fns, cssCode);
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buffer = await page.pdf({
    format: 'A4',
    landscape: isLandscape,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 }
  });
  await page.close();
  return buffer;
}

/**
 * 合并多个 PDF Buffer 为一个
 */
async function mergePDFs(buffers) {
  const mergedPdf = await PDFDocument.create();
  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(p => mergedPdf.addPage(p));
  }
  return Buffer.from(await mergedPdf.save());
}

/**
 * 渲染单个模板为预览 HTML
 */
function renderTemplatePreview(jsCode, renderFunctionName, cssCode) {
  const sandbox = new Function(`
    const module = { exports: {} };
    ${jsCode}
    return typeof ${renderFunctionName} !== 'undefined' ? ${renderFunctionName} : null;
  `);
  const renderFn = sandbox();
  if (!renderFn) {
    throw new Error('未找到渲染函数：' + renderFunctionName);
  }

  const PREVIEW_SAMPLE_DATA = {
    mingcheng: '示例产品名称',
    guige: '10ml',
    xinghao: 'X-01',
    peifang: 'P-100',
    pici: '20260601A',
    beizhu: '预览用示例数据'
  };

  const bodyHTML = renderFn(PREVIEW_SAMPLE_DATA, 1);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>模板预览</title>
<style>${cssCode}</style>
</head>
<body>
<div id="print-container">${bodyHTML}</div>
</body>
</html>`;
}

module.exports = {
  LANDSCAPE_TEMPLATES,
  IMAGE_BASE_URL,
  PRODUCTION_QUERY_FIELD_MAPPING,
  findChrome,
  getQueryType,
  fetchMssqlData,
  loadTemplates,
  resolveCssForTasks,
  getRenderFunctions,
  buildPrintHTML,
  buildTrainingSummaryHTML,
  generatePDFBuffer,
  mergePDFs,
  renderTemplatePreview,
};
