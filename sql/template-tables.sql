-- ============================================
-- 模板版本管理表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/template-tables.sql
-- ============================================

USE pdf_print_db;

-- 全局打印样式（对应原 print-style.css）
CREATE TABLE IF NOT EXISTS template_css (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  name        VARCHAR(50)  NOT NULL DEFAULT 'default' COMMENT '样式名称',
  css_content LONGTEXT     NOT NULL COMMENT 'CSS 内容',
  is_active   TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '是否启用: 1=启用, 0=禁用',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全局打印样式表';

-- 模板定义表
CREATE TABLE IF NOT EXISTS templates (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  template_key         VARCHAR(50)  NOT NULL COMMENT '模板标识，如 batchrecord/cover',
  render_function_name VARCHAR(100) NOT NULL COMMENT '渲染函数名，如 renderBatchRecord',
  name                 VARCHAR(100) NOT NULL COMMENT '模板显示名称',
  description          VARCHAR(255) NULL COMMENT '模板说明',
  sort_order           INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '排序序号',
  is_active            TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '是否启用: 1=启用, 0=禁用',
  current_version_id   INT UNSIGNED NULL COMMENT '当前生效版本ID',
  created_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at           DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_template_key (template_key),
  KEY idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='打印模板定义表';

-- 模板版本表
CREATE TABLE IF NOT EXISTS template_versions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  template_id INT UNSIGNED NOT NULL COMMENT '所属模板ID',
  version     VARCHAR(20)  NOT NULL COMMENT '版本号，如 1.0.0',
  js_code     LONGTEXT     NOT NULL COMMENT '渲染函数 JS 代码',
  reason      VARCHAR(255) NULL COMMENT '修改原因',
  remarks     TEXT         NULL COMMENT '备注',
  is_active   TINYINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '是否生效: 1=生效, 0=历史',
  created_by  VARCHAR(50)  NULL COMMENT '创建人',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  UNIQUE KEY uk_template_version (template_id, version),
  KEY idx_active (template_id, is_active),
  CONSTRAINT fk_version_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='打印模板版本表';
