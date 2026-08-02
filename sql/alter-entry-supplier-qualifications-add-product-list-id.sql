-- ============================================
-- 迁移脚本：为 entry_supplier_qualifications 表增加 prudoct_list_id 字段
-- 用于关联 product_list 表的 id
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-entry-supplier-qualifications-add-product-list-id.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE entry_supplier_qualifications
  ADD COLUMN prudoct_list_id INT UNSIGNED NULL COMMENT '关联产品列表ID，关联 product_list.id' AFTER qualification_name,
  ADD KEY idx_prudoct_list_id (prudoct_list_id),
  ADD CONSTRAINT fk_entry_supplier_qualifications_prudoct_list_id
    FOREIGN KEY (prudoct_list_id) REFERENCES product_list(id)
    ON DELETE SET NULL ON UPDATE CASCADE;
