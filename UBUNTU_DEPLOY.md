# Ubuntu 服务器部署完整指南

本指南假设你有一台全新的 Ubuntu 22.04 LTS（或 20.04 LTS）服务器，目标是部署这套后端 PDF 生成服务。

---

## 一、系统基础更新

先确保系统是最新的，并安装基础工具：

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget vim git ca-certificates gnupg
```

---

## 二、安装 Node.js 20 LTS

推荐用 NodeSource 官方脚本安装，比 apt 默认源更新：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

装完后验证版本：

```bash
node -v   # 应显示 v20.x.x
npm -v    # 应显示 10.x.x
```

---

## 三、安装 Puppeteer / Chromium 所需的系统依赖

这是最容易踩坑的一步。Puppeteer 自带的 Chromium 需要很多图形和字体库才能在无头环境下正常渲染中文页面。

### 3.1 安装 Chromium 运行依赖

```bash
sudo apt install -y \
  libnss3 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libxss1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2 \
  libgtk-3-0 \
  libx11-xcb1 \
  libxcb-dri3-0 \
  libdrm2 \
  libegl1 \
  libepoxy0
```

### 3.2 安装中文字体（否则 PDF 里的中文会变成方块）

```bash
sudo apt install -y \
  fonts-noto-cjk \
  fonts-wqy-zenhei \
  fonts-wqy-microhei
```

装完字体后建议重启一下服务或重连 SSH，让字体缓存生效。

---

## 四、部署 PDF 打印服务

### 4.1 上传项目文件

把 `pdf-server` 文件夹上传到服务器，例如放到 `/opt/pdf-server`：

```bash
sudo mkdir -p /opt/pdf-server
sudo chown $USER:$USER /opt/pdf-server
```

你可以用 `scp`、`rsync`、FTP 或 Git 把代码传上去。确保目录结构如下：

```
/opt/pdf-server/
├── package.json
├── server.js
├── frontend-example.js
├── README.md
└── templates/
    ├── print-templates.js
    └── print-style.css
```

### 4.2 安装 Node 依赖

```bash
cd /opt/pdf-server
npm install
```

如果服务器在国内，下载 Chromium 可能很慢。可以先配置国内镜像再安装：

```bash
export PUPPETEER_DOWNLOAD_BASE_URL=https://registry.npmmirror.com/binary.html?path=chromium-browser-snapshots/
npm install
```

安装完成后，验证 Chromium 是否下载成功：

```bash
ls -la node_modules/puppeteer/.local-chromium/
```

### 4.3 启动测试

```bash
node server.js
```

如果看到输出 `PDF 打印服务已启动: http://localhost:3456`，说明服务已跑起来。

按 `Ctrl+C` 停止，我们继续配置进程守护。

---

## 五、PM2 进程守护（确保服务常驻）

### 5.1 安装 PM2

```bash
sudo npm install -g pm2
```

### 5.2 用 PM2 启动服务

```bash
cd /opt/pdf-server
pm2 start server.js --name pdf-print-server
```

### 5.3 设置开机自启

```bash
pm2 save
pm2 startup systemd
```

执行 `pm2 startup` 后，它会输出一条命令（类似 `sudo env PATH=... pm2 startup systemd -u ...`），直接复制执行即可。

### 5.4 常用 PM2 命令

```bash
pm2 status                 # 查看运行状态
pm2 logs pdf-print-server  # 查看实时日志
pm2 restart pdf-print-server
pm2 stop pdf-print-server
pm2 delete pdf-print-server
```

---

## 六、Nginx 反向代理（带 HTTPS）

### 6.1 安装 Nginx

```bash
sudo apt install -y nginx
```

### 6.2 配置防火墙

如果你启用了 UFW，允许 HTTP、HTTPS 和 SSH：

```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

### 6.3 配置 Nginx 反向代理

创建配置文件：

```bash
sudo vim /etc/nginx/sites-available/pdf-print
```

写入以下内容（把 `your-domain.com` 换成你的实际域名或服务器 IP）：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 或你的服务器 IP

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:3456;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # PDF 流式传输优化
        proxy_buffering off;
        proxy_request_buffering off;
    }

    location / {
        root /opt/pdf-server/public;  # 如果需要放静态页面
        index index.html;
        try_files $uri $uri/ =404;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/pdf-print /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6.4 配置 HTTPS（强烈建议）

如果你有域名，直接用 Certbot 免费申请 Let's Encrypt 证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Certbot 会自动修改 Nginx 配置并启用 HTTPS，到期前也会自动续期。

---

## 七、完整验证流程

### 7.1 测试服务健康状态

```bash
curl http://localhost:3456/health
```

应返回：`{"status":"ok","service":"pdf-print-server"}`

### 7.2 测试 PDF 生成接口

```bash
curl -X POST http://localhost:3456/api/print \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {"mingcheng": "测试产品", "guige": "10ml", "xinghao": "X-01", "peifang": "P-100", "pici": "20240601A", "beizhu": ""}
    ],
    "tasks": [
      {"template": "workorder", "copies": 1},
      {"template": "qclabel", "copies": 1}
    ]
  }' \
  --output /tmp/test-output.pdf
```

如果 `/tmp/test-output.pdf` 生成成功且有内容，说明一切正常。

---

## 八、常见问题排查

### Q1: 启动时报 `Error: Could not find Chrome (ver xxx)`

Chromium 没下载成功。可以尝试手动安装系统 Chromium 并指定路径：

```bash
sudo apt install -y chromium-browser
```

然后修改 `server.js` 中的 `puppeteer.launch`：

```javascript
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium-browser',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

### Q2: PDF 里的中文显示为方块或乱码

中文字体没装好，执行：

```bash
sudo apt install -y fonts-noto-cjk fonts-wqy-zenhei
fc-cache -fv
```

然后重启 PM2 服务：

```bash
pm2 restart pdf-print-server
```

### Q3: 接口返回 500，日志显示 `sandbox` 相关错误

某些云服务器（如 Docker 环境）不支持 Chrome sandbox。确保 `server.js` 里已加上：

```javascript
args: ['--no-sandbox', '--disable-setuid-sandbox']
```

### Q4: Nginx 代理后前端收不到 PDF

检查 Nginx 配置里是否加了 `proxy_buffering off;`，否则大文件流可能被截断。

---

## 九、文件清单（供核对）

| 路径 | 说明 |
|---|---|
| `/opt/pdf-server/server.js` | 主服务入口 |
| `/opt/pdf-server/templates/print-templates.js` | 打印模板（服务端私有） |
| `/opt/pdf-server/templates/print-style.css` | 打印样式（服务端私有） |
| `/etc/nginx/sites-available/pdf-print` | Nginx 站点配置 |
| `/var/log/nginx/access.log` | Nginx 访问日志 |
| `/var/log/nginx/error.log` | Nginx 错误日志 |
| `~/.pm2/logs/pdf-print-server-out.log` | PM2 标准输出日志 |
| `~/.pm2/logs/pdf-print-server-error.log` | PM2 错误日志 |
