-- ============================================
-- 仪器/仪表基准日表
-- 保存查询时的仪器/仪表编码快照，方便后续回顾
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/instrument-meter-baselines.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS instrument_meter_baselines (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  baseline_date   DATE NOT NULL COMMENT '基准日（选择到期日期）',
  asset_code      VARCHAR(100) NOT NULL COMMENT '仪器/仪表编码',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY uk_date_code (baseline_date, asset_code),
  INDEX idx_baseline_date (baseline_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='仪器/仪表到期查询基准日';
