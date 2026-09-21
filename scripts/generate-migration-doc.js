/**
 * 生成《前端架构改造方案（MPA → Vue3 SPA + Element Plus）》Word 文档
 * 运行：node scripts/generate-migration-doc.js
 * 输出：项目根目录 Vue3-SPA改造方案.docx
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  Header, Footer, PageNumber, PageBreak, LevelFormat,
} = require('docx');

const FONT = 'Microsoft YaHei';
const MONO = 'Consolas';

// ============ 段落辅助函数 ============
function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, ...opts });
}

function title(text, size, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: [new TextRun({ text, font: FONT, size, bold: true, ...opts })],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, font: FONT, size: 32, bold: true, color: '1F4E79' })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: '2E74B5' })],
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 100 },
    children: [new TextRun({ text, font: FONT, size: 23, bold: true, color: '404040' })],
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, line: 360 },
    children: [new TextRun({ text, font: FONT, size: 22, ...opts })],
  });
}

// 富文本段落：segments = [{ text, bold, color }]
function pr(segments) {
  return new Paragraph({
    spacing: { after: 120, line: 360 },
    children: segments.map(s => new TextRun({ font: FONT, size: 22, ...s })),
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { after: 60, line: 320 },
    children: [new TextRun({ text, font: FONT, size: 22 })],
  });
}

function bulletR(segments, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    spacing: { after: 60, line: 320 },
    children: segments.map(s => new TextRun({ font: FONT, size: 22, ...s })),
  });
}

function spacer() {
  return new Paragraph({ spacing: { after: 80 }, children: [] });
}

// 代码块：每行一个带浅灰底纹的等宽字体段落
function codeBlock(code) {
  const lines = code.replace(/\n$/, '').split('\n');
  return lines.map((line, idx) => new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' },
    indent: { left: 120, right: 120 },
    spacing: {
      before: idx === 0 ? 120 : 0,
      after: idx === lines.length - 1 ? 160 : 0,
      line: 280,
    },
    children: [new TextRun({
      text: line.length ? line.replace(/\t/g, '  ') : ' ',
      font: MONO,
      size: 18,
      color: '333333',
    })],
  }));
}

// ============ 表格辅助函数 ============
function makeTable(headers, rows, widths) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
  const borders = {
    top: border, bottom: border, left: border, right: border,
    insideHorizontal: border, insideVertical: border,
  };

  const cellParas = (text, opts = {}) =>
    String(text).split('\n').map(line => new Paragraph({
      spacing: { after: 40, line: 280 },
      children: [new TextRun({ text: line, font: FONT, size: 20, ...opts })],
    }));

  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((t, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: 'D9E2F3' },
      children: cellParas(t, { bold: true }),
    })),
  });

  const bodyRows = rows.map(r => new TableRow({
    children: r.map((cell, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      children: cellParas(cell),
    })),
  }));

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: [headerRow, ...bodyRows],
  });
}

// ============ 文档正文 ============
const children = [];

// ---- 封面 ----
children.push(
  new Paragraph({ spacing: { before: 2400 }, children: [] }),
  title('数智中心系统', 44, { color: '1F4E79' }),
  title('前端架构改造方案', 36),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 600 },
    children: [new TextRun({
      text: '多页面应用（MPA） → Vue3 SPA + Element Plus',
      font: FONT, size: 24, color: '595959',
    })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 100 },
    children: [new TextRun({ text: '版本：V1.0', font: FONT, size: 22, color: '595959' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { after: 100 },
    children: [new TextRun({ text: '日期：2026-09-21', font: FONT, size: 22, color: '595959' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: '策略：新旧共存，逐页迁移', font: FONT, size: 22, color: '595959' })],
  }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---- 一、文档目的 ----
children.push(
  h1('一、文档目的'),
  p('本文档对现有系统的前后端结构进行分析，论证将多页面（MPA）前端改造为 Vue3 SPA + Element Plus 架构的可行性，并给出"新旧共存、逐页迁移"的具体实施方案、标准迁移流程、页面迁移批次建议以及风险与回滚方案，作为后续改造工作的技术依据。'),
);

// ---- 二、现状分析 ----
children.push(
  h1('二、现状分析'),
  h2('2.1 技术栈现状'),
  makeTable(
    ['层级', '现状技术', '说明'],
    [
      ['后端', 'Node.js + Express', '服务入口 server.js，业务路由已拆分至 routes/ 目录，采用工厂函数注入依赖'],
      ['数据库', 'MySQL + MSSQL', '主业务库 MySQL，另接 MSSQL 等外部数据源'],
      ['前端', '多页面应用（MPA）', '约 40 个独立 HTML 文件，页面内联 <style> 与 <script>，使用原生 fetch 调用接口'],
      ['页面分发', 'routes/pages.routes.js', '集中维护"访问路径 → 权限中间件 → HTML 文件"映射，通过 sendFile 返回页面'],
      ['鉴权', 'Cookie 会话（sid）', '服务端内存 Map 存储会话，HttpOnly Cookie，有效期 24 小时'],
      ['接口风格', 'REST JSON（/api/*）', '前后端已通过 JSON 接口解耦'],
    ],
    [16, 26, 58],
  ),
  spacer(),

  h2('2.2 页面组织与分发'),
  bullet('每个业务页面对应项目根目录下一个独立 HTML 文件（如 user-management.html、suppliers.html）。'),
  bullet('pages.routes.js 以数据驱动方式统一注册页面路由，并按模块挂载页面级权限中间件（requireAuthPage / requireAdminPage / requirePermissionPage）。'),
  bullet('导航页 nav-sidebar.html 为登录后的默认首页（路由 /），各业务页面通过普通超链接互相跳转。'),

  h2('2.3 鉴权机制'),
  bullet('登录成功后由服务端写入 HttpOnly Cookie：sid；同源的页面请求与 fetch 请求自动携带。'),
  bullet('页面级中间件：未登录重定向到 /login；非管理员访问管理页返回 403。'),
  bullet('接口级中间件：requireAuth / requirePermission 在每个 /api/* 接口上独立校验，权限点存储于 user_permissions 表，admin 用户拥有全部权限。'),
  bullet('现有功能权限点包括：print、logs、dashboard、template_admin、operation_logs、training_records、supplier_qualifications、workflow_design、ocr_recognize、ocr_template_design、backup_management、instrument_meter、coa_report 等。'),

  h2('2.4 现存主要问题'),
  bullet('每个 HTML 页面重复维护一套按钮、表格、弹窗、表单样式与交互代码，维护成本高。'),
  bullet('页面间跳转是整页刷新，体验不连贯，公共布局（侧边栏、顶栏）无法复用。'),
  bullet('前端逻辑以全局函数 + onclick 内联事件为主，难以复用、难以测试、难以做状态管理。'),
  bullet('无构建体系，无法使用 ES Module 生态与组件库，复杂交互（工作流设计器、OCR 模板设计等）实现成本高。'),
);

// ---- 三、可行性分析 ----
children.push(
  h1('三、可行性分析'),
  h2('3.1 结论'),
  pr([
    { text: '可行。', bold: true, color: '1F4E79' },
    { text: '现有系统具备渐进式改造的全部条件，推荐采用"Vue3 SPA 与旧 HTML 共存、单页面逐个迁移"的方式，后端 API 与鉴权体系无需改动。' },
  ]),
  h2('3.2 可行性依据'),
  bulletR([
    { text: '前后端已经 JSON 解耦：', bold: true },
    { text: '所有 HTML 页面仅通过 /api/* 接口获取数据，迁移为 Vue 组件时接口层完全复用。' },
  ]),
  bulletR([
    { text: '鉴权基于同源 Cookie：', bold: true },
    { text: 'SPA 的 axios/fetch 同源请求自动携带 sid，无需改造鉴权体系；仅需把"页面跳转 /login"替换为前端路由守卫。' },
  ]),
  bulletR([
    { text: '页面之间无耦合：', bold: true },
    { text: '每个 HTML 页面独立，迁移任意一个页面不影响其他页面，可随时上线。' },
  ]),
  bulletR([
    { text: '重复代码可被组件库消除：', bold: true },
    { text: '大量重复的表格、弹窗、表单样式可直接由 Element Plus 的 el-table、el-dialog、el-form 替代。' },
  ]),
);

// ---- 四、总体策略 ----
children.push(
  h1('四、总体策略：新旧共存、逐页迁移'),
  p('在现有 Express 服务内新增一个独立的 Vue3 前端应用（前缀 /app/），与旧多页 HTML 同时提供服务。新旧前端共用同一套后端接口与同一个 sid 会话；每完成一个页面的迁移，只需把导航中的对应链接切换到新的 /app/ 路径，验证通过后再删除旧 HTML。整体架构如下：'),
  makeTable(
    ['请求路径', '处理方式', '说明'],
    [
      ['/、/*.html', '保持现状', 'pages.routes.js 继续通过 sendFile 返回旧 HTML 页面'],
      ['/login（/login.html）', '保持现状', '共存期登录页继续使用旧页面'],
      ['/api/*', '保持现状', '所有 JSON 接口不做任何改动'],
      ['/app/（含子路径）', '新增：SPA', '返回 Vue3 构建产物；无后缀的子路径统一回退到 index.html（history 路由模式）'],
      ['/app/assets/*', '新增：静态资源', 'Vite 构建的 JS/CSS/图片资源'],
    ],
    [22, 22, 56],
  ),
  spacer(),
  p('共存期的数据与调用关系：'),
  bullet('浏览器 ↔ 旧 HTML 页面：整页访问，sid Cookie 鉴权，页面内 fetch 调用 /api/*（现状不变）。'),
  bullet('浏览器 ↔ Vue3 SPA（/app/*）：首次进入加载 SPA 资源，之后由 Vue Router 在前端切换页面，axios 调用 /api/*，sid Cookie 自动携带。'),
  bullet('Express ↔ MySQL/MSSQL：接口与数据访问层完全不动。'),
  bullet('旧 HTML 与 SPA 之间可以互相通过普通 URL 跳转，因同源且共享 sid，登录态天然互通。'),
);

// ---- 五、共存期基础设施搭建 ----
children.push(
  h1('五、共存期基础设施搭建（一次性工作）'),

  h2('5.1 目录结构'),
  p('在项目根目录新增 frontend/ 子目录，承载新的 SPA 工程；后端代码保持原位不动：'),
  ...codeBlock(`项目根目录/
├── server.js                 # Express 入口（追加 /app 挂载）
├── routes/                   # 现有后端路由（不动）
├── middleware/               # 现有鉴权中间件（不动）
├── *.html                    # 旧多页页面（迁移完成一个删除一个）
└── frontend/                 # 新增：Vue3 SPA 工程
    ├── vite.config.js
    ├── index.html
    ├── dist/                 # 生产构建产物（由 Express 托管）
    └── src/
        ├── main.js
        ├── App.vue
        ├── router/
        ├── stores/
        ├── api/
        ├── layouts/
        └── views/`),

  h2('5.2 创建前端工程并安装依赖'),
  ...codeBlock(`# 在项目根目录执行
npm create vite@latest frontend -- --template vue
cd frontend
npm install
npm install vue-router@4 pinia element-plus @element-plus/icons-vue axios`),

  h2('5.3 Vite 开发代理配置'),
  p('配置 frontend/vite.config.js：开发服务器（5173 端口）把接口、登录页与旧导航页代理到现有 Express（3456 端口），保证开发期 sid Cookie 与跳转行为与生产一致。'),
  ...codeBlock(`import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/app/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3456',
      '/login': 'http://localhost:3456',
      '/nav-sidebar.html': 'http://localhost:3456',
    },
  },
})`),

  h2('5.4 后端挂载 SPA 构建产物'),
  p('在 server.js 的全局中间件区域（现有 express.static 配置之后）追加 /app 前缀的静态托管与 history 路由回退。注意不能影响现有的 / 与 /*.html 路由。'),
  ...codeBlock(`// SPA 构建产物（生产环境）
const spaDist = path.join(__dirname, 'frontend', 'dist');
app.use('/app', express.static(spaDist, { index: false }));

// history 模式回退：无后缀的 /app/xxx 路径统一返回 index.html
app.get(/^\\/app(?:\\/.*)?$/, (req, res, next) => {
  if (req.path.lastIndexOf('.') > req.path.lastIndexOf('/')) {
    return next(); // 带后缀的资源文件（js/css/png 等）不走回退
  }
  res.sendFile(path.join(spaDist, 'index.html'));
});`),
  p('前端构建在 frontend/ 目录执行 npm run build，产物输出到 frontend/dist；部署时需先构建再启动后端。'),

  h2('5.5 新增 /api/auth/me 会话信息接口'),
  p('SPA 路由守卫需要知道"当前用户是谁、拥有哪些权限"。在 routes/auth.routes.js 中新增一个接口（沿用现有工厂函数已注入的 pool 与 auth）：'),
  ...codeBlock(`// routes/auth.routes.js 内新增
router.get('/auth/me', auth.requireAuth, async (req, res) => {
  const username = req.session.username;
  const isAdmin = username === 'admin';
  let permissions = [];
  if (!isAdmin) {
    const [rows] = await pool.execute(
      'SELECT feature_key FROM user_permissions WHERE username = ? AND is_allowed = 1',
      [username]
    );
    permissions = rows.map(r => r.feature_key);
  }
  res.json({ username, isAdmin, permissions });
});`),
  p('admin 用户返回全部权限（前端按 isAdmin 直接放行），普通用户返回 user_permissions 表中已授权的权限点。'),

  h2('5.6 前端会话 Store 与 axios 封装'),
  p('使用 Pinia 保存会话信息；axios 响应拦截器统一处理 401（会话过期）跳转登录，避免每个页面重复处理。'),
  ...codeBlock(`// src/stores/auth.js（要点）
export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const ready = ref(false)

  async function fetchMe() {
    const { data } = await axios.get('/api/auth/me')
    user.value = data
    ready.value = true
  }
  function can(perm) {
    return !!user.value && (user.value.isAdmin || user.value.permissions.includes(perm))
  }
  return { user, ready, fetchMe, can }
})

// axios 401 统一拦截
axios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) window.location.href = '/login'
    return Promise.reject(err)
  }
)`),

  h2('5.7 路由与守卫'),
  p('Vue Router 使用 history 模式并以 /app/ 为 base；每个业务路由通过 meta.perm 声明所需权限点（与后端权限点同名），全局守卫调用 /api/auth/me 后统一校验。'),
  ...codeBlock(`// src/router/index.js（要点）
const router = createRouter({
  history: createWebHistory('/app/'),
  routes: [
    {
      path: '/user-management',
      component: () => import('../views/UserManagement.vue'),
      meta: { adminOnly: true },
    },
    {
      path: '/suppliers',
      component: () => import('../views/Suppliers.vue'),
      meta: { perm: 'supplier_qualifications' },
    },
  ],
})

router.beforeEach(async to => {
  const auth = useAuthStore()
  if (!auth.ready) {
    try { await auth.fetchMe() } catch { return '/login' }
  }
  if (to.meta.adminOnly && !auth.user.isAdmin) return '/app/forbidden'
  if (to.meta.perm && !auth.can(to.meta.perm)) return '/app/forbidden'
  return true
})`),
  p('注意：前端守卫只用于体验（隐藏入口、友好拦截），真正的安全边界仍然是后端每个接口上的 requirePermission，二者必须使用同一套权限点命名。'),
);

// ---- 六、单页面标准迁移流程 ----
children.push(
  h1('六、单页面标准迁移流程（以"用户管理"为例）'),
  p('每个页面的迁移都按以下 6 个标准步骤执行，单页面可独立上线、独立回滚：'),
  makeTable(
    ['步骤', '操作内容'],
    [
      ['1. 新建视图组件', '在 src/views/ 下新建 UserManagement.vue，用 el-table / el-dialog / el-form 等替换原 HTML 中的表格、弹窗与表单，套用 Element Plus 中文语言包'],
      ['2. 搬迁数据逻辑', '将 user-management.html 内的 fetch(\'/api/...\') 调用原样搬迁到 <script setup>（接口地址、请求参数、鉴权方式不变），建议收口到 src/api/ 下的模块'],
      ['3. 注册路由', '在 src/router/index.js 注册 /app/user-management，并在 meta 中声明 adminOnly: true'],
      ['4. 权限与异常', '确认路由守卫生效；接口错误通过 ElMessage 提示，401 由 axios 拦截器统一处理'],
      ['5. 切换导航入口', '在 nav-sidebar.html 中把"用户管理"链接由 user-management.html 改为 /app/user-management（其余未迁移页面链接保持不变）'],
      ['6. 清理旧页面', '新页面运行稳定后，删除根目录 user-management.html，并移除 pages.routes.js 中对应的页面注册行'],
    ],
    [18, 82],
  ),
);

// ---- 七、页面清单与迁移批次 ----
children.push(
  h1('七、页面清单与迁移批次建议'),
  h2('7.1 现有页面清单（按模块）'),
  makeTable(
    ['模块', '现有页面', '权限点'],
    [
      ['生产记录打印', 'index.html\nselect-print-record.html\nentry-print-record.html', 'print'],
      ['组织/权限管理', 'user-management.html\ncompany-management.html\ndepartment-management.html\npermission-admin.html', 'admin'],
      ['培训记录', 'training-records.html\nannual-training-plan.html\nuser-training-record.html', 'training_records'],
      ['供应商资质', 'suppliers.html\nsupplier-qualifications.html\nsupplier-qualification-logs.html\nqualification-types.html\nentry-supplier-qualifications.html\nproduct-list.html', 'supplier_qualifications'],
      ['COA 报告', 'coa-product-data.html\ncoa-client-data.html\ncoa-seal-data.html\ncoa-report-application.html\ndeviation-report.html\ndeviation-report-detail.html', 'coa_report'],
      ['领值推送', 'instrument-meter.html\nweekly-overdue-workorder-push.html\ndaily-overdue-workorder-push.html\nqc-maintenance-push.html\nunprocessed-request-push.html\nnew-repair-push.html\nnew-issue-push.html\npush-logs.html', 'instrument_meter'],
      ['日志', 'logs.html\nproduction-record-print-log.html\noperation-logs.html', 'logs /\noperation_logs'],
      ['审批流', 'workflow-tasks.html\nworkflow-designer.html\nworkflow-definitions.html', '登录即可 /\nworkflow_design'],
      ['OCR', 'ocr-recognize.html\nocr-template-design.html', 'ocr_recognize /\nocr_template_design'],
      ['其他', 'template-admin.html\nbackup-management.html\ndaping.html（大屏）\nnav-sidebar.html 等导航页\nlogin.html', 'template_admin / backup_management /\ndashboard / 登录即可'],
    ],
    [18, 58, 24],
  ),
  spacer(),

  h2('7.2 迁移批次建议'),
  makeTable(
    ['批次', '范围', '选择理由'],
    [
      ['第一批', '组织管理 3 页 + 权限管理 1 页', '标准增删改查页面，业务边界清晰，用于跑通迁移流程与组件规范'],
      ['第二批', '培训记录 3 页、供应商资质 6 页、日志 3 页', '以列表 + 表单 + 详情为主，复用第一批沉淀的表格/弹窗组件'],
      ['第三批', '导航壳（nav-sidebar → MainLayout）、COA 6 页、领值推送 8 页、备份管理', '导航壳迁移后，新页面侧边栏统一为 el-menu，后续页面只加路由；业务页批量切换'],
      ['第四批', '生产记录打印 3 页、审批流 3 页', '涉及打印链路与审批交互，在平台稳定后迁移'],
      ['第五批', '模板管理、OCR 2 页、大屏', '涉及富文本/画布/可视化重交互，需单独评估组件选型，最后处理'],
      ['最后', '登录页 login.html', '共存期统一使用旧登录页；全部业务页迁移完成后再替换为 SPA 登录页'],
    ],
    [12, 46, 42],
  ),
);

// ---- 八、专项注意事项 ----
children.push(
  h1('八、专项注意事项'),
  h3('8.1 登录页'),
  bullet('共存期不新建 SPA 登录页，未登录访问 /app/* 时守卫跳转到现有 /login，登录成功后再跳回。'),
  bullet('这样系统中始终只有一套登录实现，避免双登录页样式与逻辑漂移。'),
  h3('8.2 导航壳'),
  bullet('建议在第三批优先把 nav-sidebar.html 迁移为 SPA 的 MainLayout（el-container + el-menu + router-view）。'),
  bullet('迁移完成前，侧边栏内已迁移页面链接指向 /app/xxx、未迁移页面仍指向 xxx.html，两类链接可以长期并存。'),
  h3('8.3 复杂页面'),
  bullet('workflow-designer.html（流程画布）、ocr-template-design.html（模板设计）、daping.html（大屏）涉及画布与可视化，迁移前需单独做组件选型（如图形编辑库、ECharts 等）。'),
  bullet('template-admin.html 涉及打印模板富文本/样式编辑，迁移时需保留 templates/ 目录下模板渲染逻辑的兼容性。'),
  h3('8.4 打印链路'),
  bullet('生产记录打印依赖后端 Puppeteer/PDF 服务，迁移前端时只改页面形态，提交给后端的打印数据结构必须保持不变。'),
  h3('8.5 部署'),
  bullet('部署流程中增加 frontend 构建步骤（npm run build），并确保 frontend/dist 随部署包发布；后端启动方式与端口（3456）不变。'),
);

// ---- 九、风险与回滚 ----
children.push(
  h1('九、风险评估与回滚方案'),
  makeTable(
    ['风险', '影响', '应对措施'],
    [
      ['共存期新旧链接混杂，用户迷失', '中', '所有入口统一从导航壳进入；迁移期内旧链接保持可用，不做重定向强制切换'],
      ['SPA history 模式刷新出现 404', '中', '后端配置 /app/* 回退到 index.html；资源文件按后缀区分不走回退'],
      ['会话过期前端无感知', '低', 'axios 拦截器统一捕获 401 并跳转 /login'],
      ['前端路由守卫被绕过', '低', '后端 requirePermission 在每个接口独立鉴权，守卫仅做体验层；权限点命名保持一致'],
      ['新迁移页面存在缺陷', '中', '导航链接切回旧 xxx.html 即可立即回滚，旧文件在该页面稳定运行前不删除'],
      ['部署遗漏前端构建产物', '中', '部署脚本固化"先 build 后启动"顺序；后端启动时检测 frontend/dist 是否存在'],
      ['Element Plus 风格与旧页面风格不一致', '低', '共存期允许新旧视觉并存；通过统一主题变量逐步收敛'],
    ],
    [30, 10, 60],
  ),
  spacer(),
  h2('回滚原则'),
  bullet('单页回滚：把导航链接改回旧 HTML 路径，秒级回滚，无需发版后端。'),
  bullet('整体回滚：移除 server.js 中 /app 挂载（或部署旧版本后端），旧 MPA 体系完整保留，业务不受影响。'),
  bullet('迁移完成一个、验证一个、删除一个旧文件；未验证通过的旧 HTML 与 pages.routes.js 注册项一律保留。'),
);

// ---- 附：单页迁移完成检查要点 ----
children.push(
  h1('附：单页迁移完成检查要点'),
  bullet('页面所有查询、新增、编辑、删除功能与旧页面行为一致。'),
  bullet('无权限用户看不到入口（菜单），直接访问 URL 被守卫拦截，直接调接口被后端拒绝。'),
  bullet('会话过期后操作触发 401，能正确跳转登录页。'),
  bullet('浏览器刷新 /app/xxx 不出现 404。'),
  bullet('导航入口已切换，旧 HTML 文件与 pages.routes.js 注册项在稳定运行后清理。'),
);

// ============ 文档组装 ============
const doc = new Document({
  creator: '数智中心',
  title: '前端架构改造方案',
  description: 'MPA 向 Vue3 SPA + Element Plus 迁移方案',
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [
        {
          level: 0, format: LevelFormat.BULLET, text: '\u2022',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 420, hanging: 260 } } },
        },
        {
          level: 1, format: LevelFormat.BULLET, text: '\u25E6',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 840, hanging: 260 } } },
        },
      ],
    }],
  },
  sections: [{
    properties: {
      page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({
            text: '前端架构改造方案 · MPA → Vue3 SPA',
            font: FONT, size: 18, color: '808080',
          })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: '第 ', font: FONT, size: 18, color: '808080' }),
            new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '808080' }),
            new TextRun({ text: ' 页 / 共 ', font: FONT, size: 18, color: '808080' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: '808080' }),
            new TextRun({ text: ' 页', font: FONT, size: 18, color: '808080' }),
          ],
        })],
      }),
    },
    children,
  }],
});

const outPath = path.join(__dirname, '..', 'Vue3-SPA改造方案.docx');
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(outPath, buffer);
  console.log('文档已生成：' + outPath + '（' + buffer.length + ' 字节）');
});
