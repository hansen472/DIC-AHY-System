-- ============================================
-- 年度培训计划表字段变更
-- 新增 年度(year) 与 是否通知(is_notified) 字段
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-annual-training-plans-add-year-notified.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE annual_training_plans
  ADD COLUMN IF NOT EXISTS `year` INT UNSIGNED NULL COMMENT '年度' AFTER id,
  ADD COLUMN IF NOT EXISTS is_notified TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否通知：1=是，0=否' AFTER tracking;
