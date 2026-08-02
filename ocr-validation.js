/**
 * OCR 业务级校验：数据库查询 + 跨字段比较
 *
 * 配置示例（放在 fields.json 同级的 db_lookups / cross_field_rules 中）：
 * {
 *   "fields": [...],
 *   "validation": {...},
 *   "db_lookups": [
 *     {
 *       "name": "product_info",
 *       "enabled": false,
 *       "db": "mssql",
 *       "table": "dbo.Products",
 *       "select": ["product_code", "standard_model", "max_quantity"],
 *       "where": {
 *         "column": "product_name",
 *         "value": { "source": "field", "name": "product_name" }
 *       },
 *       "not_found_target_field": "product_name",
 *       "not_found_message": "产品名称在 ERP 中不存在"
 *     }
 *   ],
 *   "cross_field_rules": [
 *     {
 *       "target_field": "model",
 *       "enabled": false,
 *       "condition": {
 *         "left": { "source": "field", "name": "model" },
 *         "operator": "eq",
 *         "right": { "source": "lookup", "lookup": "product_info", "column": "standard_model" },
 *         "type": "string"
 *       },
 *       "message": "型号与 ERP 标准型号不一致"
 *     }
 *   ]
 * }
 */

const { pool, mssqlPool } = require('./db-config');

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function safeIdentifier(name) {
  if (typeof name !== 'string') return null;
  const parts = name.split('.');
  if (parts.some(p => !IDENTIFIER_RE.test(p))) return null;
  return parts.join('.');
}

function safeColumns(cols) {
  if (!Array.isArray(cols) || cols.length === 0) return null;
  if (cols.length === 1 && cols[0] === '*') return '*';
  const escaped = cols.map(safeIdentifier).filter(Boolean);
  return escaped.length ? escaped.join(', ') : null;
}

function resolveRef(ref, fields, lookups) {
  if (!ref || typeof ref !== 'object') return undefined;
  if (ref.source === 'literal') return ref.value;
  if (ref.source === 'field') {
    const item = fields && fields[ref.name];
    return item ? item.text : undefined;
  }
  if (ref.source === 'lookup') {
    const row = lookups && lookups[ref.lookup];
    if (!row || typeof row !== 'object') return undefined;
    return row[ref.column];
  }
  return undefined;
}

function parseValue(raw, type) {
  if (raw === undefined || raw === null || raw === '') return { empty: true };
  const str = String(raw).trim();
  if (!str) return { empty: true };

  if (type === 'number') {
    const n = Number(str.replace(/,/g, ''));
    if (Number.isNaN(n)) return { invalid: true, value: str };
    return { value: n };
  }

  if (type === 'integer') {
    const n = parseInt(str.replace(/,/g, ''), 10);
    if (Number.isNaN(n)) return { invalid: true, value: str };
    return { value: n };
  }

  if (type === 'date') {
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return { invalid: true, value: str };
    return { value: d };
  }

  return { value: str };
}

function compare(left, operator, right, type) {
  const l = parseValue(left, type);
  const r = parseValue(right, type);

  if (l.empty || r.empty) {
    return { passed: false, reason: '缺少比较数据' };
  }
  if (l.invalid || r.invalid) {
    return { passed: false, reason: `格式不正确 (${type || 'string'})` };
  }

  const a = l.value;
  const b = r.value;

  let ok;
  switch (operator) {
    case 'eq': ok = a === b; break;
    case 'ne': ok = a !== b; break;
    case 'gt': ok = a > b; break;
    case 'gte': ok = a >= b; break;
    case 'lt': ok = a < b; break;
    case 'lte': ok = a <= b; break;
    default:
      return { passed: false, reason: `未知操作符 ${operator}` };
  }

  const reason = ok ? '' : `校验失败: ${operator}`;
  return { passed: ok, reason };
}

async function runMysql(sql, params) {
  const [rows] = await pool.execute(sql, params);
  return rows && rows[0];
}

async function runMssql(sql, params) {
  const request = mssqlPool.request();
  params.forEach((p, i) => {
    request.input(`p${i}`, p);
  });
  const result = await request.query(sql);
  return result.recordset && result.recordset[0];
}

async function runDbLookups(lookupsConfig, fields) {
  const lookups = {};
  const failures = [];

  if (!Array.isArray(lookupsConfig)) return { lookups, failures };

  for (const cfg of lookupsConfig) {
    if (!cfg || cfg.enabled === false) continue;

    const table = safeIdentifier(cfg.table);
    const columns = safeColumns(cfg.select);
    const whereCol = cfg.where && safeIdentifier(cfg.where.column);

    if (!table || !columns || !whereCol) {
      failures.push({ target: cfg.not_found_target_field, message: `数据库查询 [${cfg.name}] 配置不合法` });
      continue;
    }

    const paramValue = resolveRef(cfg.where.value, fields, lookups);
    if (paramValue === undefined || paramValue === '') {
      failures.push({ target: cfg.not_found_target_field, message: cfg.not_found_message || `缺少查询条件 [${cfg.where.column}]` });
      continue;
    }

    const sql = `SELECT ${columns} FROM ${table} WHERE ${whereCol} = ?`;
    let row;
    try {
      if (cfg.db === 'mssql') {
        const namedSql = sql.replace(/\?/g, (match, offset, string) => {
          // 仅替换本次查询中的 ?
          return `@p${string.slice(0, offset).split('?').length - 1}`;
        });
        row = await runMssql(namedSql, [paramValue]);
      } else {
        row = await runMysql(sql, [paramValue]);
      }
    } catch (err) {
      console.error(`[ocr-validation] 数据库查询 [${cfg.name}] 失败:`, err.message);
      failures.push({ target: cfg.not_found_target_field, message: `数据库查询失败: ${err.message}` });
      continue;
    }

    if (!row) {
      failures.push({ target: cfg.not_found_target_field, message: cfg.not_found_message || `未找到匹配记录 [${cfg.name}]` });
      continue;
    }

    lookups[cfg.name] = row;
  }

  return { lookups, failures };
}

function runCrossFieldRules(rulesConfig, fields, lookups) {
  if (!Array.isArray(rulesConfig)) return;

  for (const rule of rulesConfig) {
    if (!rule || rule.enabled === false) continue;
    const cond = rule.condition;
    if (!cond || !cond.left || !cond.right || !cond.operator) continue;

    const leftVal = resolveRef(cond.left, fields, lookups);
    const rightVal = resolveRef(cond.right, fields, lookups);
    const result = compare(leftVal, cond.operator, rightVal, cond.type);

    const target = rule.target_field;
    if (!target || !fields[target]) continue;

    if (!result.passed) {
      fields[target].passed = false;
      const msg = rule.message || result.reason;
      const existing = fields[target].message || '';
      fields[target].message = existing ? `${existing}; ${msg}` : msg;
    }
  }
}

function applyLookupFailures(failures, fields) {
  for (const f of failures || []) {
    if (!f.target || !fields[f.target]) continue;
    fields[f.target].passed = false;
    const existing = fields[f.target].message || '';
    fields[f.target].message = existing ? `${existing}; ${f.message}` : f.message;
  }
}

async function runOcrValidation(result, config) {
  if (!result || !result.success || !result.fields) return result;

  const lookupsConfig = config && config.db_lookups;
  const rulesConfig = config && config.cross_field_rules;
  if (!Array.isArray(lookupsConfig) && !Array.isArray(rulesConfig)) return result;

  const { lookups, failures } = await runDbLookups(lookupsConfig, result.fields);
  applyLookupFailures(failures, result.fields);
  runCrossFieldRules(rulesConfig, result.fields, lookups);

  result.overall_passed = Object.values(result.fields).every(r => r.passed);
  return result;
}

module.exports = { runOcrValidation };
