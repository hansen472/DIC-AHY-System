-- ============================================
-- 阶段 C2：workflow_cc 知会记录表
-- 执行方式: mysql -u root -p pdf_print_db < sql/alter-workflow-add-cc-table.sql
--
-- 背景：cc 节点为"只读知会"，不入审批链、不阻塞流程前进，
-- 仅记录"谁、何时、被知会、关于哪个流程实例、什么内容、是否已读"。
-- 用于：审批结果知会、措施落实告知、CAPA 整改通知等场景。
--
-- 设计：新增独立表 workflow_cc（不复用 workflow_task_history，语义清晰）
--   - company_id 多租户隔离（与 workflow_tasks 同口径）
--   - read_at 标记已读（NULL=未读）
--   - 关联 instance_id（不冗余 task_id，cc 节点不创建任务）
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS workflow_cc (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  instance_id BIGINT UNSIGNED NOT NULL COMMENT '关联的流程实例',
  node_id VARCHAR(100) NOT NULL COMMENT '产生知会的 cc 节点 id',
  node_name VARCHAR(200) NULL COMMENT '节点名称',
  receiver_username VARCHAR(100) NOT NULL COMMENT '被知会人',
  message TEXT NULL COMMENT '知会内容（如审批结论、措施说明）',
  read_at DATETIME NULL COMMENT '已读时间，NULL 表示未读',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  company_id INT UNSIGNED NULL COMMENT '多租户隔离：NULL=全局模板，N=子公司私有',
  PRIMARY KEY (id),
  KEY idx_cc_instance (instance_id),
  KEY idx_cc_receiver (receiver_username, read_at),
  KEY idx_cc_company (company_id, instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作流知会记录（cc 节点产物）';

-- 验证：
-- SHOW CREATE TABLE workflow_cc;
-- DESC workflow_cc;
