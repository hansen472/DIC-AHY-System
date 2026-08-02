-- ============================================
-- 年度培训计划表
-- 用于存储年度培训计划信息
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/annual-training-plans.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS annual_training_plans (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  `year`             INT UNSIGNED NULL COMMENT '年度',
  department         VARCHAR(100) NOT NULL COMMENT '部门',
  training_content   TEXT         NOT NULL COMMENT '培训项目/课程/内容',
  target_trainees    VARCHAR(255) NULL COMMENT '目标学员',
  training_method    VARCHAR(100) NULL COMMENT '培训方式',
  training_type      VARCHAR(50)  NULL COMMENT '内训/外训',
  trainer            VARCHAR(100) NULL COMMENT '讲师',
  price              DECIMAL(10,2) NULL COMMENT '价格',
  training_hours     DECIMAL(5,2) NULL COMMENT '培训课时',
  training_schedule  VARCHAR(255) NULL COMMENT '培训日程',
  need_assessment    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否考核：1=是，0=否',
  tracking           TEXT         NULL COMMENT '跟踪',
  is_notified        TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否通知：1=是，0=否',
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录更新时间',
  KEY idx_department (department),
  KEY idx_training_type (training_type),
  KEY idx_year (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='年度培训计划表';
