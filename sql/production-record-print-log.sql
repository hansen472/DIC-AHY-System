-- ============================================
-- 生产记录打印数据库日志表
-- 记录 model-print.html 页面中每次查询 Make_Task 表的完整日志
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/production-record-print-log.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS production_record_print_log (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  query_time      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '查询时间（时间戳）',
  username        VARCHAR(50)  NOT NULL COMMENT '查询时的当前用户',
  query_condition VARCHAR(255) NOT NULL COMMENT '查询条件（用户输入的单据编号等）',
  query_type      VARCHAR(20)  NOT NULL DEFAULT 'DEFAULT' COMMENT '查询类型（SCRW / DEFAULT）',
  source_table    VARCHAR(100) NOT NULL COMMENT '查询的数据库表名',
  result_count    INT UNSIGNED DEFAULT 0 COMMENT '查询结果条数',
  result_data     LONGTEXT     COMMENT '查询结果（JSON 格式）',
  result_fields   TEXT         COMMENT '查询结果的字段名列表（JSON 数组）',
  field_mapping   TEXT         COMMENT '数据库字段名 → 网页显示字段名的映射关系（JSON 对象）',
  ip_address      VARCHAR(50)  COMMENT '查询时的客户端IP',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  KEY idx_query_time (query_time),
  KEY idx_username (username),
  KEY idx_query_type (query_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='生产记录打印数据库查询日志';
