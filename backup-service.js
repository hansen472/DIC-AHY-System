/**
 * 数据库全量备份服务
 *
 * 功能：
 * 1. 每日凌晨 2 点自动备份 pdf_print_db 到 /backup/mariadb
 * 2. 支持手动触发备份
 * 3. 备份结果写入 db_backups 表
 * 4. 备份失败时发送邮件提醒并记录操作日志
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const nodemailer = require('nodemailer');
const { pool } = require('./db-config');

// 数据库连接配置（与 db-config.js 保持一致，可通过环境变量覆盖）
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'pdfapp';
const DB_PASSWORD = process.env.DB_PASSWORD || 'ahypdfapp123';
const DB_NAME = process.env.DB_NAME || 'pdf_print_db';

// 备份文件存放目录
const BACKUP_DIR = process.env.BACKUP_DIR || '/backup/mariadb';

// SMTP 配置（与 email-notifier.js 保持一致）
const SMTP_HOST = process.env.SMTP_HOST || '172.22.44.75';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '25', 10);
const SMTP_FROM = process.env.SMTP_FROM || 'DIC@aptar.com';
const SMTP_TO = process.env.SMTP_TO || 'hansen.xu@aptar.com';

const mailer = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  } : undefined,
  tls: { rejectUnauthorized: false }
});

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getBackupFileName() {
  const now = new Date();
  return `${DB_NAME}_${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.sql`;
}

async function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

async function logOperation(action, detail, username = 'system') {
  try {
    await pool.execute(
      'INSERT INTO operation_logs (username, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [username, action, null, null, detail ? JSON.stringify(detail) : null, '127.0.0.1']
    );
  } catch (err) {
    console.error('[backup-service] 记录操作日志失败:', err.message);
  }
}

async function sendFailureEmail(backupName, errorMessage) {
  const subject = `数据库备份失败提醒 - ${DB_NAME}`;
  const html = `
    <h2>数据库备份失败提醒</h2>
    <p>数据库 <strong>${escapeHtml(DB_NAME)}</strong> 的全量备份执行失败，请及时处理。</p>
    <p><strong>备份名称：</strong>${escapeHtml(backupName)}</p>
    <p><strong>失败时间：</strong>${escapeHtml(new Date().toLocaleString('zh-CN'))}</p>
    <p><strong>错误信息：</strong>${escapeHtml(errorMessage)}</p>
    <p style="color: #718096; font-size: 12px; margin-top: 16px;">本邮件由系统自动发送，请勿回复。</p>
  `;

  try {
    const info = await mailer.sendMail({
      from: SMTP_FROM,
      to: SMTP_TO,
      subject,
      html
    });
    console.log('[backup-service] 备份失败提醒邮件已发送:', info.messageId);
    await logOperation('备份失败邮件提醒', {
      message: '数据库备份失败，已发送邮件提醒',
      to: SMTP_TO,
      backup_name: backupName,
      error: errorMessage
    });
    return info;
  } catch (err) {
    console.error('[backup-service] 发送备份失败提醒邮件失败:', err.message);
    await logOperation('备份失败邮件提醒失败', {
      message: '数据库备份失败，但邮件提醒发送失败',
      to: SMTP_TO,
      backup_name: backupName,
      error: err.message
    });
    throw err;
  }
}

function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createTmpCnf() {
  const tmpFile = path.join(os.tmpdir(), `.backup-my.cnf-${Date.now()}`);
  const content = `[mysqldump]\nuser=${DB_USER}\npassword=${DB_PASSWORD}\nhost=${DB_HOST}\nport=${DB_PORT}\n\n[mariadb-dump]\nuser=${DB_USER}\npassword=${DB_PASSWORD}\nhost=${DB_HOST}\nport=${DB_PORT}\n`;
  fs.writeFileSync(tmpFile, content, { mode: 0o600 });
  return tmpFile;
}

function runDumpCommand(filePath) {
  return new Promise((resolve, reject) => {
    const tmpCnf = createTmpCnf();
    const baseArgs = [
      `--defaults-extra-file=${tmpCnf}`,
      '--single-transaction',
      '--routines',
      '--triggers',
      DB_NAME
    ];

    const commands = ['mariadb-dump', 'mysqldump'];
    const errors = [];

    function cleanup() {
      try {
        fs.unlinkSync(tmpCnf);
      } catch (e) {
        // ignore
      }
    }

    function tryCommand() {
      if (commands.length === 0) {
        cleanup();
        return reject(new Error(
          '未找到可用的数据库备份命令（mariadb-dump 或 mysqldump）。' +
          (errors.length ? '\n尝试记录：\n' + errors.join('\n') : '')
        ));
      }

      const cmd = commands.shift();
      console.log(`[backup-service] 尝试使用 ${cmd} 执行备份...`);

      let proc;
      try {
        proc = spawn(cmd, baseArgs);
      } catch (err) {
        errors.push(`${cmd} 启动异常: ${err.message}`);
        return tryCommand();
      }

      const writeStream = fs.createWriteStream(filePath);
      let stderr = '';
      let finished = false;

      proc.stdout.pipe(writeStream);

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      function finish(err) {
        if (finished) return;
        finished = true;
        try { writeStream.destroy(); } catch (e) {}
        try { proc.kill(); } catch (e) {}
        if (err) {
          errors.push(`${cmd}: ${err.message}`);
          // 当前命令失败，继续尝试下一个
          tryCommand();
        } else {
          writeStream.end(() => {
            cleanup();
            resolve();
          });
        }
      }

      proc.on('error', (err) => {
        // ENOENT 等启动错误：记录后继续尝试下一个命令
        finish(new Error(`启动失败 (${err.code || '未知'}): ${err.message}`));
      });

      writeStream.on('error', (err) => {
        finish(new Error(`写入备份文件失败: ${err.message}`));
      });

      proc.on('close', (code, signal) => {
        if (finished) return;
        if (code === 0) {
          finish(null);
        } else {
          const reason = stderr.trim() || `进程异常退出（signal=${signal || '无'}, code=${code}）`;
          finish(new Error(`退出码 ${code}: ${reason}`));
        }
      });
    }

    tryCommand();
  });
}

async function runBackup(triggeredBy = 'system') {
  await ensureBackupDir();

  const backupName = getBackupFileName();
  const filePath = path.join(BACKUP_DIR, backupName);
  const startedAt = new Date();

  const [result] = await pool.execute(
    'INSERT INTO db_backups (backup_name, file_path, status, started_at, created_by) VALUES (?, ?, ?, ?, ?)',
    [backupName, filePath, 'running', formatDateTime(startedAt), triggeredBy]
  );
  const backupId = result.insertId;

  try {
    await runDumpCommand(filePath);

    const stats = fs.statSync(filePath);
    const completedAt = new Date();

    await pool.execute(
      'UPDATE db_backups SET status = ?, file_size = ?, completed_at = ? WHERE id = ?',
      ['success', stats.size, formatDateTime(completedAt), backupId]
    );

    console.log(`[backup-service] 数据库备份成功: ${filePath}, 大小: ${stats.size} 字节`);
    await logOperation('数据库备份成功', {
      backup_id: backupId,
      backup_name: backupName,
      file_path: filePath,
      file_size: stats.size,
      triggered_by: triggeredBy
    }, triggeredBy);

    return { backupId, backupName, filePath, status: 'success', fileSize: stats.size };
  } catch (err) {
    const completedAt = new Date();
    const errorMessage = err.message;

    try {
      await pool.execute(
        'UPDATE db_backups SET status = ?, error_message = ?, completed_at = ? WHERE id = ?',
        ['failed', errorMessage, formatDateTime(completedAt), backupId]
      );
    } catch (dbErr) {
      console.error('[backup-service] 更新备份失败状态失败:', dbErr.message);
    }

    console.error('[backup-service] 数据库备份失败:', errorMessage);

    try {
      await sendFailureEmail(backupName, errorMessage);
    } catch (emailErr) {
      // 邮件发送失败已在 sendFailureEmail 内部记录日志
    }

    throw { backupId, backupName, filePath, status: 'failed', error: errorMessage };
  }
}

async function listBackups(limit = 50) {
  const [rows] = await pool.execute(
    'SELECT id, backup_name, file_path, file_size, status, error_message, started_at, completed_at, created_by FROM db_backups ORDER BY started_at DESC LIMIT ?',
    [limit]
  );
  return rows;
}

function getNext2AM() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 2, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function startDailyBackup() {
  const delay = getNext2AM();
  const nextRun = new Date(Date.now() + delay);
  console.log(`[backup-service] 数据库每日备份任务将于 ${nextRun.toLocaleString('zh-CN')} 首次执行`);

  setTimeout(() => {
    runBackup('system').catch(() => {});
    setInterval(() => {
      runBackup('system').catch(() => {});
    }, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = { runBackup, listBackups, startDailyBackup };
