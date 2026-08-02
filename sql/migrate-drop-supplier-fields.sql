-- ============================================
-- 迁移脚本：删除 suppliers 表的 product_or_service、material_model、manufacturer 字段
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/migrate-drop-supplier-fields.sql
--
-- 注意：
-- 1. 该操作会永久删除这三个字段及其已有数据，执行前请确认已备份。
-- 2. 这些字段已迁移到 product_list 表进行管理。
-- ============================================

USE pdf_print_db;

ALTER TABLE suppliers
  DROP COLUMN IF EXISTS product_or_service,
  DROP COLUMN IF EXISTS material_model,
  DROP COLUMN IF EXISTS manufacturer;
