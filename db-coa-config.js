/**
 * COA 云端 SQL 数据库连接配置（Azure SQL）
 *
 * 数据源：HIPPIUS-PRD-SQLDB01
 * 用途：同步 report_product_data 表到本地 COA_report_product_data
 *
 * 环境变量（可选，用于覆盖默认值）：
 *   COA_SERVER    默认 hippius-prd-sql-server01.database.chinacloudapi.cn
 *   COA_DATABASE  默认 HIPPIUS-PRD-SQLDB01
 *   COA_USER      默认 handadmin
 *   COA_PASSWORD  默认 hansenmima
 */

const mssql = require('mssql');

const COA_SERVER = process.env.COA_SERVER || 'hippius-prd-sql-server01.database.chinacloudapi.cn';
const COA_DATABASE = process.env.COA_DATABASE || 'HIPPIUS-PRD-SQLDB01';
const COA_USER = process.env.COA_USER || 'handadmin';

console.log(`[db-coa-config] Azure SQL 连接目标: ${COA_SERVER}/${COA_DATABASE} (user=${COA_USER})`);

const coaConfig = {
  server: COA_SERVER,
  port: 1433,
  database: COA_DATABASE,
  user: COA_USER,
  password: process.env.COA_PASSWORD || 'hansenmima',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    readOnlyIntent: true    // 只读连接，禁止对云端数据库做任何写入/修改操作
  },
  connectionTimeout: 30000,
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const coaPool = new mssql.ConnectionPool(coaConfig);

/**
 * 测试 Azure SQL 连通性
 */
async function testCoaConnection() {
  try {
    await coaPool.connect();
    const result = await coaPool.request().query('SELECT 1 AS ok');
    console.log('[db-coa-config] Azure SQL 连接成功:', result.recordset[0]);
    return true;
  } catch (err) {
    console.error('[db-coa-config] Azure SQL 连接失败:', err.message);
    return false;
  }
}

module.exports = { coaPool, testCoaConnection };
