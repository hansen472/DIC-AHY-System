/**
 * 未处理请求自动推送（企业微信）
 *
 * 每天早上 07:59 自动查询 MIC 数据库中未处理的报修请求，
 * 通过企业微信 Webhook 逐条推送通知。
 *
 * 推送时间：每天 07:59
 */

const axios = require('axios');
const { micPool } = require('./db-mic-config');

const WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=7f6b079d-6edd-42bf-a91f-99f774af6def';

const UNPROCESSED_SQL = `SELECT
    m.mr_id,
    m.mr_name,
    m.mr_requester,
    m.mr_request_time,
    m.mr_failure_time,
    m.mr_description,
    p.priority_name
FROM mr_list m
LEFT JOIN asset_list a
    ON m.mr_asset_id = a.asset_id
LEFT JOIN mic_priority p
    ON m.mr_priority_id = p.priority_id
WHERE m.mr_status = 0`;

// 定时器引用
let dailyTimer = null;

/**
 * 计算距离下一个 07:59 的毫秒数
 */
function getNextDay0759() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 59, 0, 0);

  if (now >= target) {
    // 已过今天 07:59，等到明天
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

/**
 * 查询未处理请求
 */
async function queryUnprocessedRequests() {
  const [rows] = await micPool.execute(UNPROCESSED_SQL);
  return rows;
}

/**
 * 清理字符串，防止破坏格式
 */
function clean(v) {
  return v ? String(v).replace(/\n/g, ' ').trim() : '';
}

/**
 * 将未处理请求逐条推送到企业微信
 */
async function pushToWechat(data) {
  for (const item of data) {
    const markdown = `### 📌 未处理的报修单通知

- **报修ID**: ${clean(item.mr_id)}
- **固定资产名称**: ${clean(item.mr_name)}
- **报修名称**: ${clean(item.mr_name)}
- **报修人**: ${clean(item.mr_requester)}
- **报修时间**: ${clean(item.mr_request_time)}
- **失效发生时间**: ${clean(item.mr_failure_time)}
- **问题描述**: ${clean(item.mr_description)}
- **优先级**: ${clean(item.priority_name)}`;

    const payload = { msgtype: 'markdown', markdown: { content: markdown } };
    await axios.post(WEBHOOK_URL, payload, { timeout: 10000 });
  }
}

/**
 * 执行一次检测并推送
 */
async function checkAndPush() {
  // 懒加载 logPush，避免与 server.js 的循环依赖
  let logPush;
  try { logPush = require('./server').logPush; } catch (_) { /* server 尚未就绪 */ }

  try {
    console.log('[unprocessed-request-notifier] 开始检测未处理请求...');
    const data = await queryUnprocessedRequests();

    if (data.length === 0) {
      console.log('[unprocessed-request-notifier] 无未处理请求，跳过推送');
      return;
    }

    await pushToWechat(data);
    console.log(`[unprocessed-request-notifier] 推送完成，共 ${data.length} 条未处理请求`);

    if (logPush) {
      const summary = `自动推送：未处理请求 ${data.length} 条`;
      await logPush('unprocessed_request', 'wechat', 'success', summary, data.length, WEBHOOK_URL, 'system');
    }
  } catch (err) {
    console.error('[unprocessed-request-notifier] 检测/推送失败:', err.message);
    if (logPush) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('unprocessed_request', 'wechat', 'failed', '自动推送失败', 0, WEBHOOK_URL, 'system', errMsg).catch(() => {});
    }
  }
}

/**
 * 启动每天 07:59 定时任务
 *
 * 先通过 setTimeout 等待到下一个 07:59，
 * 执行一次后通过 setInterval 每 24 小时重复执行。
 */
function startDailyPush() {
  const delay = getNextDay0759();
  const nextRun = new Date(Date.now() + delay);
  console.log(`[unprocessed-request-notifier] 定时任务将于 ${nextRun.toLocaleString('zh-CN')}（每天 07:59）首次执行`);

  dailyTimer = setTimeout(() => {
    checkAndPush();
    // 之后每 24 小时执行一次（24 × 60 × 60 × 1000 ms）
    setInterval(checkAndPush, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { startDailyPush, checkAndPush };
