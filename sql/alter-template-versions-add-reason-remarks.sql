-- ============================================
-- 为已存在的 template_versions 表增加 reason 和 remarks 字段
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-template-versions-add-reason-remarks.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE template_versions
  ADD COLUMN IF NOT EXISTS reason VARCHAR(255) NULL COMMENT '修改原因',
  ADD COLUMN IF NOT EXISTS remarks TEXT NULL COMMENT '备注';
