-- ============================================
-- 产品列表表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/product-list.sql
-- ============================================

USE pdf_print_db;

-- 产品列表（每个产品归属一个已在 suppliers 表中登记的公司）
CREATE TABLE IF NOT EXISTS product_list (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  company_name   VARCHAR(200) NOT NULL COMMENT '公司名称，需存在于 suppliers.supplier_name',
  product_name   VARCHAR(200) NOT NULL COMMENT '产品名',
  model          VARCHAR(200) NULL COMMENT '型号',
  manufacturer   VARCHAR(200) NULL COMMENT '生产商',
  status         VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '状态：active/inactive',
  created_by     VARCHAR(50)  NULL COMMENT '创建人',
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY idx_company_name (company_name),
  KEY idx_product_name (product_name),
  KEY idx_model (model),
  KEY idx_status (status),
  CONSTRAINT fk_product_list_company_name
    FOREIGN KEY (company_name) REFERENCES suppliers(supplier_name)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='产品列表';
