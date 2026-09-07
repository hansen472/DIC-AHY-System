/**
 * 新增报修单实时推送（企业微信）
 *
 * 每 2 分钟轮询 MIC 数据库，查询 mr_id > last_time_mr_id 的新增报修单，
 * 逐条推送到企业微信 Webhook，推送后更新 last_time_mr_id。
 *
 * 轮询间隔：2 分钟
 */

const axios = require('axios');
const { micPool } = require('./db-mic-config');
const { pool: mainPool } = require('./db-config');

const WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=7f6b079d-6edd-42bf-a91f-99f774af6def';
const PUSH_TYPE = 'new_repair';
const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 分钟

let pollTimer = null;

/**
 * 获取上次推送的最大 mr_id
 */
async function getLastMrId() {
  try {
    // 确保记录存在
    await mainPool.execute(
      "INSERT IGNORE INTO push_state (push_type, last_mr_id) VALUES (?, 0)",
      [PUSH_TYPE]
    );
    const [rows] = await mainPool.execute(
      'SELECT last_mr_id FROM push_state WHERE push_type = ?',
      [PUSH_TYPE]
    );
    return rows.length > 0 ? rows[0].last_mr_id : 0;
  } catch (err) {
    console.error('[new-repair-notifier] 获取 last_mr_id 失败:', err.message);
    return 0;
  }
}

/**
 * 更新 last_time_mr_id
 */
async function updateLastMrId(mrId) {
  try {
    await mainPool.execute(
      'UPDATE push_state SET last_mr_id = ? WHERE push_type = ?',
      [mrId, PUSH_TYPE]
    );
  } catch (err) {
    console.error('[new-repair-notifier] 更新 last_mr_id 失败:', err.message);
  }
}

/**
 * 查询新增报修单（mr_id > lastMrId）
 */
async function queryNewRepairs(lastMrId) {
  const sql = `SELECT 
    mr.mr_id,
    mr.mr_name,
    mr.mr_requester,
    mr.mr_request_time,
    mr.mr_failure_time,
    mr.mr_description,
    CONCAT(a.asset_code, ' ', a.asset_name) AS asset_info,
    p.priority_name
FROM 
    mr_list mr
LEFT JOIN 
    asset_list a ON mr.mr_asset_id = a.asset_id
LEFT JOIN 
    mic_priority p ON mr.mr_priority_id = p.priority_id
WHERE 
    mr.mr_id > ?
ORDER BY mr.mr_id ASC`;
  const [rows] = await micPool.execute(sql, [lastMrId]);
  return rows;
}

/**
 * 清理字符串
 */
function clean(v) {
  return v ? String(v).replace(/\n/g, ' ').trim() : '';
}

/**
 * 逐条推送新增报修单到企业微信
 */
async function pushToWechat(data) {
  for (const item of data) {
    const markdown = `### 🛠️ 新增报修单通知

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
  let logPush;
  try { logPush = require('./server').logPush; } catch (_) { /* server 尚未就绪 */ }

  try {
    const lastMrId = await getLastMrId();
    const data = await queryNewRepairs(lastMrId);

    if (data.length === 0) {
      // 无新增，静默跳过
      return;
    }

    console.log(`[new-repair-notifier] 发现 ${data.length} 条新增报修单（last_mr_id=${lastMrId}）`);

    await pushToWechat(data);

    // 更新 last_time_mr_id 为本批次最大 mr_id
    const maxMrId = Math.max(...data.map(r => r.mr_id));
    await updateLastMrId(maxMrId);

    console.log(`[new-repair-notifier] 推送完成，共 ${data.length} 条，last_mr_id 更新为 ${maxMrId}`);

    if (logPush) {
      const summary = `自动推送：新增报修单 ${data.length} 条（mr_id ${lastMrId}→${maxMrId}）`;
      await logPush('new_repair', 'wechat', 'success', summary, data.length, WEBHOOK_URL, 'system');
    }
  } catch (err) {
    console.error('[new-repair-notifier] 检测/推送失败:', err.message);
    if (logPush) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('new_repair', 'wechat', 'failed', '自动推送失败', 0, WEBHOOK_URL, 'system', errMsg).catch(() => {});
    }
  }
}

/**
 * 启动轮询定时任务（每 2 分钟）
 */
function startPolling() {
  console.log(`[new-repair-notifier] 轮询任务已启动，每 ${POLL_INTERVAL_MS / 1000} 秒检测一次新增报修单`);
  // 首次延迟 30 秒后执行，等待系统就绪
  setTimeout(() => {
    checkAndPush();
    pollTimer = setInterval(checkAndPush, POLL_INTERVAL_MS);
  }, 30000);
}

module.exports = { startPolling, checkAndPush };
