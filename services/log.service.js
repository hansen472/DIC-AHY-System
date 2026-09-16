/**
 * 操作日志服务：通用操作日志记录、供应商资质日志记录、客户端信息获取
 */
const dns = require('dns');
const util = require('util');

const dnsReverse = util.promisify(dns.reverse);

/**
 * 获取客户端 IP 和 User-Agent
 */
function getClientInfo(req) {
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  return { ip, userAgent };
}

/**
 * 反向解析 IP 对应的电脑名称
 */
async function resolveComputerName(ip) {
  if (!ip) return '';
  const cleanIp = ip.split(',')[0].trim();
  if (!cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1') return '';
  try {
    const hostnames = await dnsReverse(cleanIp);
    return hostnames && hostnames.length > 0 ? hostnames[0] : '';
  } catch (e) {
    return '';
  }
}

/**
 * 记录管理员操作日志（通用）
 */
function createLogOperation(pool, getSession) {
  return async function logOperation(req, action, targetType, targetId, detail) {
    try {
      const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress || '';
      await pool.execute(
        'INSERT INTO operation_logs (username, action, target_type, target_id, detail, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
        [
          req.session.username,
          action,
          targetType || null,
          targetId != null ? String(targetId) : null,
          detail || null,
          clientIp
        ]
      );
    } catch (err) {
      console.error('操作日志记录失败:', err.message);
    }
  };
}

/**
 * 记录供应商资质操作日志
 */
function createLogSupplierOperation(pool) {
  return async function logSupplierOperation(req, action, supplierId, supplierName, detail) {
    try {
      const session = req.session || { username: 'unknown' };
      const username = session.username || 'unknown';
      const { ip, userAgent } = getClientInfo(req);
      const computerName = await resolveComputerName(ip);

      await pool.execute(
        `INSERT INTO supplier_qualification_logs
         (username, action, supplier_id, supplier_name, detail, ip_address, computer_name, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, action, supplierId || null, supplierName || '', detail ? JSON.stringify(detail) : null, ip, computerName, userAgent]
      );
    } catch (err) {
      console.error('供应商资质日志记录失败:', err.message);
    }
  };
}

/**
 * 写入推送日志
 * 供 instrument.routes.js 以及各 notifier 文件共用
 * @param {string} source        'instrument_meter' | 'overdue_workorder' | ...
 * @param {string} pushMethod    'email' | 'wechat'
 * @param {string} pushStatus    'success' | 'failed'
 * @param {string} pushContent   推送内容摘要
 * @param {number} recordCount   推送记录数
 * @param {string} pushTarget    推送对象（邮箱 / Webhook URL）
 * @param {string} pusher        推送人（用户名 / 'system'）
 * @param {string} [errorMessage] 失败原因
 */
function createLogPush(pool) {
  return async function logPush(source, pushMethod, pushStatus, pushContent, recordCount, pushTarget, pusher, errorMessage) {
    try {
      await pool.execute(
        'INSERT INTO push_logs (source, push_method, push_status, push_content, record_count, push_target, pusher, error_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [source, pushMethod, pushStatus, pushContent || null, recordCount || 0, pushTarget || null, pusher || 'system', errorMessage || null]
      );
      console.log(`[logPush] 记录成功: source=${source}, status=${pushStatus}, pusher=${pusher || 'system'}`);
    } catch (err) {
      console.error(`[logPush] 记录失败: source=${source}, status=${pushStatus}, pusher=${pusher || 'system'}, 错误: ${err.message}`);
    }
  };
}

module.exports = {
  getClientInfo,
  resolveComputerName,
  createLogOperation,
  createLogSupplierOperation,
  createLogPush,
};
