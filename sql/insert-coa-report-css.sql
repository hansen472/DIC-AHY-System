-- 插入"实验室报告申请"专用打印样式到 template_css 表
-- 执行方式：在 MariaDB 中执行
-- 说明：此 CSS 用于 TS-ZL-CP-001 实验室报告申请（COA）打印页面

INSERT INTO template_css (name, css_content, is_active)
VALUES (
  '实验室报告申请',
  '/* ===== TS-ZL-CP-001 实验室报告申请 打印样式 ===== */\n\n/* 页面基础 */\n.page-sheet[data-tpl="tszlcp001"] {\n  width: 210mm;\n  min-height: 297mm;\n  padding: 15mm 12mm;\n  margin: 0 auto;\n  background: #fff;\n  font-family: Arial, "Microsoft YaHei", sans-serif;\n  font-size: 12px;\n  color: #000;\n  page-break-after: always;\n  position: relative;\n}\n\n@media print {\n  .page-sheet[data-tpl="tszlcp001"] {\n    margin: 0;\n    padding: 10mm 10mm;\n    box-shadow: none;\n  }\n}\n\n/* 信息表格 */\n.page-sheet[data-tpl="tszlcp001"] table {\n  border-collapse: collapse;\n}\n\n/* 测试结果表格 */\n.page-sheet[data-tpl="tszlcp001"] table[style*="border-collapse"] td {\n  font-size: 11px;\n  color: black;\n  font-family: Arial, sans-serif;\n  border: 1px solid black;\n  padding: 2px 4px;\n}\n\n/* 签名区域 */\n.page-sheet[data-tpl="tszlcp001"] .coa-footer-sign td {\n  font-size: 12px;\n  padding-top: 5px;\n  border: none;\n}\n',
  1
)
ON DUPLICATE KEY UPDATE
  css_content = VALUES(css_content),
  is_active = 1,
  updated_at = NOW();
