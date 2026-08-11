-- ============================================
-- 为 templates 表添加 css_id 字段
-- 每个模板可单独选择使用的 CSS 样式
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/alter-templates-add-css-id.sql
-- ============================================

USE pdf_print_db;

-- 1. 添加 css_id 列（允许 NULL，NULL 表示未指定）
ALTER TABLE templates
  ADD COLUMN css_id INT UNSIGNED NULL COMMENT '使用的 CSS 样式 ID' AFTER current_version_id;

-- 2. 添加外键约束（删除 CSS 时自动清空引用）
ALTER TABLE templates
  ADD CONSTRAINT fk_template_css FOREIGN KEY (css_id) REFERENCES template_css(id) ON DELETE SET NULL;

-- 3. 将所有现有模板默认指向 "default" 样式
UPDATE templates t
  JOIN template_css c ON c.name = 'default'
  SET t.css_id = c.id;

-- 4. 将 tszlcp001 模板指向 "实验室报告申请" 样式
UPDATE templates t
  JOIN template_css c ON c.name = '实验室报告申请'
  SET t.css_id = c.id
  WHERE t.template_key = 'tszlcp001';
