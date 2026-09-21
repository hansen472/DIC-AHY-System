/**
 * HTML 页面路由：所有 sendFile 路由集中管理
 *
 * 通过工厂函数注入 auth 中间件，返回 Express Router。
 */
const express = require('express');
const path = require('path');

module.exports = function setupPagesRoutes(auth) {
  const router = express.Router();
  const { requireAuthPage, requireAdminPage, requirePermissionPage } = auth;

  // 数据驱动：[路径, 中间件, 文件名]
  const pageRoutes = [
    // 生产记录
    ['/model-print.html',              requirePermissionPage('print'),                    'model-print.html'],
    ['/select-print-record.html',      requirePermissionPage('print'),                    'select-print-record.html'],
    ['/entry-print-record.html',       requirePermissionPage('print'),                    'entry-print-record.html'],
    // 备份管理
    ['/backup-management.html',        requirePermissionPage('backup_management'),        'backup-management.html'],
    // 领值推送
    ['/instrument-meter.html',                  requirePermissionPage('instrument_meter'), 'instrument-meter.html'],
    ['/weekly-overdue-workorder-push.html',     requirePermissionPage('instrument_meter'), 'weekly-overdue-workorder-push.html'],
    ['/daily-overdue-workorder-push.html',      requirePermissionPage('instrument_meter'), 'daily-overdue-workorder-push.html'],
    ['/qc-maintenance-push.html',               requirePermissionPage('instrument_meter'), 'qc-maintenance-push.html'],
    ['/unprocessed-request-push.html',          requirePermissionPage('instrument_meter'), 'unprocessed-request-push.html'],
    ['/new-repair-push.html',                   requirePermissionPage('instrument_meter'), 'new-repair-push.html'],
    ['/new-issue-push.html',                    requirePermissionPage('instrument_meter'), 'new-issue-push.html'],
    ['/push-logs.html',                         requirePermissionPage('instrument_meter'), 'push-logs.html'],
    // COA 报告
    ['/coa-product-data.html',           requirePermissionPage('coa_report'),             'coa-product-data.html'],
    ['/coa-client-data.html',            requirePermissionPage('coa_report'),             'coa-client-data.html'],
    ['/coa-seal-data.html',              requirePermissionPage('coa_report'),             'coa-seal-data.html'],
    ['/coa-report-application.html',     requirePermissionPage('coa_report'),             'coa-report-application.html'],
    ['/deviation-report.html',           requirePermissionPage('coa_report'),             'deviation-report.html'],
    ['/deviation-report-detail.html',    requirePermissionPage('coa_report'),             'deviation-report-detail.html'],
    // 日志
    ['/logs.html',                              requirePermissionPage('logs'),             'logs.html'],
    ['/production-record-print-log.html',       requirePermissionPage('logs'),             'production-record-print-log.html'],
    // 导航页
    ['/nav.html',          requireAuthPage, 'nav.html'],
    ['/nav-cards.html',    requireAuthPage, 'nav-cards.html'],
    ['/nav-list.html',     requireAuthPage, 'nav-list.html'],
    ['/nav-dashboard.html', requireAuthPage, 'nav-dashboard.html'],
    ['/nav-sidebar.html',  requireAuthPage, 'nav-sidebar.html'],
    // 大屏
    ['/daping.html',       requirePermissionPage('dashboard'),      'daping.html'],
    // 模板管理
    ['/template-admin.html', requirePermissionPage('template_admin'), 'template-admin.html'],
    // 权限管理
    ['/permission-admin.html', requireAdminPage, 'permission-admin.html'],
    // 组织管理
    ['/user-management.html',       requireAdminPage, 'user-management.html'],
    ['/company-management.html',    requireAdminPage, 'company-management.html'],
    ['/department-management.html', requireAdminPage, 'department-management.html'],
    // 操作日志
    ['/operation-logs.html', requirePermissionPage('operation_logs'), 'operation-logs.html'],
    // 培训记录
    ['/training-records.html',      requirePermissionPage('training_records'), 'training-records.html'],
    ['/annual-training-plan.html',  requirePermissionPage('training_records'), 'annual-training-plan.html'],
    ['/user-training-record.html',  requirePermissionPage('training_records'), 'user-training-record.html'],
    // 供应商资质
    ['/supplier-qualifications.html',         requirePermissionPage('supplier_qualifications'), 'supplier-qualifications.html'],
    ['/supplier-qualification-logs.html',     requirePermissionPage('supplier_qualifications'), 'supplier-qualification-logs.html'],
    ['/qualification-types.html',             requirePermissionPage('supplier_qualifications'), 'qualification-types.html'],
    ['/suppliers.html',                       requirePermissionPage('supplier_qualifications'), 'suppliers.html'],
    ['/entry-supplier-qualifications.html',   requirePermissionPage('supplier_qualifications'), 'entry-supplier-qualifications.html'],
    ['/product-list.html',                    requirePermissionPage('supplier_qualifications'), 'product-list.html'],
    // 审批流
    ['/workflow-designer.html',      requirePermissionPage('workflow_design'), 'workflow-designer.html'],
    ['/workflow-definitions.html',   requirePermissionPage('workflow_design'), 'workflow-definitions.html'],
    ['/workflow-tasks.html',         requireAuthPage,                          'workflow-tasks.html'],
    // OCR
    ['/ocr-recognize.html',          requirePermissionPage('ocr_recognize'),      'ocr-recognize.html'],
    ['/ocr-template-design.html',    requirePermissionPage('ocr_template_design'), 'ocr-template-design.html'],
  ];

  // 登录页（公开访问）
  router.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'login.html')));
  router.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, '..', 'login.html')));

  // 首页（需认证）
  router.get('/', requireAuthPage, (req, res) => res.sendFile(path.join(__dirname, '..', 'nav-sidebar.html')));

  // 注册所有页面路由
  for (const [route, middleware, file] of pageRoutes) {
    router.get(route, middleware, (req, res) => {
      res.sendFile(path.join(__dirname, '..', file));
    });
  }

  return router;
};
