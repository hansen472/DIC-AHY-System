-- ============================================
-- 领值推送日志表
-- 记录"仪器/仪表"和"设备过期工单推送"两个模块的推送操作
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/push-logs.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS push_logs (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  source        ENUM('instrument_meter','overdue_workorder','daily_workorder') NOT NULL COMMENT '来源模块',
  push_time     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '推送时间',
  push_method   VARCHAR(20) NOT NULL COMMENT '推送方式: email / wechat',
  push_status   ENUM('success','failed') NOT NULL COMMENT '推送状态',
  push_content  TEXT COMMENT '推送内容摘要',
  record_count  INT UNSIGNED DEFAULT 0 COMMENT '推送记录数',
  push_target   VARCHAR(255) COMMENT '推送对象（邮箱地址 / Webhook URL）',
  pusher        VARCHAR(50) NOT NULL COMMENT '推送人（用户名 / system）',
  error_message TEXT COMMENT '失败原因',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  KEY idx_source (source),
  KEY idx_push_time (push_time),
  KEY idx_push_status (push_status),
  KEY idx_pusher (pusher)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='领值推送日志表';
