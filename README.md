# 后端 PDF 生成服务部署指南

## 一、前置条件

1. 安装 Node.js 18+（推荐 LTS 版本）
2. 确保服务器能访问外网（Puppeteer 首次启动会自动下载 Chromium）

## 二、安装步骤

```bash
# 1. 进入服务目录
cd pdf-server

# 2. 安装依赖（包含 Puppeteer + Express）
npm install

# 3. 把模板文件放到 templates 目录
mkdir -p templates
cp /path/to/print-templates.js templates/
cp /path/to/print-style.css  templates/

# 4. 启动服务
npm start
```

服务默认运行在 `http://localhost:3456`。

## 三、目录结构

```
pdf-server/
├── package.json          # 依赖配置
├── server.js             # 主服务入口
├── frontend-example.js   # 前端调用示例
├── README.md             # 本文件
└── templates/            # 存放模板（不会暴露给前端）
    ├── print-templates.js
    └── print-style.css
```

## 四、接口说明

### POST /api/print

生成 PDF 并直接返回文件流。

**请求体（JSON）：**

```json
{
  "records": [
    { "mingcheng": "产品A", "guige": "10ml", "xinghao": "X-01", "peifang": "P-100", "pici": "20240601A", "beizhu": "" }
  ],
  "tasks": [
    { "template": "workorder", "copies": 2 },
    { "template": "qclabel",   "copies": 1 },
    { "template": "cover",     "copies": 1 }
  ]
}
```

**参数说明：**

- `records`：数据数组，每行对应一条生产记录，字段与前端保持一致。
- `tasks`：打印任务数组，每项包含：
  - `template`：模板标识，可选值 `workorder | qclabel | delivery | batchrecord | cover`
  - `copies`：该模板每个数据行打印多少份

**处理逻辑：**

服务端会按 `tasks` 的顺序依次处理：
1. 先处理 `workorder`，把每条 record 渲染 2 份
2. 再处理 `qclabel`，把每条 record 渲染 1 份
3. 最后处理 `cover`，把每条 record 渲染 1 份
4. 所有页面合并成一份 PDF 返回

**响应：**

- 成功：直接返回 `Content-Type: application/pdf` 的文件流
- 失败：返回 JSON `{ "error": "..." }`

## 五、前端接入

把前端原来的 `doPrint()` 替换为调用本接口即可（详见 `frontend-example.js`）。

核心流程：
1. 前端收集用户勾选的数据和模板份数
2. 发 POST 请求到 `/api/print`
3. 拿到返回的 PDF Blob，用 `window.open(URL)` 在新标签页打开
4. 用户看到浏览器原生的 PDF 预览，可直接点打印或下载

## 六、Puppeteer 国内镜像（可选）

如果服务器下载 Chromium 很慢，可设置环境变量使用国内镜像：

```bash
# Linux / macOS
export PUPPETEER_DOWNLOAD_BASE_URL=https://registry.npmmirror.com/binary.html?path=chromium-browser-snapshots/
npm install

# Windows PowerShell
$env:PUPPETEER_DOWNLOAD_BASE_URL="https://registry.npmmirror.com/binary.html?path=chromium-browser-snapshots/"
npm install
```

或者手动下载 Chromium 后指定路径：

```javascript
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium-browser', // 你的 Chromium 路径
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

## 七、生产环境建议

1. **进程守护**：使用 PM2 或 systemd 保持服务常驻
   ```bash
   npm install -g pm2
   pm2 start server.js --name pdf-print-server
   pm2 save
   ```

2. **Nginx 反向代理**：把 `3456` 端口代理到域名，并加 HTTPS
   ```nginx
   location /api/print {
       proxy_pass http://127.0.0.1:3456;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       client_max_body_size 10m;
   }
   ```

3. **模板热更新**：目前每次请求都会重新读取模板文件，如需性能优化可改为内存缓存 + 文件监听。

4. **限流与鉴权**：生产环境建议在 Nginx 或 Express 层加 IP 限流和 Token 鉴权，防止接口被滥用。

## 八、对比前端方案的差异

| 维度 | 前端 window.print() | 后端 Puppeteer PDF |
|---|---|---|
| 模板安全性 | 模板需下发到浏览器，可被 F12 篡改 | 模板全程在服务端，前端不可见 |
| 多模板多份数 | 依赖浏览器分页，控制粒度粗 | 服务端精确控制每页内容、顺序、份数 |
| 输出格式 | 浏览器打印对话框 / 虚拟打印机 PDF | 标准 PDF 文件，字体和排版完全可控 |
| 网络依赖 | 模板需远程加载 | 数据+模板都在服务端，一次请求完成 |
| 部署复杂度 | 纯静态文件，最简单 | 需要 Node.js 服务和 Chromium 环境 |
| 适用场景 | 内网快速落地、对安全要求中等 | 需要绝对防篡改、正式生产环境 |
