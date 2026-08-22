/**
 * 仪器/仪表到期查询服务
 *
 * 数据源：MIC 数据库（mic00001）
 */

const { micPool } = require('./db-mic-config');

const QUERY_SQL = `
SELECT
  ROW_NUMBER() OVER (ORDER BY asset_list.asset_ff_10 ASC) AS \`序号\`,
  asset_list.asset_name AS \`仪器/仪表名称\`,
  mic_asset_status.asset_status_name AS \`资产状态\`,
  asset_list.asset_model AS \`型号/规格\`,
  asset_list.asset_code AS \`仪器/仪表编码\`,
  pur_supplier.supplier_name AS \`制造商\`,
  asset_list.asset_serial_number AS \`出厂编号\`,
  asset_list.asset_ff_6 AS \`测量范围\`,
  asset_list.asset_ff_7 AS \`精度等级\`,
  asset_location.location_name AS \`所在位置\`,
  asset_list.asset_ff_5 AS \`安装位置\`,
  asset_list.asset_ff_9 AS \`本次检验日期\`,
  asset_list.asset_ff_10 AS \`下次检验日期\`,
  asset_list_calibration_data.calibration_period AS \`送检周期（月）\`
FROM asset_list
LEFT JOIN pur_supplier ON asset_list.manufacturer_id = pur_supplier.supplier_id
LEFT JOIN mic_asset_status ON asset_list.asset_status = mic_asset_status.asset_status_code
LEFT JOIN asset_location ON asset_list.location_id = asset_location.location_id
LEFT JOIN asset_list_calibration_data ON asset_list.asset_id = asset_list_calibration_data.asset_id
WHERE asset_list.asset_nature = 8
  AND mic_asset_status.asset_status_name IN ('在用', '备用')
  AND asset_list.asset_ff_10 < ?
ORDER BY asset_list.asset_ff_10 ASC
`;

/**
 * 查询指定到期日期之前的仪器/仪表数据
 * @param {string} expireDate 到期日期，格式 YYYY-MM-DD
 */
async function queryInstruments(expireDate) {
  const [rows] = await micPool.execute(QUERY_SQL, [expireDate]);
  return rows;
}

/**
 * 根据仪器/仪表编码列表查询 MIC 数据库中的详细信息
 * 用于基准日回顾：根据保存的 asset_code 列表查询当前数据
 * @param {string[]} codes 仪器/仪表编码数组
 */
async function queryByAssetCodes(codes) {
  if (!codes || codes.length === 0) return [];
  const placeholders = codes.map(() => '?').join(',');
  const sql = `
SELECT
  ROW_NUMBER() OVER (ORDER BY asset_list.asset_ff_10 ASC) AS \`序号\`,
  asset_list.asset_name AS \`仪器/仪表名称\`,
  mic_asset_status.asset_status_name AS \`资产状态\`,
  asset_list.asset_model AS \`型号/规格\`,
  asset_list.asset_code AS \`仪器/仪表编码\`,
  pur_supplier.supplier_name AS \`制造商\`,
  asset_list.asset_serial_number AS \`出厂编号\`,
  asset_list.asset_ff_6 AS \`测量范围\`,
  asset_list.asset_ff_7 AS \`精度等级\`,
  asset_location.location_name AS \`所在位置\`,
  asset_list.asset_ff_5 AS \`安装位置\`,
  asset_list.asset_ff_9 AS \`本次检验日期\`,
  asset_list.asset_ff_10 AS \`下次检验日期\`,
  asset_list_calibration_data.calibration_period AS \`送检周期（月）\`
FROM asset_list
LEFT JOIN pur_supplier ON asset_list.manufacturer_id = pur_supplier.supplier_id
LEFT JOIN mic_asset_status ON asset_list.asset_status = mic_asset_status.asset_status_code
LEFT JOIN asset_location ON asset_list.location_id = asset_location.location_id
LEFT JOIN asset_list_calibration_data ON asset_list.asset_id = asset_list_calibration_data.asset_id
WHERE asset_list.asset_code IN (${placeholders})
ORDER BY asset_list.asset_ff_10 ASC
`;
  const [rows] = await micPool.execute(sql, codes);
  return rows;
}

module.exports = { queryInstruments, queryByAssetCodes };
