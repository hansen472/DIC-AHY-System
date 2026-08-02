-- ============================================
-- 供应商资质管理相关表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/supplier-qualifications.sql
-- ============================================

USE pdf_print_db;

-- 供应商资质主表
CREATE TABLE IF NOT EXISTS supplier_qualifications (
  id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  supplier_name          VARCHAR(200) NOT NULL COMMENT '供方名称',
  product_or_service     TEXT         NULL COMMENT '供应的产品或服务',
  contact_person         VARCHAR(100) NULL COMMENT '联系人',
  contact_phone          VARCHAR(50)  NULL COMMENT '联系电话',
  admission_date         DATE         NULL COMMENT '准入时间（年月日）',
  business_license       VARCHAR(500) NULL COMMENT '营业执照文件路径或编号',
  certification          VARCHAR(500) NULL COMMENT '认证证书文件路径或编号',
  basic_info_form        VARCHAR(500) NULL COMMENT '供方基本情况登记表文件路径或编号',
  remarks                TEXT         NULL COMMENT '备注',
  created_by             VARCHAR(50)  NULL COMMENT '创建人',
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  KEY idx_supplier_name (supplier_name),
  KEY idx_admission_date (admission_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='供应商资质表';

-- 供应商资质操作日志表
CREATE TABLE IF NOT EXISTS supplier_qualification_logs (
  id                     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  username               VARCHAR(50)  NOT NULL COMMENT '操作人用户名',
  action                 VARCHAR(50)  NOT NULL COMMENT '操作类型：新增/修改/删除',
  supplier_id            INT UNSIGNED NULL COMMENT '关联供应商ID',
  supplier_name          VARCHAR(200) NULL COMMENT '供应商名称（快照）',
  detail                 TEXT         NULL COMMENT '操作详情（变更内容JSON）',
  ip_address             VARCHAR(45)  NULL COMMENT '操作来源IP',
  computer_name          VARCHAR(255) NULL COMMENT '操作来源电脑名称（DNS反向解析或User-Agent）',
  user_agent             VARCHAR(500) NULL COMMENT '浏览器User-Agent',
  created_at             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  KEY idx_username (username),
  KEY idx_action (action),
  KEY idx_supplier_id (supplier_id),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='供应商资质操作日志表';
