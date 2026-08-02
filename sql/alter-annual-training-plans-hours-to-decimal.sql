-- ============================================
-- 年度培训计划表培训课时字段恢复为小数
-- 将 training_hours 改回 DECIMAL(5,2)
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-annual-training-plans-hours-to-decimal.sql
-- ============================================

USE pdf_print_db;

ALTER TABLE annual_training_plans
  MODIFY COLUMN training_hours DECIMAL(5,2) NULL COMMENT '培训课时';
