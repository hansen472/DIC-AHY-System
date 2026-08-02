-- ============================================
-- 通用审批流引擎相关表
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/workflow-engine.sql
-- ============================================

USE pdf_print_db;

-- 1. 流程定义表
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '流程定义ID',
  module_key    VARCHAR(50)  NOT NULL COMMENT '绑定业务模块，如 supplier_qualifications',
  name          VARCHAR(200) NOT NULL COMMENT '流程名称',
  version       INT          NOT NULL DEFAULT 1 COMMENT '版本号',
  is_active     TINYINT      NOT NULL DEFAULT 0 COMMENT '是否启用：0 禁用，1 启用',
  `condition`   VARCHAR(500) NULL     COMMENT '触发条件表达式，为空表示默认匹配',
  priority      INT          NOT NULL DEFAULT 0 COMMENT '匹配优先级，数值越大越优先',
  nodes_json    LONGTEXT     NOT NULL COMMENT '节点数组 JSON',
  edges_json    LONGTEXT     NOT NULL COMMENT '连线数组 JSON',
  created_by    VARCHAR(50)  NULL COMMENT '创建人',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_module_active (module_key, is_active),
  KEY idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批流定义表';

-- 2. 流程实例表
CREATE TABLE IF NOT EXISTS workflow_instances (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '流程实例ID',
  definition_id    INT UNSIGNED NOT NULL COMMENT '关联流程定义ID',
  business_key     VARCHAR(200) NOT NULL COMMENT '业务记录标识，如 supplier_qualifications:123',
  status           VARCHAR(50)  NOT NULL DEFAULT 'running' COMMENT 'running/completed/rejected/recalled',
  current_node_ids JSON         NULL COMMENT '当前激活节点ID数组',
  payload_json     LONGTEXT     NULL COMMENT '启动时业务数据快照',
  created_by       VARCHAR(50)  NULL COMMENT '发起人',
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_definition (definition_id),
  KEY idx_business_key (business_key),
  KEY idx_status (status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批流实例表';

-- 3. 当前待办任务表
CREATE TABLE IF NOT EXISTS workflow_tasks (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '任务ID',
  instance_id      INT UNSIGNED NOT NULL COMMENT '关联流程实例ID',
  node_id          VARCHAR(100) NOT NULL COMMENT '节点ID',
  node_name        VARCHAR(200) NULL COMMENT '节点名称快照',
  assignee_username VARCHAR(50) NOT NULL COMMENT '审批人',
  status           VARCHAR(50)  NOT NULL DEFAULT 'pending' COMMENT 'pending/completed/rejected/transferred/cancelled',
  action           VARCHAR(50)  NULL COMMENT 'approve/reject/transfer',
  comment          TEXT         NULL COMMENT '审批意见',
  due_time         DATETIME     NULL COMMENT '截止时间',
  is_reminded      TINYINT      NOT NULL DEFAULT 0 COMMENT '是否已发送超时提醒',
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at     DATETIME     NULL,
  KEY idx_instance_node (instance_id, node_id),
  KEY idx_assignee_status (assignee_username, status),
  KEY idx_due_time (due_time, is_reminded),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批流待办任务表';

-- 4. 审批历史归档表（审计追溯）
CREATE TABLE IF NOT EXISTS workflow_task_history (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '历史ID',
  task_id           INT UNSIGNED NOT NULL COMMENT '原任务ID',
  instance_id       INT UNSIGNED NOT NULL COMMENT '流程实例ID',
  node_id           VARCHAR(100) NOT NULL COMMENT '节点ID',
  node_name         VARCHAR(200) NULL COMMENT '节点名称',
  assignee_username VARCHAR(50)  NOT NULL COMMENT '处理人',
  action            VARCHAR(50)  NOT NULL COMMENT 'approve/reject/transfer/recall/cancel',
  comment           TEXT         NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_task (task_id),
  KEY idx_instance (instance_id),
  KEY idx_assignee (assignee_username),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批流任务历史表';

-- 5. 流程全局变量持久化表
CREATE TABLE IF NOT EXISTS workflow_instance_vars (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '变量ID',
  instance_id  INT UNSIGNED NOT NULL COMMENT '流程实例ID',
  var_name     VARCHAR(100) NOT NULL COMMENT '变量名',
  var_value    LONGTEXT     NULL COMMENT '变量值（JSON字符串）',
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY idx_instance_var (instance_id, var_name),
  KEY idx_instance (instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批流实例变量表';

-- ============================================
-- 迁移：为已存在的 workflow_definitions 表增加条件字段
-- ============================================
ALTER TABLE workflow_definitions
  ADD COLUMN IF NOT EXISTS `condition` VARCHAR(500) NULL COMMENT '触发条件表达式，为空表示默认匹配',
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0 COMMENT '匹配优先级，数值越大越优先';
