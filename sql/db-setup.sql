-- ============================================
-- MariaDB / MySQL 数据库初始化脚本
-- 数据库: pdf_print_db
-- 表: users（用户认证表）
-- ============================================

-- 1. 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS pdf_print_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pdf_print_db;

-- 2. 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY COMMENT '主键ID',
  username    VARCHAR(50)  NOT NULL UNIQUE COMMENT '用户名',
  password_hash VARCHAR(64) NOT NULL COMMENT 'SHA256 密码哈希（hex）',
  status      TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '账号状态: 1=启用, 0=禁用',
  chinese_name   VARCHAR(50)  NULL COMMENT '中文名',
  department     VARCHAR(100) NULL COMMENT '部门',
  direct_manager VARCHAR(50)  NULL COMMENT '直接上级',
  email          VARCHAR(100) NULL COMMENT 'Email',
  position       VARCHAR(100) NULL COMMENT '岗位',
  hire_date      DATE         NULL COMMENT '入职日期',
  last_login  DATETIME     NULL COMMENT '上次登录时间',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系统用户表';

-- 3. 插入默认管理员账号
-- 密码: admin123
-- SHA256(admin123) = 240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9
INSERT INTO users (username, password_hash, status, last_login)
VALUES ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 1, NULL)
ON DUPLICATE KEY UPDATE username = username;
