/**
 * QC 维护计划工单自动推送（企业微信）
 *
 * 每天早上 08:10 自动查询 MIC 数据库中 QC 维护计划待执行工单，
 * 通过企业微信 Webhook 推送汇总通知。
 *
 * 推送时间：每天 08:10
 */

const axios = require('axios');
const { micPool } = require('./db-mic-config');

const WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=7f6b079d-6edd-42bf-a91f-99f774af6def';

const QC_MAINTENANCE_SQL = `SELECT
    p.mp_code AS 'PM编码',
    CONCAT(IFNULL(a.asset_code, ''), ' - ', IFNULL(a.asset_name, '')) AS '设备',
    p.mp_name AS 'PM名称',
    COALESCE(e.employee_name, p.mp_responsible_id) AS '负责人',
    CASE p.mp_status
        WHEN 0 THEN '闲置'
        WHEN 1 THEN '活跃'
        WHEN 2 THEN '已搁置'
        ELSE CONCAT('未知状态(', p.mp_status, ')')
    END AS '状态',
    w.wo_schedule_time AS '计划执行时间'
FROM eng_maintenance_plan p
INNER JOIN wo_list w ON p.mp_id = w.mp_id
INNER JOIN asset_list a ON p.mp_asset_id = a.asset_id
LEFT JOIN admin_employee e ON p.mp_responsible_id = e.user_id
WHERE w.wo_status = 0
  AND w.mp_id IS NOT NULL
  AND p.mp_code LIKE 'QC-MP%'
ORDER BY w.wo_schedule_time`;

const STATUS_EMOJI = {
  '闲置': '⚪', '活跃': '🟢', '已搁置': '🔴'
};

const BATCH_SIZE = 15;

// 定时器引用
let dailyTimer = null;

/**
 * 计算距离下一个 08:10 的毫秒数
 */
function getNextDay0810() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 10, 0, 0);

  if (now >= target) {
    // 已过今天 08:10，等到明天
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}

/**
 * 查询 QC 维护计划待执行工单
 */
async function queryQcMaintenance() {
  const [rows] = await micPool.execute(QC_MAINTENANCE_SQL);
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
      '### 🔧 QC维护计划待执行工单列表（自动推送）',
      `#### 共查询到 ${total} 条待执行工单`,
      `#### 第 ${batchNo}/${totalBatches} 批`,
      '| PM编码 | 设备 | PM名称 | 负责人 | 状态 | 计划执行时间 |',
      '| :--- | :--- | :--- | :--- | :--- | :--- |'
    ];

    batch.forEach(item => {
      const mpCode = clean(item['PM编码']);
      const asset = clean(item['设备']);
      const mpName = clean(item['PM名称']);
      const responsible = clean(item['负责人']);
      const status = clean(item['状态']);
      const scheduleTime = clean(item['计划执行时间']);
      const emoji = STATUS_EMOJI[status] || '⚪';
      lines.push(`| ${mpCode} | ${asset} | ${mpName} | ${responsible} | ${emoji} ${status} | ${scheduleTime} |`);
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
    console.log('[qc-maintenance-notifier] 开始检测 QC 维护计划待执行工单...');
    const data = await queryQcMaintenance();

    if (data.length === 0) {
      console.log('[qc-maintenance-notifier] 无待执行工单记录，跳过推送');
      return;
    }

    await pushToWechat(data, data.length);
    console.log(`[qc-maintenance-notifier] 推送完成，共 ${data.length} 条待执行工单`);

    if (logPush) {
      const summary = `自动推送：QC维护计划待执行工单 ${data.length} 条`;
      await logPush('qc_maintenance', 'wechat', 'success', summary, data.length, WEBHOOK_URL, 'system');
    }
  } catch (err) {
    console.error('[qc-maintenance-notifier] 检测/推送失败:', err.message);
    if (logPush) {
      const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
      await logPush('qc_maintenance', 'wechat', 'failed', '自动推送失败', 0, WEBHOOK_URL, 'system', errMsg).catch(() => {});
    }
  }
}

/**
 * 启动每天 08:10 定时任务
 *
 * 先通过 setTimeout 等待到下一个 08:10，
 * 执行一次后通过 setInterval 每 24 小时重复执行。
 */
function startDailyPush() {
  const delay = getNextDay0810();
  const nextRun = new Date(Date.now() + delay);
  console.log(`[qc-maintenance-notifier] 定时任务将于 ${nextRun.toLocaleString('zh-CN')}（每天 08:10）首次执行`);

  dailyTimer = setTimeout(() => {
    checkAndPush();
    // 之后每 24 小时执行一次（24 × 60 × 60 × 1000 ms）
    setInterval(checkAndPush, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { startDailyPush, checkAndPush };
