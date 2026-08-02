-- ============================================
-- 供应商资质表新增 category 分类字段
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-supplier-qualifications-add-category.sql
-- ============================================

USE pdf_print_db;

-- 新增分类字段，默认值为 special
ALTER TABLE supplier_qualifications
  ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'special' COMMENT '供应商分类：production/service/special' AFTER admission_date;

-- 历史数据统一归为 special
UPDATE supplier_qualifications SET category = 'special' WHERE category IS NULL OR category = '';
