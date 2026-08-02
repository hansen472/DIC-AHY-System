/**
 * 供应商资质到期邮件提醒
 *
 * 每天早上 8 点自动检测 entry_supplier_qualifications 表中
 * current_status = 'active' 且 expiry_date 距离当前日期 30/60/90 天以内
 * （含已过期）的记录，并通过 prudoct_list_id 关联 product_list
 * 获取公司及产品信息，将结果发送到指定邮箱。
 */

const nodemailer = require('nodemailer');
const { pool } = require('./db-config');

// SMTP 配置（可通过环境变量覆盖）
const SMTP_HOST = process.env.SMTP_HOST || '172.22.44.75';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25', 10);
const SMTP_FROM = process.env.SMTP_FROM || 'DIC@aptar.com';
// 多个收件人用逗号分隔
const SMTP_TO = process.env.SMTP_TO || 'hansen.xu@aptar.com,huijuan.zhou@aptar.com';
const MAX_DAYS = 90;
const THRESHOLDS = [
  { days: 30, label: '30 天内' },
  { days: 60, label: '2 个月内' },
  { days: 90, label: '3 个月内' }
];

/**
 * 获取下一次早上 8 点的时间戳（毫秒）
 */
function getNext8AM() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

/**
 * 记录系统操作日志到 supplier_qualification_logs
 */
async function logSystemOperation(action, detail) {
  try {
    await pool.execute(
      `INSERT INTO supplier_qualification_logs
       (username, action, supplier_id, supplier_name, detail, ip_address, computer_name, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'system',
        action,
        null,
        null,
        detail ? JSON.stringify(detail) : null,
        '127.0.0.1',
        'system',
        'email-notifier'
      ]
    );
  } catch (err) {
    console.error('记录系统操作日志失败:', err.message);
  }
}

/**
 * 查询资质即将到期（或已过期）的活跃记录
 */
async function findExpiringRecords() {
  const sql = `
    SELECT
      eq.supplier_name,
      eq.qualification_name,
      eq.expiry_date,
      DATEDIFF(eq.expiry_date, CURDATE()) AS days_remaining,
      p.company_name,
      p.product_name,
      p.model,
      p.manufacturer,
      p.status AS product_status
    FROM entry_supplier_qualifications eq
    LEFT JOIN product_list p ON eq.prudoct_list_id = p.id
    WHERE eq.current_status = 'active'
      AND eq.expiry_date IS NOT NULL
      AND eq.permanent_valid = 0
      AND eq.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    ORDER BY eq.expiry_date ASC, eq.supplier_name ASC, eq.qualification_name ASC
  `;
  const [rows] = await pool.execute(sql, [MAX_DAYS]);
  return rows;
}

/**
 * 发送邮件
 */
async function sendEmail(subject, htmlBody) {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    // 内部 SMTP 服务器通常不需要认证；如需要，请通过环境变量配置
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    } : undefined,
    // 允许自签名证书（内部服务器常见）
    tls: {
      rejectUnauthorized: false
    }
  });

  const info = await transporter.sendMail({
    from: SMTP_FROM,
    to: SMTP_TO,
    subject,
    html: htmlBody
  });

  console.log(`邮件已发送: ${info.messageId}`);
  return info;
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
 * 执行一次检测并发送邮件
 */
async function checkAndNotify() {
  try {
    const expiring = await findExpiringRecords();
    if (expiring.length === 0) {
      console.log('资质到期检测完成：无到期或即将到期的记录');
      return;
    }

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
    let sectionsHtml = '';

    THRESHOLDS.forEach(t => {
      const rows = buckets[t.label];
      if (rows.length === 0) return;

      sectionsHtml += `
        <h3>${escapeHtml(t.label)}（${rows.length} 条）</h3>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; margin-bottom: 20px;">
          <thead>
            <tr style="background-color: #f7fafc;">
              <th>公司名称</th>
              <th>产品名称</th>
              <th>型号</th>
              <th>生产商</th>
              <th>产品状态</th>
              <th>资质名称</th>
              <th>供应商名称</th>
              <th>过期日期</th>
              <th>剩余天数</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHtml(r.company_name)}</td>
                <td>${escapeHtml(r.product_name)}</td>
                <td>${escapeHtml(r.model)}</td>
                <td>${escapeHtml(r.manufacturer)}</td>
                <td>${escapeHtml(r.product_status)}</td>
                <td>${escapeHtml(r.qualification_name)}</td>
                <td>${escapeHtml(r.supplier_name)}</td>
                <td>${escapeHtml(r.expiry_date)}</td>
                <td>${r.days_remaining < 0 ? '已过期 ' + Math.abs(r.days_remaining) + ' 天' : r.days_remaining + ' 天'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    });

    const html = `
      <h2>供应商资质到期提醒（${today}）</h2>
      <p>以下供应商资质的过期日期距离当前日期已不足 30 / 60 / 90 天（含已过期），请及时处理。</p>
      ${sectionsHtml}
      <p style="color: #718096; font-size: 12px; margin-top: 16px;">
        本邮件由系统自动发送，请勿回复。
      </p>
    `;

    await sendEmail(`供应商资质到期提醒（${today}）`, html);
    console.log(`供应商资质到期提醒已发送，共 ${expiring.length} 条记录`);

    await logSystemOperation('自动发送邮件', {
      message: '系统自动发送供应商资质到期提醒邮件',
      to: SMTP_TO,
      count: expiring.length,
      thresholds: THRESHOLDS.map(t => t.label),
      records: expiring.map(r => ({
        supplier_name: r.supplier_name,
        qualification_name: r.qualification_name,
        expiry_date: r.expiry_date,
        company_name: r.company_name,
        product_name: r.product_name
      }))
    });
  } catch (err) {
    console.error('资质到期检测/邮件发送失败:', err.message);

    await logSystemOperation('自动发送邮件失败', {
      message: '系统自动发送供应商资质到期提醒邮件失败',
      to: SMTP_TO,
      error: err.message
    });
  }
}

/**
 * 启动每日 8 点定时任务
 */
function startDailyCheck() {
  const delay = getNext8AM();
  const nextRun = new Date(Date.now() + delay);
  console.log(`营业执照到期检测任务将于 ${nextRun.toLocaleString('zh-CN')} 首次执行`);

  setTimeout(() => {
    checkAndNotify();
    // 之后每 24 小时执行一次
    setInterval(checkAndNotify, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { startDailyCheck, checkAndNotify };
