-- ============================================
-- 阶段 C4：workflow_timers 定时器表
-- 执行方式: mysql -u root -p pdf_print_db < sql/alter-workflow-add-timer-table.sql
--
-- 背景：timer 节点用于"到期推进流程"场景：
--   1. CAPA 有效性核查：纠正措施落实后，需 N 天后由 QA 复核有效性
--   2. 培训复训到期提醒：员工某证书 N 天后到期需复训
--   3. 偏差跟踪：临时控制措施 N 天后必须给出永久措施
--
-- 设计：独立表，记录"哪个实例的哪个节点要何时被触发"
--   - fire_at DATETIME：到点时间，由 timer 节点 config.duration 计算
--   - processed_at DATETIME NULL：扫描器处理后写入，防重复触发
--   - company_id 多租户隔离（与 workflow_tasks 同口径）
--
-- 与 scanOverdueTasks 一致：扫描器用 MySQL GET_LOCK('workflow_timer_scan', N)
-- 防止集群多实例重复处理
-- ============================================

USE pdf_print_db;

CREATE TABLE IF NOT EXISTS workflow_timers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  instance_id BIGINT UNSIGNED NOT NULL COMMENT '关联的流程实例',
  node_id VARCHAR(100) NOT NULL COMMENT '触发 timer 节点 id',
  node_name VARCHAR(200) NULL COMMENT '节点名称',
  fire_at DATETIME NOT NULL COMMENT '到点时间，到期后由扫描器触发推进',
  processed_at DATETIME NULL COMMENT '已处理时间，NULL=待处理',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  company_id INT UNSIGNED NULL COMMENT '多租户隔离：NULL=全局，N=子公司私有',
  PRIMARY KEY (id),
  KEY idx_timer_pending (processed_at, fire_at),
  KEY idx_timer_instance (instance_id, node_id),
  KEY idx_timer_company (company_id, processed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工作流定时器记录（timer 节点产物）';

-- 验证：
-- SHOW CREATE TABLE workflow_timers;
-- DESC workflow_timers;
