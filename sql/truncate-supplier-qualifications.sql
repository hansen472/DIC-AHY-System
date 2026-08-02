-- ============================================
-- 清空供应商资质表及其操作日志表
-- 用于重新通过 CSV 导入数据
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/truncate-supplier-qualifications.sql
-- ============================================

USE pdf_print_db;

-- 清空数据（并重置自增 ID）
TRUNCATE TABLE supplier_qualification_logs;
TRUNCATE TABLE supplier_qualifications;


-- 确保营业执照字段为日期型（如果之前未执行过 alter 脚本）
ALTER TABLE supplier_qualifications
  MODIFY COLUMN business_license DATE NULL COMMENT '营业执照有效期';

