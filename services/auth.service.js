/**
 * 认证服务：密码哈希、密码复杂度校验、账户锁定策略常量
 */
const crypto = require('crypto');

// ========== 账户锁定策略 ==========
const LOGIN_MAX_FAILED_ATTEMPTS = 5;       // 24 小时内允许的最大失败次数
const LOGIN_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000; // 失败尝试统计窗口：24 小时
const ACCOUNT_LOCK_DURATION_MS = 30 * 60 * 1000;      // 锁定时长：30 分钟

// ========== 密码有效期策略 ==========
const PASSWORD_MAX_DAYS = 365;    // 密码最长有效天数（1 年）
const PASSWORD_GRACE_DAYS = 30;   // 过期后宽限天数（1 个月，宽限期内仍可登录但每次提示修改）

function hashPassword(pwd) {
  return crypto.createHash('sha256').update(pwd).digest('hex');
}

/**
 * 密码复杂度校验
 * 规则：
 *   1. 长度 >= 6
 *   2. 必须同时包含字母和数字
 *   3. 字母/数字顺序连续不超过 3 个（如 abcd、dcba、1234、4321 不允许）
 *   4. 不能包含用户名（原值、全大写、全小写、反转）
 * @param {string} password - 待校验密码
 * @param {string} username - 用户名（用于规则 4）
 * @returns {string|null} 错误信息，通过则返回 null
 */
function validatePassword(password, username) {
  if (!password || password.length < 6) {
    return '密码长度不能少于 6 位';
  }

  // 必须包含字母和数字
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return '密码必须同时包含字母和数字';
  }

  // 连续字母或数字不能超过 3 个（如 abcd、dcba、1234、4321 不允许）
  const hasConsecutiveSequence = (str, max) => {
    const lower = str.toLowerCase();
    let asc = 1, desc = 1;
    for (let i = 1; i < lower.length; i++) {
      const prev = lower.charCodeAt(i - 1);
      const curr = lower.charCodeAt(i);
      // 只检查同类字符（字母对字母、数字对数字）
      const prevIsLetter = prev >= 97 && prev <= 122;
      const currIsLetter = curr >= 97 && curr <= 122;
      const prevIsDigit = prev >= 48 && prev <= 57;
      const currIsDigit = curr >= 48 && curr <= 57;

      if (prevIsLetter && currIsLetter) {
        if (curr - prev === 1) { asc++; desc = 1; }
        else if (prev - curr === 1) { desc++; asc = 1; }
        else { asc = 1; desc = 1; }
      } else if (prevIsDigit && currIsDigit) {
        if (curr - prev === 1) { asc++; desc = 1; }
        else if (prev - curr === 1) { desc++; asc = 1; }
        else { asc = 1; desc = 1; }
      } else {
        asc = 1; desc = 1;
      }
      if (asc > max || desc > max) return true;
    }
    return false;
  };

  if (hasConsecutiveSequence(password, 3)) {
    return '密码中连续字母或数字不能超过 3 个（如 abcd、1234）';
  }

  // 不能包含用户名或其变体
  if (username && typeof username === 'string' && username.trim()) {
    const pwdLower = password.toLowerCase();
    const un = username.trim();
    const unLower = un.toLowerCase();
    const unUpper = un.toUpperCase();
    const unReversed = un.split('').reverse().join('');

    const variants = [un, unLower, unUpper, unReversed]
      .filter(v => v && v.length > 0);
    const uniqueVariants = [...new Set(variants)];

    for (const variant of uniqueVariants) {
      if (password.includes(variant) || pwdLower.includes(variant.toLowerCase())) {
        return '密码不能包含用户名或用户名的变体';
      }
    }
  }

  return null;
}

module.exports = {
  LOGIN_MAX_FAILED_ATTEMPTS,
  LOGIN_ATTEMPT_WINDOW_MS,
  ACCOUNT_LOCK_DURATION_MS,
  PASSWORD_MAX_DAYS,
  PASSWORD_GRACE_DAYS,
  hashPassword,
  validatePassword,
};
