-- ============================================================
-- COA 产品数据表（同步自云端 Azure SQL）
--
-- 在 pdf_print_db 数据库中执行本脚本：
--   mysql -u root -p pdf_print_db < sql/coa-report-product-data.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS COA_report_product_data (
  product_id         VARCHAR(100)  PRIMARY KEY        COMMENT '产品ID（云端主键）',
  product_code       VARCHAR(200)                     COMMENT '产品编码',
  tenant_id          VARCHAR(100)                     COMMENT '租户ID',
  product_name       VARCHAR(500)                     COMMENT '产品名称',
  check_gist         TEXT                             COMMENT '检验标准',
  norm               TEXT                             COMMENT '规格标准',
  object_creation_date DATETIME                       COMMENT '创建时间',
  created_by         VARCHAR(200)                     COMMENT '创建人',
  last_updated_by    VARCHAR(200)                     COMMENT '最后更新人',
  synced_at          DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '最近同步时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='产品数据（同步自云端 Azure SQL report_product_data）';
