-- ============================================
-- 迁移脚本：为 product_list 表增加 status 字段
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-product-list-add-status.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE product_list
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT '状态：active/inactive' AFTER manufacturer,
  ADD KEY idx_status (status);
