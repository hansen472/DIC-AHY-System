/**
 * 新增出库单实时推送（企业微信）
 *
 * 每 10 分钟轮询 MIC 数据库，查询所有未处理出库单（issue_status = 0），
 * 按 issue_id 分组合并部品信息后，逐条推送到企业微信 Webhook。
 *
 * 轮询间隔：10 分钟
 */

const axios = require('axios');
const { micPool } = require('./db-mic-config');

const WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=7f6b079d-6edd-42bf-a91f-99f774af6def';
const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 分钟

let pollTimer = null;

/**
 * 查询所有未处理出库单
 * 按 issue_id 分组，聚合部品信息
 */
async function queryNewIssues() {
  const sql = `SELECT
    i.issue_id,
    i.issue_creator,
    i.issue_validator,
    i.issue_creation_time,
    i.wo_id,
    w.wo_name,
    GROUP_CONCAT(DISTINCT CONCAT(s.sp_code, ' ', s.sp_name) SEPARATOR ', ') AS sp_names,
    SUM(d.issue_qty) AS total_qty
FROM sp_issue i
LEFT JOIN wo_list w ON i.wo_id = w.wo_id
LEFT JOIN sp_issue_details d ON i.issue_id = d.issue_id
LEFT JOIN sp_list s ON d.sp_id = s.sp_id
WHERE i.issue_status = 0
GROUP BY i.issue_id, i.issue_creator, i.issue_validator, i.issue_creation_time, i.wo_id, w.wo_name
ORDER BY i.issue_id ASC`;
  const [rows] = await micPool.execute(sql);
  return rows;
}

/**
 * 清理字符串
 */
function clean(v) {
  return v ? String(v).replace(/\n/g, ' ').trim() : '';
}

/**
 * 逐条推送新增出库单到企业微信
 */
async function pushToWechat(data) {
  for (const item of data) {
    const markdown = `### 🛠️ 新增出库单通知

- **申请ID**: ${clean(item.issue_id)}
- **申请人**: ${clean(item.issue_creator)}
- **提交时间**: ${clean(item.issue_creation_time)}
- **工单ID**: ${clean(item.wo_id)}
- **工单名**: ${clean(item.wo_name)}
- **申请部品名**: ${clean(item.sp_names)}
- **申请数量**: ${clean(item.total_qty)}
- **核实人**: ${clean(item.issue_validator)}`;

    const payload = { msgtype: 'markdown', markdown: { content: markdown } };
    await axios.post(WEBHOOK_URL, payload, { timeout: 10000 });
  }
}

/**
 * 执行一次检测并推送
 */
async function checkAndPush() {
  let logPush;
  try { logPush = require('./server').logPush; } catch (_) { /* server 尚未就绪 */ }

  try {
    const data = await queryNewIssues();

    if (data.length === 0) {
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
  console.log(`[new-issue-notifier] 轮询任务已启动，每 ${POLL_INTERVAL_MS / 1000} 秒（10 分钟）检测一次未处理出库单`);
  setTimeout(() => {
    checkAndPush();
    pollTimer = setInterval(checkAndPush, POLL_INTERVAL_MS);
  }, 30000);
}

module.exports = { startPolling, checkAndPush };
