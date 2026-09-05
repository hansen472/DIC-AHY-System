-- ============================================
-- 仪器/仪表到期邮件通知设置表
-- 存储自动邮件通知的开关状态和发送间隔天数
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/instrument-meter-notification-settings.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS instrument_meter_notification_settings (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  enabled         TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用自动邮件通知：1=启用，0=停用',
  interval_days   INT UNSIGNED NOT NULL DEFAULT 30 COMMENT '邮件发送间隔（天），可选 30/45/60/90/180',
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_singleton (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='仪器/仪表到期邮件通知设置';

-- 插入默认设置（启用，30天间隔）
INSERT INTO instrument_meter_notification_settings (enabled, interval_days)
VALUES (1, 30)
ON DUPLICATE KEY UPDATE id = id;
