-- ============================================
-- 供应商主数据表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/suppliers.sql
-- ============================================

USE pdf_print_db;

-- 供应商主数据表
CREATE TABLE IF NOT EXISTS suppliers (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  supplier_name      VARCHAR(200) NOT NULL COMMENT '供方名称',
  supplier_type      VARCHAR(50)  NULL COMMENT '供应商类型，如生产型/经销型/服务型/特殊物资类',
  material_category  VARCHAR(100) NULL COMMENT '物资分类',
  contact_person     VARCHAR(100) NULL COMMENT '联系人',
  contact_phone      VARCHAR(50)  NULL COMMENT '电话',
  status             VARCHAR(20)  NOT NULL DEFAULT '正常' COMMENT '状态，如：正常/停用',
  remarks1           TEXT         NULL COMMENT '备注1',
  remarks2           TEXT         NULL COMMENT '备注2',
  created_by         VARCHAR(50)  NULL COMMENT '创建人',
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY idx_supplier_name (supplier_name),
  KEY idx_supplier_type (supplier_type),
  KEY idx_material_category (material_category),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='供应商主数据表';
