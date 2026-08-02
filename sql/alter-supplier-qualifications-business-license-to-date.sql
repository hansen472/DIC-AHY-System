-- ============================================
-- 供应商资质表营业执照字段改为日期型
-- 将 business_license 从 VARCHAR(500) 改为 DATE
-- 并把现有非空内容统一替换为占位日期 9999-09-09
-- 同时同步更正 supplier_qualification_logs 日志中的 business_license 记录
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-supplier-qualifications-business-license-to-date.sql
-- ============================================

USE pdf_print_db;

-- 1. 将主表中现有营业执照内容统一替换为占位日期
UPDATE supplier_qualifications
SET business_license = '9999-09-09'
WHERE business_license IS NOT NULL AND business_license != '';

-- 2. 同步更正操作日志中的营业执照字段（detail 为 JSON 文本）
--    适用于 MySQL 8.0+（支持 REGEXP_REPLACE）。
--    该正则会把 JSON 中任意字符串形式的 "business_license": "..." 替换为
--    "business_license": "9999-09-09"。
UPDATE supplier_qualification_logs
SET detail = REGEXP_REPLACE(
    detail,
    '"business_license"\\s*:\\s*"[^"]*"',
    '"business_license":"9999-09-09"'
  )
WHERE detail LIKE '%"business_license"%';

-- 3. 修改字段类型为 DATE，并更新注释
ALTER TABLE supplier_qualifications
  MODIFY COLUMN business_license DATE NULL COMMENT '营业执照有效期';
