-- ============================================
-- 阶段 B1.1：users 表增加 is_super_admin 字段
-- 用于显式标记集团超管，与 company_id 解耦
-- 解决 "company_id IS NULL 即超管" 的安全漏洞
-- 执行方式: mysql -u root -p pdf_print_db < sql/alter-users-add-is-super-admin.sql
-- ============================================

USE pdf_print_db;

-- 1. 加字段：默认 0（普通用户）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_super_admin TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '是否为集团超管（跨租户）。1=是，0=否。默认否。';

-- 2. 索引：加速按超管身份过滤用户列表
CREATE INDEX IF NOT EXISTS idx_users_is_super_admin ON users (is_super_admin);

-- 3. 把现有 admin 账号标记为超管（如果你的超管账号用户名不同，请调整 WHERE 子句）
UPDATE users SET is_super_admin = 1 WHERE username = 'admin';

-- 4. 安全自检：找出"非超管但 company_id 为 NULL"的可疑账号
-- 这一步只是查询，不修改数据，让你人工核对
SELECT id, username, company_id, is_super_admin
FROM users
WHERE is_super_admin = 0 AND (company_id IS NULL OR company_id = 0);

-- 提示：上面查询若返回结果，说明这些用户：
--  - 不是超管（is_super_admin=0）
--  - 又没有 company_id（NULL 或 0）
-- 改造后的登录逻辑会拒绝这些账号登录，直到补全 company_id 或标记为超管
-- 修正方法：
--   UPDATE users SET company_id = <某公司ID> WHERE id = <某用户ID>;
--   或 UPDATE users SET is_super_admin = 1 WHERE id = <某用户ID>;  -- 真的是超管才这样改
