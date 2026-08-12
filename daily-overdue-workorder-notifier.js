/**
 * 每日未完成工单自动推送（企业微信）
 *
 * 每天下午 15:30 自动查询 MIC 数据库中当天创建的未完成日巡检工单，
 * 通过企业微信 Webhook 推送汇总通知。
 *
 * 推送时间：每天 15:30
 */

const axios = require('axios');
const { micPool } = require('./db-mic-config');

const WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=7f6b079d-6edd-42bf-a91f-99f774af6def';

const DAILY_SQL = `SELECT
  CONCAT(wo.wo_id, ' ', wo.wo_name) AS wo_info,
  CONCAT(a.asset_code, ' ', a.asset_name) AS asset_names,
  wo.wo_schedule_time,
  ms.status_name_cn
FROM wo_list wo
LEFT JOIN asset_list a ON wo.wo_asset_id = a.asset_id
LEFT JOIN mic_status ms ON wo.wo_status = ms.status_id
WHERE DATE(wo.wo_creation_time) = CURDATE()
  AND wo.wo_type_id = 3
  AND wo.wo_finish_time IS NULL`;

const STATUS_EMOJI = {
  '已创建': '⚪', '等待备件': '🟡', '等待外委': '🟣',
  '已安排': '🔵', '已搁置': '🔴', '进行中': '🟢'
};

const BATCH_SIZE = 15;

// 定时器引用
let dailyTimer = null;

/**
 * 计算距离下一个 15:30 的毫秒数
 */
function getNextDay1530() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 30, 0, 0);

  if (now >= target) {
    // 已过今天 15:30，等到明天
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

/**
 * 查询当天未完成工单
 */
async function queryDailyWorkorders() {
  const [rows] = await micPool.execute(DAILY_SQL);
  return rows;
}

/**
 * 清理字符串，防止破坏 Markdown 表格格式
 */
function clean(v) {
  return v ? String(v).replace(/\|/g, ' ').replace(/\n/g, ' ').trim() : '';
}

/**
 * 将工单数据分批推送到企业微信
 */
async function pushToWechat(data, total) {
  const totalBatches = Math.ceil(data.length / BATCH_SIZE);

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batchNo = Math.floor(i / BATCH_SIZE) + 1;
    const batch = data.slice(i, i + BATCH_SIZE);

    const lines = [
      '### 📋 未完成日巡检工单列表（自动推送）',
      `#### 共查询到 ${total} 条未完成日工单`,
      `#### 第 ${batchNo}/${totalBatches} 批`,
      '| 工单 | 资产 | 安排时间 | 类型 | 状态 |',
      '| :--- | :--- | :--- | :--- | :--- |'
    ];

    batch.forEach(item => {
      const woInfo = clean(item.wo_info);
      const assetName = clean(item.asset_names);
      const scheduleTime = clean(item.wo_schedule_time);
      const assetType = '日巡检工单';
      const statusName = clean(item.status_name_cn);
      const emoji = STATUS_EMOJI[statusName] || '⚪';
      lines.push(`| ${woInfo} | ${assetName} | ${scheduleTime} | ${assetType} | ${emoji} ${statusName} |`);
    });

    const markdown = lines.join('\n');
    const payload = { msgtype: 'markdown_v2', markdown_v2: { content: markdown } };
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
    console.log('[daily-overdue-workorder-notifier] 开始检测当天未完成工单...');
    const data = await queryDailyWorkorders();

    if (data.length === 0) {
      console.log('[daily-overdue-workorder-notifier] 无未完成工单记录，跳过推送');
      return;
    }

    await pushToWechat(data, data.length);
    console.log(`[daily-overdue-workorder-notifier] 推送完成，共 ${data.length} 条未完成工单`);

    if (logPush) {
      const summary = `自动推送：未完成日巡检工单 ${data.length} 条`;
      await logPush('daily_workorder', 'wechat', 'success', summary, data.length, WEBHOOK_URL, 'system');
    }
  } catch (err) {
    console.error('[daily-overdue-workorder-notifier] 检测/推送失败:', err.message);
    if (logPush) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('daily_workorder', 'wechat', 'failed', '自动推送失败', 0, WEBHOOK_URL, 'system', errMsg).catch(() => {});
    }
  }
}

/**
 * 启动每天 15:30 定时任务
 *
 * 先通过 setTimeout 等待到下一个 15:30，
 * 执行一次后通过 setInterval 每 24 小时重复执行。
 */
function startDailyPush() {
  const delay = getNextDay1530();
  const nextRun = new Date(Date.now() + delay);
  console.log(`[daily-overdue-workorder-notifier] 定时任务将于 ${nextRun.toLocaleString('zh-CN')}（每天 15:30）首次执行`);

  dailyTimer = setTimeout(() => {
    checkAndPush();
    // 之后每 24 小时执行一次（24 × 60 × 60 × 1000 ms）
    setInterval(checkAndPush, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { startDailyPush, checkAndPush };
