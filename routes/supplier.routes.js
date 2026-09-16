/**
 * 供应商资质管理路由：供应商资质、资质种类、供应商主数据、产品列表、录入供应商资质
 */
const express = require('express');
const {
  parseCsv, isValidDate, normalizeDate,
  SUPPLIER_QUALIFICATION_CSV_HEADERS, SUPPLIER_QUALIFICATION_CSV_SAMPLE,
  QUALIFICATION_TYPE_CSV_HEADERS, QUALIFICATION_TYPE_CSV_SAMPLE,
  SUPPLIER_CSV_HEADERS, SUPPLIER_CSV_SAMPLE,
  PRODUCT_LIST_CSV_HEADERS, PRODUCT_LIST_CSV_SAMPLE
} = require('../services/csv.service');

module.exports = function setupSupplierRoutes(deps) {
  const { pool, auth, logOperation, logSupplierOperation } = deps;
  const router = express.Router();
  const { requirePermission } = auth;

  // ========== 供应商资质管理 ==========

  // API：查询供应商资质（需 supplier_qualifications 查看权限）
  router.get('/api/supplier-qualifications', requirePermission('supplier_qualifications'), async (req, res) => {
    try {
      const category = req.query.category;

      const categoryTypeMap = {
        special: ['special', '特殊物资类'],
        service: ['service', '服务型'],
        production: ['manufacturer', 'distributor', '生产型', '经销型']
      };
      const allowedCategories = Object.keys(categoryTypeMap);
      const categoryValue = allowedCategories.includes(category) ? category : 'special';
      const supplierTypes = categoryTypeMap[categoryValue];

      const placeholders = supplierTypes.map(() => '?').join(',');

      const sql = `SELECT
      MIN(e.supplier_id) AS supplier_id,
      MIN(s.supplier_name) AS supplier_name,
      MIN(s.supplier_type) AS supplier_type,
      pl.id AS prudoct_list_id,
      pl.company_name,
      pl.product_name,
      pl.model,
      pl.manufacturer,
      pl.status AS product_status,
      COALESCE((
        SELECT GROUP_CONCAT(
          CONCAT(
            '资质名称：', COALESCE(eq.qualification_name, ''),
            IF(eq.issue_date IS NOT NULL AND eq.issue_date != '', CONCAT('；发行日期：', eq.issue_date), ''),
            IF(eq.expiry_date IS NOT NULL AND eq.expiry_date != '', CONCAT('；过期日期：', eq.expiry_date), ''),
            '；状态：', COALESCE(eq.current_status, '')
          )
          ORDER BY eq.qualification_name, eq.issue_date
          SEPARATOR '\n'
        )
        FROM entry_supplier_qualifications eq
        WHERE eq.prudoct_list_id = pl.id
      ), '') AS qualification_summary
    FROM entry_supplier_qualifications e
    JOIN suppliers s ON s.id = e.supplier_id
    JOIN product_list pl ON pl.id = e.prudoct_list_id
    WHERE s.supplier_type IN (${placeholders})
    GROUP BY pl.id, pl.company_name, pl.product_name, pl.model, pl.manufacturer, pl.status
    ORDER BY pl.updated_at DESC`;

      const [rows] = await pool.execute(sql, supplierTypes);
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询供应商资质失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：查询供应商资质操作日志
  router.get('/api/supplier-qualification-logs', requirePermission('supplier_qualifications'), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, username, action, supplier_id, supplier_name, detail,
              ip_address, computer_name, user_agent, created_at
       FROM supplier_qualification_logs
       ORDER BY created_at DESC`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询供应商资质日志失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：新增供应商资质
  router.post('/api/supplier-qualifications', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const {
      supplier_name, product_or_service, contact_person, contact_phone,
      category, admission_date, business_license, certification, basic_info_form, remarks
    } = req.body;

    if (!supplier_name || String(supplier_name).trim() === '') {
      return res.status(400).json({ error: '供方名称不能为空' });
    }

    const categoryValue = ['production', 'service', 'special'].includes(category) ? category : 'special';

    if (business_license && !isValidDate(String(business_license).trim())) {
      return res.status(400).json({ error: '营业执照格式不正确，应为 YYYY-MM-DD' });
    }

    try {
      const [result] = await pool.execute(
        `INSERT INTO supplier_qualifications
       (supplier_name, product_or_service, contact_person, contact_phone,
        category, admission_date, business_license, certification, basic_info_form, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(supplier_name).trim(),
          product_or_service || null,
          contact_person || null,
          contact_phone || null,
          categoryValue,
          admission_date ? normalizeDate(String(admission_date).trim()) : null,
          business_license ? normalizeDate(String(business_license).trim()) : null,
          certification || null,
          basic_info_form || null,
          remarks || null,
          req.session.username
        ]
      );

      await logSupplierOperation(req, '新增', result.insertId, supplier_name, req.body);

      res.json({ success: true, message: '供应商资质已新增', id: result.insertId });
    } catch (err) {
      console.error('新增供应商资质失败:', err);
      res.status(500).json({ error: '新增失败' });
    }
  });

  // API：修改供应商资质
  router.put('/api/supplier-qualifications/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少供应商ID' });

    const {
      supplier_name, product_or_service, contact_person, contact_phone,
      category, admission_date, business_license, certification, basic_info_form, remarks
    } = req.body;

    if (!supplier_name || String(supplier_name).trim() === '') {
      return res.status(400).json({ error: '供方名称不能为空' });
    }

    const categoryValue = ['production', 'service', 'special'].includes(category) ? category : 'special';

    if (business_license && !isValidDate(String(business_license).trim())) {
      return res.status(400).json({ error: '营业执照格式不正确，应为 YYYY-MM-DD' });
    }

    try {
      const [oldRows] = await pool.execute(
        'SELECT * FROM supplier_qualifications WHERE id = ?',
        [id]
      );
      if (oldRows.length === 0) {
        return res.status(404).json({ error: '供应商不存在' });
      }
      const oldData = oldRows[0];

      const [result] = await pool.execute(
        `UPDATE supplier_qualifications
       SET supplier_name = ?, product_or_service = ?, contact_person = ?, contact_phone = ?,
           category = ?, admission_date = ?, business_license = ?, certification = ?, basic_info_form = ?, remarks = ?
       WHERE id = ?`,
        [
          String(supplier_name).trim(),
          product_or_service || null,
          contact_person || null,
          contact_phone || null,
          categoryValue,
          admission_date ? normalizeDate(String(admission_date).trim()) : null,
          business_license ? normalizeDate(String(business_license).trim()) : null,
          certification || null,
          basic_info_form || null,
          remarks || null,
          id
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '供应商不存在' });
      }

      await logSupplierOperation(req, '修改', id, supplier_name, { before: oldData, after: req.body });

      res.json({ success: true, message: '供应商资质已更新' });
    } catch (err) {
      console.error('修改供应商资质失败:', err);
      res.status(500).json({ error: '更新失败' });
    }
  });

  // API：删除供应商资质
  router.delete('/api/supplier-qualifications/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少供应商ID' });

    try {
      const [oldRows] = await pool.execute(
        'SELECT * FROM supplier_qualifications WHERE id = ?',
        [id]
      );
      if (oldRows.length === 0) {
        return res.status(404).json({ error: '供应商不存在' });
      }
      const oldData = oldRows[0];

      const [result] = await pool.execute(
        'DELETE FROM supplier_qualifications WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '供应商不存在' });
      }

      await logSupplierOperation(req, '删除', id, oldData.supplier_name, oldData);

      res.json({ success: true, message: '供应商资质已删除' });
    } catch (err) {
      console.error('删除供应商资质失败:', err);
      res.status(500).json({ error: '删除失败' });
    }
  });

  // API：下载供应商资质 CSV 模板
  router.get('/api/supplier-qualifications/template', requirePermission('supplier_qualifications'), async (req, res) => {
    const category = req.query.category;
    const categoryValue = ['production', 'service', 'special'].includes(category) ? category : 'special';
    const categoryLabels = {
      production: '生产型经销型',
      service: '服务型',
      special: '特殊物资类'
    };
    const csv = '\uFEFF' + SUPPLIER_QUALIFICATION_CSV_HEADERS + '\n' + SUPPLIER_QUALIFICATION_CSV_SAMPLE + '\n';
    const filename = `supplier-qualifications-template-${categoryValue}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=' + filename);
    res.send(csv);

    try {
      await logSupplierOperation(req, '下载CSV模板', null, null, {
        message: `下载供应商资质 CSV 模板，分类：${categoryLabels[categoryValue] || categoryValue}`
      });
    } catch (err) {
      console.error('记录 CSV 模板下载日志失败:', err.message);
    }
  });

  // API：从 CSV 导入供应商资质
  router.post('/api/supplier-qualifications/import', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const { csv, category } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: '缺少 CSV 内容' });
    }

    const categoryValue = ['production', 'service', 'special'].includes(category) ? category : 'special';

    const rows = parseCsv(csv);
    if (rows.length < 2) {
      return res.status(400).json({ error: 'CSV 文件中缺少数据行' });
    }

    const headers = rows[0].map(h => h.trim());
    const requiredHeaders = ['供方名称'];
    const missing = requiredHeaders.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      return res.status(400).json({ error: `CSV 表头缺少必填列: ${missing.join(', ')}` });
    }

    function cell(name, cells) {
      const idx = headers.indexOf(name);
      return idx >= 0 && idx < cells.length ? cells[idx].trim() : '';
    }

    const suppliers = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      if (cells.length === 1 && cells[0].trim() === '') continue;
      if (cells.every(c => c.trim() === '')) continue;

      const supplierName = cell('供方名称', cells);
      if (!supplierName) {
        return res.status(400).json({ error: `第 ${i + 1} 行缺少供方名称` });
      }

      const admissionDate = cell('准入时间', cells);
      if (admissionDate && !isValidDate(admissionDate)) {
        return res.status(400).json({ error: `第 ${i + 1} 行准入时间格式不正确，应为 YYYY-MM-DD` });
      }

      const businessLicense = cell('营业执照', cells);
      if (businessLicense && !isValidDate(businessLicense)) {
        return res.status(400).json({ error: `第 ${i + 1} 行营业执照格式不正确，应为 YYYY-MM-DD` });
      }

      suppliers.push({
        supplier_name: supplierName,
        product_or_service: cell('供应的产品或服务', cells) || null,
        contact_person: cell('联系人', cells) || null,
        contact_phone: cell('联系电话', cells) || null,
        category: categoryValue,
        admission_date: admissionDate ? normalizeDate(admissionDate) : null,
        business_license: businessLicense ? normalizeDate(businessLicense) : null,
        certification: cell('认证证书', cells) || null,
        basic_info_form: cell('供方基本情况登记表', cells) || null,
        remarks: cell('备注', cells) || null
      });
    }

    if (suppliers.length === 0) {
      return res.status(400).json({ error: 'CSV 中没有可导入的有效数据' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const insertSql = `INSERT INTO supplier_qualifications
      (supplier_name, product_or_service, contact_person, contact_phone,
       category, admission_date, business_license, certification, basic_info_form, remarks, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      for (const s of suppliers) {
        const [result] = await connection.execute(insertSql, [
          s.supplier_name,
          s.product_or_service,
          s.contact_person,
          s.contact_phone,
          s.category,
          s.admission_date,
          s.business_license,
          s.certification,
          s.basic_info_form,
          s.remarks,
          req.session.username
        ]);
        await logSupplierOperation(req, '批量新增', result.insertId, s.supplier_name, s);
      }
      await connection.commit();

      await logSupplierOperation(req, '上传CSV', null, null, {
        message: `通过 CSV 批量导入 ${suppliers.length} 条供应商资质，分类：${categoryValue}`,
        count: suppliers.length,
        category: categoryValue
      });

      res.json({ success: true, message: `成功导入 ${suppliers.length} 条供应商资质` });
    } catch (err) {
      await connection.rollback();
      console.error('批量导入供应商资质失败:', err);
      res.status(500).json({ error: '导入失败：' + err.message });
    } finally {
      connection.release();
    }
  });

  // ========== 资质种类管理 ==========

  // API：查询资质种类列表
  router.get('/api/qualification-types', requirePermission('supplier_qualifications'), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, name, need_expiry_check, created_by, created_at, updated_at
       FROM qualification_types
       ORDER BY updated_at DESC`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询资质种类失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：新增资质种类
  router.post('/api/qualification-types', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const { name, need_expiry_check } = req.body;

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ error: '资质名称不能为空' });
    }

    const trimmedName = String(name).trim();
    const needExpiryCheck = need_expiry_check === true || need_expiry_check === 1 ? 1 : 0;

    try {
      const [existing] = await pool.execute(
        'SELECT id FROM qualification_types WHERE name = ?',
        [trimmedName]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: '资质名称已存在' });
      }

      const [result] = await pool.execute(
        `INSERT INTO qualification_types (name, need_expiry_check, created_by)
       VALUES (?, ?, ?)`,
        [trimmedName, needExpiryCheck, req.session.username]
      );

      await logOperation(req, '新增资质种类', 'qualification_type', result.insertId, `名称: ${trimmedName}`);

      res.json({ success: true, message: '资质种类已新增', id: result.insertId });
    } catch (err) {
      console.error('新增资质种类失败:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '资质名称已存在' });
      }
      res.status(500).json({ error: '新增失败' });
    }
  });

  // API：更新资质种类
  router.put('/api/qualification-types/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少资质种类ID' });

    const { name, need_expiry_check } = req.body;

    if (!name || String(name).trim() === '') {
      return res.status(400).json({ error: '资质名称不能为空' });
    }

    const trimmedName = String(name).trim();
    const needExpiryCheck = need_expiry_check === true || need_expiry_check === 1 ? 1 : 0;

    try {
      const [existing] = await pool.execute(
        'SELECT id FROM qualification_types WHERE name = ? AND id != ?',
        [trimmedName, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: '资质名称已存在' });
      }

      const [result] = await pool.execute(
        `UPDATE qualification_types
       SET name = ?, need_expiry_check = ?
       WHERE id = ?`,
        [trimmedName, needExpiryCheck, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '资质种类不存在' });
      }

      await logOperation(req, '更新资质种类', 'qualification_type', id, `名称: ${trimmedName}`);

      res.json({ success: true, message: '资质种类已更新' });
    } catch (err) {
      console.error('更新资质种类失败:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '资质名称已存在' });
      }
      res.status(500).json({ error: '更新失败' });
    }
  });

  // API：删除资质种类（联动停用已录入的该资质记录）
  router.delete('/api/qualification-types/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少资质种类ID' });

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.execute(
        'DELETE FROM qualification_types WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ error: '资质种类不存在' });
      }

      await connection.execute(
        `UPDATE entry_supplier_qualifications
       SET current_status = 'inactive'
       WHERE qualification_type_id = ?`,
        [id]
      );

      await connection.commit();

      await logOperation(req, '删除资质种类', 'qualification_type', id, '');

      res.json({ success: true, message: '资质种类已删除，相关已录入资质已停用' });
    } catch (err) {
      await connection.rollback();
      console.error('删除资质种类失败:', err);
      res.status(500).json({ error: '删除失败' });
    } finally {
      connection.release();
    }
  });

  // API：下载资质种类 CSV 模板
  router.get('/api/qualification-types/template', requirePermission('supplier_qualifications'), (req, res) => {
    const csv = '\uFEFF' + QUALIFICATION_TYPE_CSV_HEADERS + '\n' + QUALIFICATION_TYPE_CSV_SAMPLE + '\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=qualification-types-template.csv');
    res.send(csv);
  });

  // API：从 CSV 导入资质种类
  router.post('/api/qualification-types/import', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: '缺少 CSV 内容' });
    }

    const rows = parseCsv(csv);
    if (rows.length < 2) {
      return res.status(400).json({ error: 'CSV 文件中缺少数据行' });
    }

    const headers = rows[0].map(h => h.trim());
    const requiredHeaders = ['资质名称'];
    const missing = requiredHeaders.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      return res.status(400).json({ error: `CSV 表头缺少必填列: ${missing.join(', ')}` });
    }

    function cell(name, cells) {
      const idx = headers.indexOf(name);
      return idx >= 0 && idx < cells.length ? cells[idx].trim() : '';
    }

    function parseBool(value) {
      const s = String(value).trim();
      if (!s) return 1;
      const lower = s.toLowerCase();
      if (s === '是' || s === '1' || lower === 'true' || lower === 'yes' || lower === 'y') return 1;
      return 0;
    }

    const insertList = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      if (cells.length === 1 && cells[0].trim() === '') continue;
      if (cells.every(c => c.trim() === '')) continue;

      const name = cell('资质名称', cells);
      if (!name) {
        return res.status(400).json({ error: `第 ${i + 1} 行缺少资质名称` });
      }

      insertList.push({
        name,
        need_expiry_check: parseBool(cell('是否需要过期检查', cells))
      });
    }

    if (insertList.length === 0) {
      return res.status(400).json({ error: 'CSV 中没有可导入的有效数据' });
    }

    const seenInFile = new Set();
    for (const item of insertList) {
      const key = item.name.toLowerCase();
      if (seenInFile.has(key)) {
        return res.status(400).json({ error: `CSV 中资质名称 "${item.name}" 存在重复` });
      }
      seenInFile.add(key);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [existingRows] = await connection.execute('SELECT name FROM qualification_types');
      const existingSet = new Set(existingRows.map(r => String(r.name).trim().toLowerCase()));

      for (const item of insertList) {
        if (existingSet.has(item.name.toLowerCase())) {
          await connection.rollback();
          return res.status(400).json({ error: `导入失败：资质名称 "${item.name}" 已存在` });
        }
      }

      for (const item of insertList) {
        const [result] = await connection.execute(
          'INSERT INTO qualification_types (name, need_expiry_check, created_by) VALUES (?, ?, ?)',
          [item.name, item.need_expiry_check, req.session.username]
        );

        await logOperation(req, '批量新增资质种类', 'qualification_type', result.insertId, `名称: ${item.name}`);
      }

      await connection.commit();

      await logOperation(req, '上传CSV资质种类', 'qualification_type', null, JSON.stringify({
        message: `通过 CSV 批量导入 ${insertList.length} 条资质种类`,
        count: insertList.length
      }));

      res.json({ success: true, message: `成功导入 ${insertList.length} 条资质种类` });
    } catch (err) {
      await connection.rollback();
      console.error('批量导入资质种类失败:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        const match = err.message && err.message.match(/Duplicate entry '([^']+)'/);
        const dupValue = match ? match[1] : '';
        return res.status(400).json({ error: dupValue ? `导入失败：资质名称 "${dupValue}" 已存在` : '导入失败：资质名称已存在' });
      }
      res.status(500).json({ error: '导入失败：' + err.message });
    } finally {
      connection.release();
    }
  });

  // ========== 供应商主数据管理 ==========

  // API：查询供应商列表
  router.get('/api/suppliers', requirePermission('supplier_qualifications'), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, supplier_name, supplier_type, material_category, contact_person, contact_phone,
              status, remarks1, remarks2, created_by, created_at, updated_at
       FROM suppliers
       ORDER BY updated_at DESC`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询供应商失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：新增供应商
  router.post('/api/suppliers', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const {
      supplier_name, supplier_type, material_category, contact_person, contact_phone,
      status, remarks1, remarks2
    } = req.body;

    if (!supplier_name || String(supplier_name).trim() === '') {
      return res.status(400).json({ error: '供方名称不能为空' });
    }

    const trimmedName = String(supplier_name).trim();

    try {
      const [existing] = await pool.execute(
        'SELECT id FROM suppliers WHERE supplier_name = ?',
        [trimmedName]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: '供方名称已存在' });
      }

      const [result] = await pool.execute(
        `INSERT INTO suppliers
       (supplier_name, supplier_type, material_category, contact_person, contact_phone,
        status, remarks1, remarks2, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          trimmedName,
          supplier_type || null,
          material_category || null,
          contact_person || null,
          contact_phone || null,
          status || '正常',
          remarks1 || null,
          remarks2 || null,
          req.session.username
        ]
      );

      await logOperation(req, '新增供应商', 'supplier', result.insertId, `供方名称: ${trimmedName}`);

      res.json({ success: true, message: '供应商已新增', id: result.insertId });
    } catch (err) {
      console.error('新增供应商失败:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '供方名称已存在' });
      }
      res.status(500).json({ error: '新增失败' });
    }
  });

  // API：更新供应商
  router.put('/api/suppliers/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少供应商ID' });

    const {
      supplier_name, supplier_type, material_category, contact_person, contact_phone,
      status, remarks1, remarks2
    } = req.body;

    if (!supplier_name || String(supplier_name).trim() === '') {
      return res.status(400).json({ error: '供方名称不能为空' });
    }

    const trimmedName = String(supplier_name).trim();

    try {
      const [existing] = await pool.execute(
        'SELECT id FROM suppliers WHERE supplier_name = ? AND id != ?',
        [trimmedName, id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: '供方名称已存在' });
      }

      const [result] = await pool.execute(
        `UPDATE suppliers
       SET supplier_name = ?, supplier_type = ?, material_category = ?, contact_person = ?,
           contact_phone = ?, status = ?, remarks1 = ?, remarks2 = ?
       WHERE id = ?`,
        [
          trimmedName,
          supplier_type || null,
          material_category || null,
          contact_person || null,
          contact_phone || null,
          status || '正常',
          remarks1 || null,
          remarks2 || null,
          id
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '供应商不存在' });
      }

      await logOperation(req, '更新供应商', 'supplier', id, `供方名称: ${trimmedName}`);

      res.json({ success: true, message: '供应商已更新' });
    } catch (err) {
      console.error('更新供应商失败:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '供方名称已存在' });
      }
      res.status(500).json({ error: '更新失败' });
    }
  });

  // API：删除供应商
  router.delete('/api/suppliers/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少供应商ID' });

    try {
      const [result] = await pool.execute(
        'DELETE FROM suppliers WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '供应商不存在' });
      }

      await logOperation(req, '删除供应商', 'supplier', id, '');

      res.json({ success: true, message: '供应商已删除' });
    } catch (err) {
      console.error('删除供应商失败:', err);
      res.status(500).json({ error: '删除失败' });
    }
  });

  // API：切换供应商状态（active/inactive）
  router.put('/api/suppliers/:id/status', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少供应商ID' });

    const { status } = req.body;
    const statusValue = status === 'inactive' ? 'inactive' : 'active';

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [supplierRows] = await connection.execute(
        'SELECT supplier_name, status FROM suppliers WHERE id = ?',
        [id]
      );
      if (supplierRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: '供应商不存在' });
      }

      await connection.execute(
        'UPDATE suppliers SET status = ? WHERE id = ?',
        [statusValue, id]
      );

      if (statusValue === 'inactive') {
        await connection.execute(
          `UPDATE entry_supplier_qualifications
         SET current_status = 'inactive'
         WHERE supplier_name = ?`,
          [supplierRows[0].supplier_name]
        );
      }

      await connection.commit();

      await logOperation(req, statusValue === 'inactive' ? '停用供应商' : '启用供应商',
        'supplier', id, `供方名称: ${supplierRows[0].supplier_name}`);

      res.json({ success: true, message: statusValue === 'inactive' ? '供应商已停用' : '供应商已启用' });
    } catch (err) {
      await connection.rollback();
      console.error('切换供应商状态失败:', err);
      res.status(500).json({ error: '切换状态失败' });
    } finally {
      connection.release();
    }
  });

  // API：下载供应商 CSV 模板
  router.get('/api/suppliers/template', requirePermission('supplier_qualifications'), (req, res) => {
    const csv = '\uFEFF' + SUPPLIER_CSV_HEADERS + '\n' + SUPPLIER_CSV_SAMPLE + '\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=suppliers-template.csv');
    res.send(csv);
  });

  // API：从 CSV 导入供应商
  router.post('/api/suppliers/import', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: '缺少 CSV 内容' });
    }

    const rows = parseCsv(csv);
    if (rows.length < 2) {
      return res.status(400).json({ error: 'CSV 文件中缺少数据行' });
    }

    const headers = rows[0].map(h => h.trim());
    const requiredHeaders = ['供方名称'];
    const missing = requiredHeaders.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      return res.status(400).json({ error: `CSV 表头缺少必填列: ${missing.join(', ')}` });
    }

    function cell(name, cells) {
      const idx = headers.indexOf(name);
      return idx >= 0 && idx < cells.length ? cells[idx].trim() : '';
    }

    const insertList = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      if (cells.length === 1 && cells[0].trim() === '') continue;
      if (cells.every(c => c.trim() === '')) continue;

      const supplierName = cell('供方名称', cells);
      if (!supplierName) {
        return res.status(400).json({ error: `第 ${i + 1} 行缺少供方名称` });
      }

      insertList.push({
        supplier_name: supplierName,
        supplier_type: cell('供应商类型', cells) || null,
        material_category: cell('物资分类', cells) || null,
        contact_person: cell('联系人', cells) || null,
        contact_phone: cell('电话', cells) || null,
        status: cell('状态', cells) || '正常',
        remarks1: cell('备注1', cells) || null,
        remarks2: cell('备注2', cells) || null
      });
    }

    if (insertList.length === 0) {
      return res.status(400).json({ error: 'CSV 中没有可导入的有效数据' });
    }

    const seenInFile = new Set();
    for (const item of insertList) {
      const key = item.supplier_name.toLowerCase();
      if (seenInFile.has(key)) {
        return res.status(400).json({ error: `CSV 中供方名称 "${item.supplier_name}" 存在重复` });
      }
      seenInFile.add(key);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [existingRows] = await connection.execute('SELECT supplier_name FROM suppliers');
      const existingSet = new Set(existingRows.map(r => String(r.supplier_name).trim().toLowerCase()));

      for (const item of insertList) {
        if (existingSet.has(item.supplier_name.toLowerCase())) {
          await connection.rollback();
          return res.status(400).json({ error: `导入失败：供方名称 "${item.supplier_name}" 已存在` });
        }
      }

      for (const item of insertList) {
        const [result] = await connection.execute(
          `INSERT INTO suppliers
         (supplier_name, supplier_type, material_category, contact_person, contact_phone,
          status, remarks1, remarks2, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.supplier_name,
            item.supplier_type,
            item.material_category,
            item.contact_person,
            item.contact_phone,
            item.status,
            item.remarks1,
            item.remarks2,
            req.session.username
          ]
        );

        await logOperation(req, '批量新增供应商', 'supplier', result.insertId, `供方名称: ${item.supplier_name}`);
      }

      await connection.commit();

      await logOperation(req, '上传CSV供应商', 'supplier', null, JSON.stringify({
        message: `通过 CSV 批量导入 ${insertList.length} 条供应商`,
        count: insertList.length
      }));

      res.json({ success: true, message: `成功导入 ${insertList.length} 条供应商` });
    } catch (err) {
      await connection.rollback();
      console.error('批量导入供应商失败:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        const match = err.message && err.message.match(/Duplicate entry '([^']+)'/);
        const dupValue = match ? match[1] : '';
        return res.status(400).json({ error: dupValue ? `导入失败：供方名称 "${dupValue}" 已存在` : '导入失败：供方名称已存在' });
      }
      res.status(500).json({ error: '导入失败：' + err.message });
    } finally {
      connection.release();
    }
  });

  // ========== 产品列表 ==========

  // API：查询产品列表
  router.get('/api/product-list', requirePermission('supplier_qualifications'), async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT id, company_name, product_name, model, manufacturer, status,
              created_by, created_at, updated_at
       FROM product_list
       ORDER BY company_name, product_name, model`
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询产品列表失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：新增产品
  router.post('/api/product-list', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const { company_name, product_name, model, manufacturer } = req.body;

    if (!company_name || String(company_name).trim() === '') {
      return res.status(400).json({ error: '公司名称不能为空' });
    }
    if (!product_name || String(product_name).trim() === '') {
      return res.status(400).json({ error: '产品名不能为空' });
    }

    const trimmedCompany = String(company_name).trim();
    const trimmedProduct = String(product_name).trim();
    const trimmedModel = model ? String(model).trim() : '';
    const trimmedManufacturer = manufacturer ? String(manufacturer).trim() : null;

    try {
      const [supplierRows] = await pool.execute(
        'SELECT id FROM suppliers WHERE supplier_name = ?',
        [trimmedCompany]
      );
      if (supplierRows.length === 0) {
        return res.status(400).json({ error: `公司名称 "${trimmedCompany}" 不存在于供应商主数据中` });
      }

      const [existing] = await pool.execute(
        `SELECT id FROM product_list
       WHERE company_name = ? AND product_name = ? AND COALESCE(model, "") = ? AND COALESCE(manufacturer, "") = ?`,
        [trimmedCompany, trimmedProduct, trimmedModel, trimmedManufacturer || '']
      );
      if (existing.length > 0) {
        return res.status(400).json({
          error: `记录已存在：${trimmedCompany} / ${trimmedProduct} / ${trimmedModel || '(无型号)'} / ${trimmedManufacturer || '(无生产商)'}`
        });
      }

      const [result] = await pool.execute(
        `INSERT INTO product_list
       (company_name, product_name, model, manufacturer, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
        [trimmedCompany, trimmedProduct, trimmedModel || null, trimmedManufacturer, 'active', req.session.username]
      );

      await logOperation(req, '新增产品', 'product_list', result.insertId,
        `公司: ${trimmedCompany}, 产品: ${trimmedProduct}`);

      res.json({ success: true, message: '产品已新增', id: result.insertId });
    } catch (err) {
      console.error('新增产品失败:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '该产品已存在' });
      }
      if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({ error: `公司名称 "${trimmedCompany}" 不存在于供应商主数据中` });
      }
      res.status(500).json({ error: '新增失败' });
    }
  });

  // API：更新产品
  router.put('/api/product-list/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少产品ID' });

    const { company_name, product_name, model, manufacturer, status } = req.body;

    if (!company_name || String(company_name).trim() === '') {
      return res.status(400).json({ error: '公司名称不能为空' });
    }
    if (!product_name || String(product_name).trim() === '') {
      return res.status(400).json({ error: '产品名不能为空' });
    }

    const trimmedCompany = String(company_name).trim();
    const trimmedProduct = String(product_name).trim();
    const trimmedModel = model ? String(model).trim() : '';
    const trimmedManufacturer = manufacturer ? String(manufacturer).trim() : null;
    const statusValue = status === 'inactive' ? 'inactive' : 'active';

    try {
      const [supplierRows] = await pool.execute(
        'SELECT id FROM suppliers WHERE supplier_name = ?',
        [trimmedCompany]
      );
      if (supplierRows.length === 0) {
        return res.status(400).json({ error: `公司名称 "${trimmedCompany}" 不存在于供应商主数据中` });
      }

      const [existing] = await pool.execute(
        `SELECT id FROM product_list
       WHERE company_name = ? AND product_name = ? AND COALESCE(model, "") = ? AND COALESCE(manufacturer, "") = ? AND id != ?`,
        [trimmedCompany, trimmedProduct, trimmedModel, trimmedManufacturer || '', id]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          error: `记录已存在：${trimmedCompany} / ${trimmedProduct} / ${trimmedModel || '(无型号)'} / ${trimmedManufacturer || '(无生产商)'}`
        });
      }

      const [result] = await pool.execute(
        `UPDATE product_list
       SET company_name = ?, product_name = ?, model = ?, manufacturer = ?, status = ?
       WHERE id = ?`,
        [trimmedCompany, trimmedProduct, trimmedModel || null, trimmedManufacturer, statusValue, id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '产品不存在' });
      }

      await logOperation(req, '更新产品', 'product_list', id,
        `公司: ${trimmedCompany}, 产品: ${trimmedProduct}`);

      res.json({ success: true, message: '产品已更新' });
    } catch (err) {
      console.error('更新产品失败:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: '该产品已存在' });
      }
      if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({ error: `公司名称 "${trimmedCompany}" 不存在于供应商主数据中` });
      }
      res.status(500).json({ error: '更新失败' });
    }
  });

  // API：删除产品
  router.delete('/api/product-list/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少产品ID' });

    try {
      const [result] = await pool.execute(
        'DELETE FROM product_list WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '产品不存在' });
      }

      await logOperation(req, '删除产品', 'product_list', id, '');

      res.json({ success: true, message: '产品已删除' });
    } catch (err) {
      console.error('删除产品失败:', err);
      res.status(500).json({ error: '删除失败' });
    }
  });

  // API：切换产品状态（active/inactive）
  router.put('/api/product-list/:id/status', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: '缺少产品ID' });

    const { status } = req.body;
    const statusValue = status === 'inactive' ? 'inactive' : 'active';

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [productRows] = await connection.execute(
        'SELECT company_name, product_name, model, manufacturer, status FROM product_list WHERE id = ?',
        [id]
      );
      if (productRows.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: '产品不存在' });
      }

      await connection.execute(
        'UPDATE product_list SET status = ? WHERE id = ?',
        [statusValue, id]
      );

      if (statusValue === 'inactive') {
        const p = productRows[0];
        await connection.execute(
          `UPDATE entry_supplier_qualifications eq
         INNER JOIN product_list pl ON eq.prudoct_list_id = pl.id
         SET eq.current_status = 'inactive'
         WHERE pl.company_name = ?
           AND pl.product_name = ?
           AND COALESCE(pl.model, '') = ?
           AND COALESCE(pl.manufacturer, '') = ?`,
          [p.company_name, p.product_name, p.model || '', p.manufacturer || '']
        );
      }

      await connection.commit();

      await logOperation(req, statusValue === 'inactive' ? '停用产品' : '启用产品',
        'product_list', id, `公司: ${productRows[0].company_name}, 产品: ${productRows[0].product_name}`);

      res.json({ success: true, message: statusValue === 'inactive' ? '产品已停用' : '产品已启用' });
    } catch (err) {
      await connection.rollback();
      console.error('切换产品状态失败:', err);
      res.status(500).json({ error: '切换状态失败' });
    } finally {
      connection.release();
    }
  });

  // API：下载产品列表 CSV 模板
  router.get('/api/product-list/template', requirePermission('supplier_qualifications'), (req, res) => {
    const csv = '\uFEFF' + PRODUCT_LIST_CSV_HEADERS + '\n' + PRODUCT_LIST_CSV_SAMPLE + '\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=product-list-template.csv');
    res.send(csv);
  });

  // API：从 CSV 导入产品
  router.post('/api/product-list/import', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const { csv } = req.body;
    if (!csv || typeof csv !== 'string') {
      return res.status(400).json({ error: '缺少 CSV 内容' });
    }

    const rows = parseCsv(csv);
    if (rows.length < 2) {
      return res.status(400).json({ error: 'CSV 文件中缺少数据行' });
    }

    const headers = rows[0].map(h => h.trim());
    const requiredHeaders = ['公司名称', '产品名'];
    const missing = requiredHeaders.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      return res.status(400).json({ error: `CSV 表头缺少必填列: ${missing.join(', ')}` });
    }

    function cell(name, cells) {
      const idx = headers.indexOf(name);
      return idx >= 0 && idx < cells.length ? cells[idx].trim() : '';
    }

    const insertList = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      if (cells.length === 1 && cells[0].trim() === '') continue;
      if (cells.every(c => c.trim() === '')) continue;

      const companyName = cell('公司名称', cells);
      const productName = cell('产品名', cells);
      if (!companyName) {
        return res.status(400).json({ error: `第 ${i + 1} 行缺少公司名称` });
      }
      if (!productName) {
        return res.status(400).json({ error: `第 ${i + 1} 行缺少产品名` });
      }

      insertList.push({
        company_name: companyName,
        product_name: productName,
        model: cell('型号', cells) || '',
        manufacturer: cell('生产商', cells) || null
      });
    }

    if (insertList.length === 0) {
      return res.status(400).json({ error: 'CSV 中没有可导入的有效数据' });
    }

    // 校验 CSV 内部是否有重复
    const seenInFile = new Map();
    for (let i = 0; i < insertList.length; i++) {
      const item = insertList[i];
      const key = `${item.company_name}\t${item.product_name}\t${item.model}\t${item.manufacturer || ''}`.toLowerCase();
      if (seenInFile.has(key)) {
        const firstRow = seenInFile.get(key) + 2;
        const currentRow = i + 2;
        return res.status(400).json({
          error: `CSV 中第 ${firstRow} 行与第 ${currentRow} 行重复：${item.company_name} / ${item.product_name} / ${item.model || '(无型号)'} / ${item.manufacturer || '(无生产商)'}`
        });
      }
      seenInFile.set(key, i);
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 校验所有公司名称存在于 suppliers
      const [supplierRows] = await connection.execute('SELECT supplier_name FROM suppliers');
      const supplierSet = new Set(supplierRows.map(r => String(r.supplier_name).trim().toLowerCase()));
      for (const item of insertList) {
        if (!supplierSet.has(item.company_name.toLowerCase())) {
          await connection.rollback();
          return res.status(400).json({ error: `导入失败：公司名称 "${item.company_name}" 不存在于供应商主数据中` });
        }
      }

      // 检查与数据库中已有记录是否重复
      const [existingRows] = await connection.execute(
        'SELECT company_name, product_name, COALESCE(model, "") AS model, COALESCE(manufacturer, "") AS manufacturer FROM product_list'
      );
      const existingSet = new Set(
        existingRows.map(r => `${r.company_name}\t${r.product_name}\t${r.model}\t${r.manufacturer}`.toLowerCase())
      );

      for (let i = 0; i < insertList.length; i++) {
        const item = insertList[i];
        const key = `${item.company_name}\t${item.product_name}\t${item.model}\t${item.manufacturer || ''}`.toLowerCase();
        if (existingSet.has(key)) {
          await connection.rollback();
          return res.status(400).json({
            error: `导入失败：第 ${i + 2} 行 [${item.company_name} / ${item.product_name} / ${item.model || '(无型号)'} / ${item.manufacturer || '(无生产商)'}] 与系统中已有记录重复`
          });
        }
      }

      for (const item of insertList) {
        const [result] = await connection.execute(
          `INSERT INTO product_list
         (company_name, product_name, model, manufacturer, created_by)
         VALUES (?, ?, ?, ?, ?)`,
          [
            item.company_name,
            item.product_name,
            item.model || null,
            item.manufacturer,
            req.session.username
          ]
        );

        await logOperation(req, '批量新增产品', 'product_list', result.insertId,
          `公司: ${item.company_name}, 产品: ${item.product_name}`);
      }

      await connection.commit();

      await logOperation(req, '上传CSV产品列表', 'product_list', null, JSON.stringify({
        message: `通过 CSV 批量导入 ${insertList.length} 条产品`,
        count: insertList.length
      }));

      res.json({ success: true, message: `成功导入 ${insertList.length} 条产品` });
    } catch (err) {
      await connection.rollback();
      console.error('批量导入产品失败:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        const match = err.message && err.message.match(/Duplicate entry '([^']+)'/);
        const dupValue = match ? match[1] : '';
        return res.status(400).json({ error: dupValue ? `导入失败："${dupValue}" 已存在` : '导入失败：记录已存在' });
      }
      if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({ error: '导入失败：公司名称不存在于供应商主数据中' });
      }
      res.status(500).json({ error: '导入失败：' + err.message });
    } finally {
      connection.release();
    }
  });

  // ========== 录入供应商资质 ==========

  // API：查询指定供应商或产品的资质记录
  router.get('/api/entry-supplier-qualifications', requirePermission('supplier_qualifications'), async (req, res) => {
    const supplierId = parseInt(req.query.supplier_id, 10);
    const productListId = parseInt(req.query.product_list_id, 10);

    if (!supplierId && !productListId) {
      return res.status(400).json({ error: '缺少供应商ID或产品ID' });
    }

    try {
      let whereClause = '';
      let params = [];
      if (productListId) {
        whereClause = 'WHERE prudoct_list_id = ?';
        params = [productListId];
      } else {
        whereClause = 'WHERE supplier_id = ?';
        params = [supplierId];
      }

      const [rows] = await pool.execute(
        `SELECT id, supplier_id, supplier_name, qualification_type_id, qualification_name,
              prudoct_list_id, issue_date, expiry_date, current_status, permanent_valid, description, remarks
       FROM entry_supplier_qualifications
       ${whereClause}
       ORDER BY qualification_name, issue_date`,
        params
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      console.error('查询供应商资质记录失败:', err);
      res.status(500).json({ error: '查询失败' });
    }
  });

  // API：批量保存供应商资质
  router.post('/api/entry-supplier-qualifications/batch', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: '缺少要保存的资质记录' });
    }

    const normalizedRecords = [];
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const recordId = r.id ? parseInt(r.id, 10) : null;
      const qualificationTypeId = parseInt(r.qualification_type_id, 10);
      const qualificationName = r.qualification_name ? String(r.qualification_name).trim() : '';
      const productListId = r.prudoct_list_id ? parseInt(r.prudoct_list_id, 10) : null;

      if (!qualificationTypeId) {
        return res.status(400).json({ error: `第 ${i + 1} 条记录缺少资质ID` });
      }
      if (!qualificationName) {
        return res.status(400).json({ error: `第 ${i + 1} 条记录缺少资质名称` });
      }

      let supplierId;
      let supplierName;
      if (productListId) {
        const [productRows] = await pool.execute(
          `SELECT p.company_name, s.id AS supplier_id
         FROM product_list p
         LEFT JOIN suppliers s ON s.supplier_name = p.company_name
         WHERE p.id = ?`,
          [productListId]
        );
        if (productRows.length === 0) {
          return res.status(400).json({ error: `第 ${i + 1} 条记录对应的产品不存在` });
        }
        if (!productRows[0].supplier_id) {
          return res.status(400).json({ error: `第 ${i + 1} 条记录对应的公司未在供应商表中登记` });
        }
        supplierId = productRows[0].supplier_id;
        supplierName = productRows[0].company_name;
      } else {
        supplierId = parseInt(r.supplier_id, 10);
        supplierName = r.supplier_name ? String(r.supplier_name).trim() : '';
        if (!supplierId) {
          return res.status(400).json({ error: `第 ${i + 1} 条记录缺少供应商ID或产品ID` });
        }
        if (!supplierName) {
          return res.status(400).json({ error: `第 ${i + 1} 条记录缺少供应商名称` });
        }
      }

      const permanentValid = r.permanent_valid === true || r.permanent_valid === 1 || String(r.permanent_valid).trim() === '1' ? 1 : 0;
      const issueDate = r.issue_date ? String(r.issue_date).trim() : null;
      const expiryDate = permanentValid ? null : (r.expiry_date ? String(r.expiry_date).trim() : null);

      normalizedRecords.push({
        id: recordId,
        supplier_id: supplierId,
        supplier_name: supplierName,
        prudoct_list_id: productListId,
        qualification_type_id: qualificationTypeId,
        qualification_name: qualificationName,
        issue_date: issueDate,
        expiry_date: expiryDate,
        current_status: r.current_status ? String(r.current_status).trim() : 'active',
        permanent_valid: permanentValid,
        description: r.description ? String(r.description).trim() : null,
        remarks: r.remarks ? String(r.remarks).trim() : null
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let insertCount = 0;
      let updateCount = 0;

      for (const item of normalizedRecords) {
        if (item.id) {
          const [result] = await connection.execute(
            `UPDATE entry_supplier_qualifications
           SET supplier_name = ?, qualification_type_id = ?, qualification_name = ?,
               prudoct_list_id = ?, issue_date = ?, expiry_date = ?, current_status = ?, permanent_valid = ?,
               description = ?, remarks = ?
           WHERE id = ? AND supplier_id = ?`,
            [
              item.supplier_name,
              item.qualification_type_id,
              item.qualification_name,
              item.prudoct_list_id,
              item.issue_date,
              item.expiry_date,
              item.current_status,
              item.permanent_valid,
              item.description,
              item.remarks,
              item.id,
              item.supplier_id
            ]
          );
          if (result.affectedRows > 0) updateCount++;
        } else {
          await connection.execute(
            `INSERT INTO entry_supplier_qualifications
           (supplier_id, supplier_name, qualification_type_id, qualification_name,
            prudoct_list_id, issue_date, expiry_date, current_status, permanent_valid,
            description, remarks, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              item.supplier_id,
              item.supplier_name,
              item.qualification_type_id,
              item.qualification_name,
              item.prudoct_list_id,
              item.issue_date,
              item.expiry_date,
              item.current_status,
              item.permanent_valid,
              item.description,
              item.remarks,
              req.session.username
            ]
          );
          insertCount++;
        }
      }

      await connection.commit();

      await logOperation(req, '保存供应商资质', 'entry_supplier_qualification', null, JSON.stringify({
        message: `批量保存供应商资质`,
        insert_count: insertCount,
        update_count: updateCount
      }));

      res.json({ success: true, message: `成功保存：新增 ${insertCount} 条，更新 ${updateCount} 条` });
    } catch (err) {
      await connection.rollback();
      console.error('批量保存供应商资质失败:', err);
      res.status(500).json({ error: '保存失败：' + err.message });
    } finally {
      connection.release();
    }
  });

  // API：删除供应商资质记录
  router.delete('/api/entry-supplier-qualifications/:id', requirePermission('supplier_qualifications_edit'), async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      return res.status(400).json({ error: '缺少资质记录ID' });
    }

    try {
      const [result] = await pool.execute(
        'DELETE FROM entry_supplier_qualifications WHERE id = ?',
        [id]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '资质记录不存在' });
      }

      await logOperation(req, '删除供应商资质', 'entry_supplier_qualification', id, JSON.stringify({
        message: `删除供应商资质记录 ID:${id}`
      }));

      res.json({ success: true, message: '资质记录已删除' });
    } catch (err) {
      console.error('删除供应商资质记录失败:', err);
      res.status(500).json({ error: '删除失败：' + err.message });
    }
  });

  return router;
};
