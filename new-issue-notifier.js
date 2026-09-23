/**
 * 新增出库单实时推送（企业微信）
 *
 * 每 10 分钟轮询 MIC 数据库，查询 issue_status = 5 的未处理出库单，
 * 每个部品单独成行，合并为一条 markdown 表格消息推送到企业微信 Webhook。
 *
 * 轮询间隔：10 分钟
 */

const axios = require('axios');
const { micPool } = require('./db-mic-config');
const { pool } = require('./db-config');
const { createLogPush } = require('./services/log.service');
const logPush = createLogPush(pool);

const WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=7f6b079d-6edd-42bf-a91f-99f774af6def';
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 分钟

let pollTimer = null;

/**
 * 查询未处理出库单（issue_status = 5）
 * 每个 issue 与部品组合一行
 */
async function queryNewIssues() {
  const sql = `SELECT
    i.issue_id,
    i.issue_creator,
    i.issue_creation_time,
    i.wo_id,
    w.wo_name,
    s.sp_code,
    s.sp_name,
    d.issue_qty,
    ae.employee_name AS submitted_to_name
FROM sp_issue i
LEFT JOIN wo_list w ON i.wo_id = w.wo_id
LEFT JOIN admin_employee ae ON i.issue_submitted_to = ae.user_id
LEFT JOIN sp_issue_details d ON i.issue_id = d.issue_id
LEFT JOIN sp_list s ON d.sp_id = s.sp_id
WHERE i.issue_status = 5
ORDER BY i.issue_id ASC, d.issue_id ASC`;
  const [rows] = await micPool.execute(sql);
  return rows;
}

/**
 * 清理字符串，防止破坏 Markdown 表格格式
 */
function clean(v) {
  return v ? String(v).replace(/\|/g, ' ').replace(/\n/g, ' ').trim() : '';
}

const TABLE_HEADER = `| 申请ID | 申请人 | 提交时间 | 工单ID | 工单名 | 申请部品名 | 申请数量 | 核实人 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |`;

/**
 * 合并所有记录为一条 markdown_v2 表格消息推送到企业微信
 */
async function pushToWechat(data) {
  const lines = [
    '### 📦 新增出库单通知',
    `#### 共 ${data.length} 条记录`,
    TABLE_HEADER
  ];

  data.forEach(item => {
    const spName = [clean(item.sp_code), clean(item.sp_name)].filter(Boolean).join(' ');
    const parts = [
      clean(item.issue_id),
      clean(item.issue_creator),
      clean(item.issue_creation_time),
      clean(item.wo_id),
      clean(item.wo_name),
      spName,
      clean(item.issue_qty),
      clean(item.submitted_to_name)
    ];
    lines.push('| ' + parts.join(' | ') + ' |');
  });

  const markdown = lines.join('\n');
  const payload = { msgtype: 'markdown_v2', markdown_v2: { content: markdown } };
  await axios.post(WEBHOOK_URL, payload, { timeout: 10000 });
}

/**
 * 执行一次检测并推送
 */
async function checkAndPush() {
  try {
    const data = await queryNewIssues();

    if (data.length === 0) {
      // 无未处理请求，静默跳过
      return;
    }

    console.log(`[new-issue-notifier] 发现 ${data.length} 条未处理出库单`);

    await pushToWechat(data);

    console.log(`[new-issue-notifier] 推送完成，共 ${data.length} 条`);

    if (logPush) {
      const summary = `自动推送：未处理出库单 ${data.length} 条`;
      await logPush('new_issue', 'wechat', 'success', summary, data.length, WEBHOOK_URL, 'system');
    }
  } catch (err) {
    console.error('[new-issue-notifier] 检测/推送失败:', err.message);
    if (logPush) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('new_issue', 'wechat', 'failed', '自动推送失败', 0, WEBHOOK_URL, 'system', errMsg).catch(() => {});
    }
  }
}

/**
 * 启动轮询定时任务（每 10 分钟）
 */
function startPolling() {
  console.log(`[new-issue-notifier] 轮询任务已启动，每 ${POLL_INTERVAL_MS / 1000} 秒（10 分钟）检测一次新增出库单`);
  setTimeout(() => {
    checkAndPush();
    pollTimer = setInterval(checkAndPush, POLL_INTERVAL_MS);
  }, 30000);
}

module.exports = { startPolling, checkAndPush };
