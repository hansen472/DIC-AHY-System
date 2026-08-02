-- ============================================
-- 为所有已存在的非管理员用户默认开启全部功能权限
-- 用途：首次启用权限系统时，避免现有用户因默认拒绝而立刻失去访问权限
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/seed-user-permissions.sql
-- ============================================

USE pdf_print_db;

INSERT INTO user_permissions (username, feature_key, is_allowed)
SELECT u.username, f.feature_key, 1
FROM users u
CROSS JOIN (
  SELECT 'print' AS feature_key
  UNION ALL SELECT 'logs'
  UNION ALL SELECT 'dashboard'
  UNION ALL SELECT 'template_admin'
  UNION ALL SELECT 'operation_logs'
  UNION ALL SELECT 'training_records'
  UNION ALL SELECT 'supplier_qualifications'
  UNION ALL SELECT 'backup_management'
) f
WHERE u.username <> 'admin'
ON DUPLICATE KEY UPDATE is_allowed = 1;
