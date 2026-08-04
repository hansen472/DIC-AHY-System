/**
 * 仪器/仪表到期周报邮件提醒
 *
 * 每周二早上 8:10 自动查询 MIC 数据库中距离当前日期 30/60/90 天
 * 内即将到期的在用仪器/仪表数量，并通过邮件发送汇总通知。
 *
 * 收件人：lunhan.li@aptar.com
 * 发送时间：每周二 08:10
 */

const nodemailer = require('nodemailer');
const { micPool } = require('./db-mic-config');

// SMTP 配置（与 email-notifier 保持一致）
const SMTP_HOST = process.env.SMTP_HOST || '172.22.44.75';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25', 10);
const SMTP_FROM = process.env.SMTP_FROM || 'DIC@aptar.com';
const SMTP_TO = process.env.SMTP_TO || 'lunhan.li@aptar.com';

const MAX_DAYS = 90;
const THRESHOLDS = [
  { days: 30, label: '30 天内' },
  { days: 60, label: '2 个月内' },
  { days: 90, label: '3 个月内' }
];

// 定时器引用，用于避免重复调度
let weeklyTimer = null;

/**
 * 计算距离下一个周二 08:10 的毫秒数
 */
function getNextTuesday810() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=周日, 1=周一, 2=周二
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 10, 0, 0);

  let daysUntilTue;
  if (dayOfWeek === 2) {
    // 今天是周二：若已过 8:10 则等到下周二，否则今天
    if (now >= target) {
      daysUntilTue = 7;
    } else {
      daysUntilTue = 0;
    }
  } else {
    daysUntilTue = (2 - dayOfWeek + 7) % 7;
  }

  target.setDate(target.getDate() + daysUntilTue);
  return target.getTime() - now.getTime();
}

/**
 * 查询 MIC 数据库中即将到期的仪器/仪表记录（含详情）
 * 使用与 instrument-meter-service.js 相同的查询条件
 */
async function findExpiringInstruments() {
  const sql = `
    SELECT
      asset_list.asset_name AS \`仪器/仪表名称\`,
      asset_list.asset_code AS \`仪器/仪表编码\`,
      asset_list.asset_ff_5 AS \`安装位置\`,
      asset_list.asset_ff_9 AS \`本次检验日期\`,
      asset_list.asset_ff_10 AS \`下次检验日期\`,
      asset_location.location_name AS \`所在位置\`,
      DATEDIFF(asset_list.asset_ff_10, CURDATE()) AS days_remaining
    FROM asset_list
    LEFT JOIN mic_asset_status ON asset_list.asset_status = mic_asset_status.asset_status_code
    LEFT JOIN asset_location ON asset_list.location_id = asset_location.location_id
    WHERE asset_list.asset_nature = 8
      AND mic_asset_status.asset_status_name IN ('在用', '备用')
      AND asset_list.asset_ff_10 <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    ORDER BY asset_list.asset_ff_10 ASC
  `;
  const [rows] = await micPool.execute(sql, [MAX_DAYS]);
  return rows;
}

/**
 * HTML 转义，防止邮件内容中的特殊字符破坏格式
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 发送邮件
 */
async function sendEmail(subject, htmlBody) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined,
    tls: { rejectUnauthorized: false }
  });

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to: SMTP_TO,
    subject,
    html: htmlBody
  });

  console.log(`[instrument-meter-notifier] 邮件已发送: ${info.messageId}`);
  return info;
}

/**
 * 执行一次检测并发送邮件
 */
async function checkAndNotify() {
  try {
    console.log('[instrument-meter-notifier] 开始检测仪器/仪表到期情况...');
    const expiring = await findExpiringInstruments();

    if (expiring.length === 0) {
      console.log('[instrument-meter-notifier] 无即将到期的仪器/仪表记录，跳过发送');
      return;
    }

    // 按阈值分桶（30天内 / 60天内 / 90天内，含已过期）
    const buckets = {};
    THRESHOLDS.forEach(t => { buckets[t.label] = []; });

    expiring.forEach(r => {
      const days = r.days_remaining;
      if (days <= 30) {
        buckets['30 天内'].push(r);
      } else if (days <= 60) {
        buckets['2 个月内'].push(r);
      } else if (days <= 90) {
        buckets['3 个月内'].push(r);
      }
    });

    const today = new Date().toLocaleDateString('zh-CN');

    // 汇总统计行
    const summaryRows = THRESHOLDS.map(t =>
      `<tr>
        <td style="padding:8px 16px; border:1px solid #e2e8f0; font-weight:600; text-align:center;">${escapeHtml(t.label)}</td>
        <td style="padding:8px 16px; border:1px solid #e2e8f0; font-size:18px; font-weight:bold; color:#1e40af; text-align:center;">${buckets[t.label].length}</td>
      </tr>`
    ).join('');

    const summaryTable = `
      <table style="border-collapse:collapse; margin:16px 0;">
        <thead>
          <tr style="background-color:#f1f5f9;">
            <th style="padding:8px 16px; border:1px solid #e2e8f0; text-align:left;">到期时间范围</th>
            <th style="padding:8px 16px; border:1px solid #e2e8f0; text-align:center;">记录数量</th>
          </tr>
        </thead>
        <tbody>${summaryRows}</tbody>
      </table>
    `;

    // 分桶详情表（仅展示有记录的分桶）
    let detailSections = '';
    THRESHOLDS.forEach(t => {
      const rows = buckets[t.label];
      if (rows.length === 0) return;

      // 每个分桶最多展示 30 条明细，防止邮件过长
      const displayRows = rows.slice(0, 30);
      const moreText = rows.length > 30 ? `<p style="color:#718096; font-size:12px;">（仅显示前 30 条，共 ${rows.length} 条）</p>` : '';

      detailSections += `
        <h3 style="margin-top:24px; color:#2d3748;">${escapeHtml(t.label)}（${rows.length} 条）</h3>
        ${moreText}
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; margin-bottom:16px;">
          <thead>
            <tr style="background-color:#f7fafc;">
              <th>仪器/仪表名称</th>
              <th>仪器/仪表编码</th>
              <th>安装位置</th>
              <th>本次检验日期</th>
              <th>下次检验日期</th>
              <th>所在位置</th>
              <th>剩余天数</th>
            </tr>
          </thead>
          <tbody>
            ${displayRows.map(r => `
              <tr>
                <td>${escapeHtml(r['仪器/仪表名称'])}</td>
                <td>${escapeHtml(r['仪器/仪表编码'])}</td>
                <td>${escapeHtml(r['安装位置'])}</td>
                <td>${escapeHtml(r['本次检验日期'])}</td>
                <td>${escapeHtml(r['下次检验日期'])}</td>
                <td>${escapeHtml(r['所在位置'])}</td>
                <td>${r.days_remaining < 0 ? '已过期 ' + Math.abs(r.days_remaining) + ' 天' : r.days_remaining + ' 天'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    });

    const html = `
      <div style="font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; max-width:800px; margin:0 auto;">
        <h2 style="color:#1e3a8a;">仪器/仪表到期周报提醒（${today}）</h2>
        <p>以下为距离当前日期 30 / 60 / 90 天内即将到期（含已过期）的在用仪器/仪表汇总：</p>
        ${summaryTable}
        ${detailSections}
        <p style="color:#718096; font-size:12px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:12px;">
          本邮件由系统自动发送（每周二 08:10），请勿回复。
        </p>
      </div>
    `;

    const subject = `仪器/仪表到期周报提醒（${today}）`;
    await sendEmail(subject, html);
    console.log(`[instrument-meter-notifier] 邮件已发送，共 ${expiring.length} 条到期记录 ` +
      `[30天:${buckets['30 天内'].length} / 60天:${buckets['2 个月内'].length} / 90天:${buckets['3 个月内'].length}]`);
  } catch (err) {
    console.error('[instrument-meter-notifier] 检测/邮件发送失败:', err.message);
  }
}

/**
 * 启动每周二 08:10 定时任务
 *
 * 先通过 setTimeout 等待到下一个周二 08:10，
 * 执行一次后通过 setInterval 每 7 天重复执行。
 */
function startWeeklyCheck() {
  const delay = getNextTuesday810();
  const nextRun = new Date(Date.now() + delay);
  console.log(`[instrument-meter-notifier] 定时任务将于 ${nextRun.toLocaleString('zh-CN')}（周二 08:10）首次执行`);

  weeklyTimer = setTimeout(() => {
    checkAndNotify();
    // 之后每 7 天执行一次（7 × 24 × 60 × 60 × 1000 ms）
    setInterval(checkAndNotify, 7 * 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { startWeeklyCheck, checkAndNotify };
