-- ============================================
-- 偏差上报表（接入审批流）
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/deviation-reports.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS deviation_reports (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '偏差上报ID',
  department    VARCHAR(200)  NOT NULL COMMENT '偏差发现部门',
  dev_time      DATETIME      NOT NULL COMMENT '发现时间',
  reporter      VARCHAR(50)   NOT NULL COMMENT '发现人用户名',
  reporter_name VARCHAR(100)  NULL     COMMENT '发现人姓名',
  subject       VARCHAR(200)  NOT NULL COMMENT '涉及主体（物料/中间产品/产品/设备/方法等）',
  `model`       VARCHAR(200)  NULL     COMMENT '涉及型号',
  spec          VARCHAR(200)  NULL     COMMENT '涉及的规格',
  batch         VARCHAR(200)  NULL     COMMENT '涉及的批号/编号',
  quantity      VARCHAR(100)  NULL     COMMENT '涉及的数量',
  description   TEXT          NOT NULL COMMENT '详细的偏差描述',
  status        VARCHAR(50)   NOT NULL DEFAULT 'pending_approval' COMMENT '状态：draft草稿/pending_approval审批中/approved已通过/rejected已驳回',
  created_by    VARCHAR(50)   NULL     COMMENT '提交人',
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_status (status),
  KEY idx_created_by (created_by),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='偏差上报表';
