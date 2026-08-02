-- ============================================
-- 资质类型管理相关表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/qualification-types.sql
-- ============================================

USE pdf_print_db;

-- 资质类型表
CREATE TABLE IF NOT EXISTS qualification_types (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  name              VARCHAR(200) NOT NULL COMMENT '资质名称',
  need_expiry_check TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否需要过期检查：1=是，0=否',
  created_by        VARCHAR(50)  NULL COMMENT '创建人',
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY idx_name (name),
  KEY idx_need_expiry_check (need_expiry_check)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资质类型表';
