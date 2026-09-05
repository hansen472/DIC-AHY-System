/**
 * 仪器/仪表到期邮件提醒
 *
 * 根据用户配置的时间间隔（30/45/60/90/180 天）自动查询 MIC 数据库中
 * 即将到期的在用仪器/仪表数量，并通过邮件发送汇总通知。
 *
 * 收件人：lunhan.li@aptar.com
 * 发送间隔：可配置（默认 30 天）
 */

const nodemailer = require('nodemailer');
const { micPool } = require('./db-mic-config');
const { pool } = require('./db-config');

// SMTP 配置（与 email-notifier 保持一致）
const SMTP_HOST = process.env.SMTP_HOST || '172.22.44.75';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25', 10);
const SMTP_FROM = process.env.SMTP_FROM || 'DIC@aptar.com';
const SMTP_TO = process.env.SMTP_TO || 'lunhan.li@aptar.com';

const MAX_DAYS = 180;
const THRESHOLDS = [
  { days: 30, label: '30 天内' },
  { days: 60, label: '2 个月内' },
  { days: 90, label: '3 个月内' },
  { days: 180, label: '6 个月内' }
];

// 定时器引用，用于避免重复调度
let checkTimer = null;
let checkInterval = null;

// 默认设置（数据库不可用时的回退值）
let currentSettings = { enabled: true, intervalDays: 30 };

// ========== 设置管理 ==========

/**
 * 从数据库读取通知设置
 */
async function loadSettings() {
  try {
    const [rows] = await pool.execute(
      'SELECT enabled, interval_days FROM instrument_meter_notification_settings LIMIT 1'
    );
    if (rows.length > 0) {
      currentSettings = {
        enabled: !!rows[0].enabled,
        intervalDays: rows[0].interval_days || 30
      };
    }
  } catch (err) {
    console.error('[instrument-meter-notifier] 读取设置失败:', err.message);
  }
  return currentSettings;
}

/**
 * 更新通知设置并重新调度定时器
 */
async function updateSettings(enabled, intervalDays) {
  try {
    await pool.execute(
      'UPDATE instrument_meter_notification_settings SET enabled = ?, interval_days = ? WHERE id = 1',
      [enabled ? 1 : 0, intervalDays]
    );
    currentSettings = { enabled, intervalDays };
    // 重新调度定时器
    stopScheduler();
    if (enabled) {
      startScheduler();
    }
    return currentSettings;
  } catch (err) {
    console.error('[instrument-meter-notifier] 更新设置失败:', err.message);
    throw err;
  }
}

/**
 * 获取当前设置（供 API 调用）
 */
function getSettings() {
  return { ...currentSettings };
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

    // 按阈值分桶（30天内 / 60天内 / 90天内 / 180天内，含已过期）
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
      } else if (days <= 180) {
        buckets['6 个月内'].push(r);
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
        <h2 style="color:#1e3a8a;">仪器/仪表到期提醒（${today}）</h2>
        <p>以下为距离当前日期 30 / 60 / 90 / 180 天内即将到期（含已过期）的在用仪器/仪表汇总：</p>
        ${summaryTable}
        ${detailSections}
        <p style="color:#718096; font-size:12px; margin-top:24px; border-top:1px solid #e2e8f0; padding-top:12px;">
          本邮件由系统自动发送（每 ${currentSettings.intervalDays} 天），请勿回复。
        </p>
      </div>
    `;

    const subject = `仪器/仪表到期提醒（${today}）`;
    await sendEmail(subject, html);
    console.log(`[instrument-meter-notifier] 邮件已发送，共 ${expiring.length} 条到期记录 ` +
      `[30天:${buckets['30 天内'].length} / 60天:${buckets['2 个月内'].length} / 90天:${buckets['3 个月内'].length} / 180天:${buckets['6 个月内'].length}]`);

    // 写入推送日志（懒加载避免循环依赖）
    const { logPush } = require('./server');
    const summary = `仪器/仪表到期提醒，共 ${expiring.length} 条（30天:${buckets['30 天内'].length} / 60天:${buckets['2 个月内'].length} / 90天:${buckets['3 个月内'].length} / 180天:${buckets['6 个月内'].length}）`;
    await logPush('instrument_meter', 'email', 'success', summary, expiring.length, SMTP_TO, 'system');
  } catch (err) {
    console.error('[instrument-meter-notifier] 检测/邮件发送失败:', err.message);
    // 写入失败日志
    try {
      const { logPush } = require('./server');
      await logPush('instrument_meter', 'email', 'failed', '仪器/仪表到期提醒发送失败', 0, SMTP_TO, 'system', err.message);
    } catch (_) { /* 日志写入失败不影响主流程 */ }
  }
}

/**
 * 停止定时器调度
 */
function stopScheduler() {
  if (checkTimer) {
    clearTimeout(checkTimer);
    checkTimer = null;
  }
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  console.log('[instrument-meter-notifier] 定时任务已停止');
}

/**
 * 启动定时任务
 *
 * 先通过 setTimeout 等待到次日 08:10 首次执行，
 * 之后按配置的间隔天数重复执行。
 */
function startScheduler() {
  const intervalMs = currentSettings.intervalDays * 24 * 60 * 60 * 1000;

  // 计算到次日 08:10 的延迟
  const now = new Date();
  const nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8, 10, 0, 0);
  const delay = nextRun.getTime() - now.getTime();

  console.log(`[instrument-meter-notifier] 定时任务已启动，间隔 ${currentSettings.intervalDays} 天，` +
    `首次执行时间: ${nextRun.toLocaleString('zh-CN')}`);

  checkTimer = setTimeout(() => {
    checkAndNotify();
    checkInterval = setInterval(checkAndNotify, intervalMs);
  }, delay);
}

/**
 * 初始化：读取设置并启动定时任务
 */
async function startWeeklyCheck() {
  await loadSettings();
  if (currentSettings.enabled) {
    startScheduler();
  } else {
    console.log('[instrument-meter-notifier] 自动邮件通知已停用');
  }
}

module.exports = { startWeeklyCheck, checkAndNotify, loadSettings, updateSettings, getSettings, stopScheduler };
