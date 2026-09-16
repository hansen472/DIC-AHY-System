/**
 * COA 报告路由：产品数据同步、客户数据、印单数据、报告申请列表
 */
const express = require('express');

module.exports = function setupCoaRoutes(deps) {
  const { pool, coaPool, auth } = deps;
  const router = express.Router();
  const { requirePermission } = auth;

  // GET /api/coa-product-data
  router.get('/api/coa-product-data', requirePermission('coa_report'), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT product_id, product_code, tenant_id, product_name,
              check_gist, norm, creation_date,
              created_by, last_updated_by, synced_at
       FROM COA_report_product_data
       ORDER BY product_name ASC`
      );
      res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        return res.json({ success: true, count: 0, data: [] });
      }
      console.error('查询 COA 产品数据失败:', err);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  // POST /api/coa-product-data/sync
  router.post('/api/coa-product-data/sync', requirePermission('coa_report'), async (req, res) => {
    try {
      const cloudResult = await coaPool.request().query(
        `SELECT product_id, product_code, tenant_id, product_name,
              check_gist, norm, creation_date,
              created_by, last_updated_by
       FROM report_product_data`
      );
      const cloudRows = cloudResult.recordset || [];

      if (cloudRows.length === 0) {
        return res.json({ success: true, message: '云端无数据', inserted: 0, updated: 0, skipped: 0 });
      }

      let localMap = {};
      try {
        const [localRows] = await pool.execute(
          `SELECT product_id, product_code, tenant_id, product_name,
                check_gist, norm, creation_date, created_by, last_updated_by
         FROM COA_report_product_data`
        );
        localRows.forEach(r => { localMap[r.product_id] = r; });
      } catch (e) { /* 本地表可能不存在 */ }

      const norm = (v) => {
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
        return String(v).trim();
      };
      const FIELDS = ['product_code', 'tenant_id', 'product_name', 'check_gist', 'norm', 'creation_date', 'created_by', 'last_updated_by'];

      let inserted = 0, updated = 0, skipped = 0;
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const cloud of cloudRows) {
          const local = localMap[cloud.product_id];
          if (!local) {
            await connection.execute(
              `INSERT INTO COA_report_product_data
               (product_id, product_code, tenant_id, product_name, check_gist, norm,
                creation_date, created_by, last_updated_by, synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [cloud.product_id, cloud.product_code, cloud.tenant_id, cloud.product_name,
               cloud.check_gist, cloud.norm, cloud.creation_date, cloud.created_by, cloud.last_updated_by]
            );
            inserted++;
          } else {
            const changed = FIELDS.some(f => norm(cloud[f]) !== norm(local[f]));
            if (changed) {
              await connection.execute(
                `UPDATE COA_report_product_data SET
                 product_code = ?, tenant_id = ?, product_name = ?,
                 check_gist = ?, norm = ?, creation_date = ?,
                 created_by = ?, last_updated_by = ?, synced_at = NOW()
               WHERE product_id = ?`,
                [cloud.product_code, cloud.tenant_id, cloud.product_name,
                 cloud.check_gist, cloud.norm, cloud.creation_date,
                 cloud.created_by, cloud.last_updated_by, cloud.product_id]
              );
              updated++;
            } else {
              skipped++;
            }
          }
        }
        await connection.commit();
      } finally {
        connection.release();
      }

      const msg = `同步完成：新增 ${inserted} 条，更新 ${updated} 条，跳过 ${skipped} 条`;
      console.log(`[COA] ${msg}（云端共 ${cloudRows.length} 条）`);
      res.json({ success: true, message: msg, inserted, updated, skipped });
    } catch (err) {
      console.error('[COA] 同步失败:', err);
      res.status(500).json({ error: '同步失败: ' + err.message });
    }
  });

  // GET /api/coa-client-data
  router.get('/api/coa-client-data', requirePermission('coa_report'), async (req, res) => {
    try {
      const result = await coaPool.request().query(`
        WITH client_count AS (
          SELECT rcd.client_name, COUNT(*) AS total_cnt
          FROM report_client_data rcd
          INNER JOIN client_product_mapping cpm ON rcd.client_id = cpm.client_id
          INNER JOIN report_product_data rpd ON cpm.product_id = rpd.product_id
          WHERE rcd.tenant_id = 3
          GROUP BY rcd.client_name
        )
        SELECT rcd.client_name, rpd.product_name, rpd.product_code
        FROM report_client_data rcd
        INNER JOIN client_product_mapping cpm ON rcd.client_id = cpm.client_id
        INNER JOIN report_product_data rpd ON cpm.product_id = rpd.product_id
        INNER JOIN client_count cc ON rcd.client_name = cc.client_name
        WHERE rcd.tenant_id = 3
        ORDER BY cc.total_cnt DESC, rcd.client_name ASC, rpd.product_name ASC
      `);
      const rows = result.recordset || [];
      res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      console.error('[COA] 查询客户数据失败:', err);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  // GET /api/coa-seal-data
  router.get('/api/coa-seal-data', requirePermission('coa_report'), async (req, res) => {
    try {
      const result = await coaPool.request()
        .query(`SELECT seal_id, last_update_date, version_name, status, url
              FROM report_seal_data WHERE tenant_id = 3 ORDER BY last_update_date DESC`);
      const rows = result.recordset || [];
      res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      console.error('[COA] 查询印单数据失败:', err);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  // GET /api/coa-reports
  router.get('/api/coa-reports', requirePermission('coa_report'), async (req, res) => {
    try {
      const { tab, client, batch, code } = req.query;
      let templateFilter = '';
      if (tab === 'test') templateFilter = 'Test report';
      else if (tab === 'microbial') templateFilter = 'Microbial limit test report';
      else templateFilter = 'COA';

      let sql = `SELECT TOP 200
      bill_number AS billNumber, client_name AS clientName, batch_no AS batchNo,
      product_code AS productCode, product_name AS productName, create_person AS createPerson,
      order_no AS orderNo, template_code AS templateCode, report_no AS reportNo,
      creation_date AS creationDate, report_approved_date AS reportApprovedDate,
      status, update_employee_name AS updateEmployeeName, update_time AS updateTime
    FROM report_application
    WHERE tenant_id = 3 AND template_code LIKE '%${templateFilter}%'`;

      if (client) sql += ` AND client_name LIKE N'%${client}%'`;
      if (batch) sql += ` AND batch_no LIKE '%${batch}%'`;
      if (code) sql += ` AND product_code LIKE '%${code}%'`;
      sql += ' ORDER BY creation_date DESC';

      const result = await coaPool.request().query(sql);
      const rows = result.recordset || [];
      res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
      console.error('[COA] 查询报告申请列表失败:', err);
      res.status(500).json({ error: '查询失败: ' + err.message });
    }
  });

  return router;
};
