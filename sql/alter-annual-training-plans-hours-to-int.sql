-- ============================================
-- 年度培训计划表培训课时字段改为整数
-- 将 training_hours 从 DECIMAL(5,2) 改为 INT UNSIGNED
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-annual-training-plans-hours-to-int.sql
-- ============================================

USE pdf_print_db;

-- 先将现有小数课时四舍五入为整数
UPDATE annual_training_plans
SET training_hours = ROUND(training_hours)
WHERE training_hours IS NOT NULL;

-- 修改字段类型为无符号整数
ALTER TABLE annual_training_plans
  MODIFY COLUMN training_hours INT UNSIGNED NULL COMMENT '培训课时';
