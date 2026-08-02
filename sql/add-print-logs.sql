-- ============================================
-- 打印日志表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/add-print-logs.sql
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS print_logs (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  username      VARCHAR(50)  NOT NULL COMMENT '操作用户',
  querydata     VARCHAR(100) NOT NULL COMMENT '查询单据编号',
  selected_pici TEXT         NOT NULL COMMENT '选中的批次号(JSON数组)',
  templates     TEXT         NOT NULL COMMENT '使用的模板及份数(JSON数组)',
  ip_address    VARCHAR(45)  NULL COMMENT '请求IP地址',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '打印时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='打印操作日志表';
