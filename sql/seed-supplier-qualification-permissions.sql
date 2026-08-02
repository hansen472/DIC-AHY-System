-- ============================================
-- 为已存在用户默认开启供应商资质查看权限
-- 编辑权限默认不开启，需管理员单独授权
-- 执行方式: sudo mysql -u root -p pdf_print_db < sql/seed-supplier-qualification-permissions.sql
-- ============================================

USE pdf_print_db;

INSERT INTO user_permissions (username, feature_key, is_allowed)
SELECT u.username, 'supplier_qualifications', 1
FROM users u
WHERE u.username <> 'admin'
ON DUPLICATE KEY UPDATE is_allowed = 1;
