-- ============================================
-- 员工培训记录表
-- 用于存储员工参加的培训记录
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/training-records.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS training_records (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  username          VARCHAR(50)  NOT NULL COMMENT '用户名，关联 users 表',
  training_date     DATE         NOT NULL COMMENT '培训日期',
  training_content  TEXT         NOT NULL COMMENT '培训内容',
  training_hours    DECIMAL(5,2) NULL COMMENT '培训课时',
  training_form     VARCHAR(50)  NULL COMMENT '培训形式，如：线上、线下、内部、外部',
  assessment_method VARCHAR(100) NULL COMMENT '考核方法',
  assessment_result VARCHAR(50)  NULL COMMENT '考核结果，如：通过、未通过、优秀',
  trainer           VARCHAR(100) NULL COMMENT '培训讲师/负责人',
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '记录更新时间',
  KEY idx_username (username),
  KEY idx_training_date (training_date),
  CONSTRAINT fk_training_records_username
    FOREIGN KEY (username) REFERENCES users(username)
    ON DELETE RESTRICT
    ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='员工培训记录表';
