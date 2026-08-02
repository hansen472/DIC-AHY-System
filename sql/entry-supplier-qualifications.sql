-- ============================================
-- 录入供应商资质表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/entry-supplier-qualifications.sql
-- ============================================

USE pdf_print_db;

-- 录入供应商资质表（对应业务功能“录入供应商资质”）
CREATE TABLE IF NOT EXISTS entry_supplier_qualifications (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  supplier_id           INT UNSIGNED NOT NULL COMMENT '供应商ID，关联 suppliers.id',
  supplier_name         VARCHAR(200) NOT NULL COMMENT '供应商名称',
  qualification_type_id INT UNSIGNED NOT NULL COMMENT '资质类型ID，关联 qualification_types.id',
  qualification_name    VARCHAR(200) NOT NULL COMMENT '资质名称',
  prudoct_list_id       INT UNSIGNED NULL COMMENT '关联产品列表ID，关联 product_list.id',
  issue_date            DATE         NULL COMMENT '发行日期',
  expiry_date           DATE         NULL COMMENT '过期日期',
  current_status        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '现在状态标志，如：active/expiring soon/expired/inactive',
  permanent_valid       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '永久有效：1=是，0=否',
  description           TEXT         NULL COMMENT '描述',
  remarks               TEXT         NULL COMMENT '备注',
  created_by            VARCHAR(50)  NULL COMMENT '创建人',
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY idx_supplier_id (supplier_id),
  KEY idx_qualification_type_id (qualification_type_id),
  KEY idx_prudoct_list_id (prudoct_list_id),
  KEY idx_current_status (current_status),
  KEY idx_expiry_date (expiry_date),
  CONSTRAINT fk_entry_supplier_qualifications_prudoct_list_id
    FOREIGN KEY (prudoct_list_id) REFERENCES product_list(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='录入供应商资质表';
