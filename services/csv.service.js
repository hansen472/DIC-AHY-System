/**
 * CSV 导入/导出工具：解析器、日期校验、各模块 CSV 表头常量
 */

// 年度培训计划 CSV 导入/导出相关常量
const ANNUAL_PLAN_CSV_HEADERS = '年度,部门,培训项目/课程/内容,目标学员,培训方式,内训/外训,讲师,价格,培训课时,培训日程,是否考核,跟踪,是否通知';

// 供应商资质 CSV 导入/导出相关常量
const SUPPLIER_QUALIFICATION_CSV_HEADERS = '供方名称,供应的产品或服务,联系人,联系电话,准入时间,营业执照,认证证书,供方基本情况登记表,备注';
const SUPPLIER_QUALIFICATION_CSV_SAMPLE = '示例供方,示例产品,张三,13800138000,2024-01-15,2024-01-15,证书编号,登记表编号,备注';

// 资质种类 CSV 导入/导出相关常量
const QUALIFICATION_TYPE_CSV_HEADERS = '资质名称,是否需要过期检查';
const QUALIFICATION_TYPE_CSV_SAMPLE = '示例资质,是';

// 供应商主数据 CSV 导入/导出相关常量
const SUPPLIER_CSV_HEADERS = '供方名称,供应商类型,物资分类,联系人,电话,状态,备注1,备注2';
const SUPPLIER_CSV_SAMPLE = '示例供方,请输入以下4种类型：special service manufacturer distributor,原材料,张三,13800138000,请输入以下2种类型：active inactive,备注1内容,备注2内容';

// 产品列表 CSV 导入/导出相关常量
const PRODUCT_LIST_CSV_HEADERS = '公司名称,产品名,型号,生产商';
const PRODUCT_LIST_CSV_SAMPLE = '示例公司,示例产品,Model-001,示例生产商';

/**
 * 解析 CSV 文本为二维数组
 */
function parseCsv(text) {
  if (!text) return [];
  let t = text;
  if (t.charCodeAt(0) === 0xFEFF) {
    t = t.slice(1);
  }
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    const next = t[i + 1];
    if (inQuotes) {
      if (c === '"') {
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\r') {
        if (next === '\n') i++;
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\n') {
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
  }
  rows.push(row);
  while (rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

/**
 * 校验日期格式是否为合法的 YYYY-MM-DD 或 YYYY-M-D
 */
function isValidDate(str) {
  if (!str) return true;
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * 将 YYYY-M-D 或 YYYY-MM-DD 统一归一化为 YYYY-MM-DD
 */
function normalizeDate(str) {
  if (!str) return str;
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) return str;
  const [y, m, d] = str.split('-').map(Number);
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

module.exports = {
  ANNUAL_PLAN_CSV_HEADERS,
  SUPPLIER_QUALIFICATION_CSV_HEADERS,
  SUPPLIER_QUALIFICATION_CSV_SAMPLE,
  QUALIFICATION_TYPE_CSV_HEADERS,
  QUALIFICATION_TYPE_CSV_SAMPLE,
  SUPPLIER_CSV_HEADERS,
  SUPPLIER_CSV_SAMPLE,
  PRODUCT_LIST_CSV_HEADERS,
  PRODUCT_LIST_CSV_SAMPLE,
  parseCsv,
  isValidDate,
  normalizeDate,
};
