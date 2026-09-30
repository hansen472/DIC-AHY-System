# 审批流增强 + 多租户隔离 + Vue3 SPA 前台改造 实施计划

## 〇、实施进度（2026-09-30 更新）

| 阶段 | 状态 | 备注 |
|---|---|---|
| **A 审批流稳定性加固** | ✅ 完成 | A1 version 列 + A2 乐观锁 + A3 GET_LOCK 集群锁 + A4 单测，详见下文 |
| **B 多租户 company_id 全链路贯通** | 🟡 进行中 | B1/B2/B3/B4 已完成，B5 进行中（本文档更新） |
| **C 引擎节点补课** | ⬜ 待开始 | cc/parallel/timer/form_data_json |
| **D GMP 合规地基** | ⬜ 待开始 | 审计阻断 + 电子签名 |
| **E Vue3 SPA 脚手架** | ⬜ 待开始 | Vite + Element Plus + Pinia |
| **F Vue3 页面分批迁移** | ⬜ 待开始 | 42 页 6 批次 |
| **G CAPA 模块** | ⬜ 待开始 | 依赖 C 阶段节点能力 |
| **H 清理** | ⬜ 待开始 | 旧页面下线 + CSV 文档 |

### A 阶段产出（已完成）

- [sql/alter-workflow-tasks-add-version.sql](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/sql/alter-workflow-tasks-add-version.sql)：`workflow_tasks` 加 `version INT NOT NULL DEFAULT 1` + 索引
- [workflow-engine.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-engine.js)：`completeTask` / `transferTask` 加 `version = version + 1 WHERE version = ?`，影响行数为 0 抛"任务已被他人处理，请刷新后重试"
- `scanOverdueTasks` 用 MySQL `GET_LOCK('workflow_reminder', N)` 包裹，未来多实例部署去重；连接池管理 + 异常释放锁
- [test/workflow-engine.test.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/test/workflow-engine.test.js)：模块加载 + 集群锁 + session 兜底共 9 个测试，零外部依赖（require.cache 注入 mock 池）

### B 阶段产出（B1/B2/B3/B4 已完成）

**B1 session 集成**（修正了 v1 设计漏洞）
- [sql/alter-users-add-is-super-admin.sql](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/sql/alter-users-add-is-super-admin.sql)：users 加 `is_super_admin TINYINT(1)`（独立字段，修复"忘填 company_id 即变超管"漏洞）
- [routes/auth.routes.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/routes/auth.routes.js)：登录 SQL 取 `company_id` + `is_super_admin`；多租户校验（非超管且 company_id 缺失拒登）
- [middleware/auth.middleware.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/middleware/auth.middleware.js)：`createSession(res, username, companyId, isSuperAdmin)` + `getTenantContextFromReq(req)` 返回 `{ isSuperAdmin, companyId }` 二元组

**B2 数据库表变更**
- [sql/alter-workflow-add-company-id.sql](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/sql/alter-workflow-add-company-id.sql)：5 张 workflow 表加 `company_id INT UNSIGNED NULL` + 5 个复合索引
- [sql/backfill-workflow-company-id.sql](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/sql/backfill-workflow-company-id.sql)：回填脚本（按 `instances.created_by → users.company_id` 回填实例，再按 instance_id 回填 tasks/history/vars；definitions 按 created_by 回填）

**B3 引擎查询过滤**（22 个 SQL 查询点全部加 company_id 过滤）
- [workflow-engine.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-engine.js) 顶部新增多租户助手三件套：
  - `normalizeTenantCtx(tenantCtx)`：规范化 + 防呆（非超管无 companyId 抛 `TENANT_CTX_INVALID`）
  - `buildTenantFilter(tenantCtx, alias)`：超管返回空 clause，子公司返回 ` AND (tbl.company_id IS NULL OR tbl.company_id = ?)`
  - `buildTenantInsertValue(tenantCtx)`：超管写 null（全局模板），子公司写 N（私有）
  - `DEFAULT_TENANT_CTX = { isSuperAdmin: true, companyId: null }`：未传 tenantCtx 兜底为超管（向后兼容单测和内部调用）
- 流程定义层 7 方法加 tenantCtx：`getActiveDefinition / createDefinition / updateDefinition / activateDefinition / deleteDefinition / listDefinitions / getDefinition`
- 流程实例层 6 方法加 tenantCtx：`startInstance / advance / createNodeTasks / getInstance / listInstances / getMyInstances / getInstanceHistory / recallInstance / saveInstanceVars`（透传链：startInstance → advance → createNodeTasks；completeTask → getInstance/getDefinition/resolveNodeResult/advance）
- 任务层 9 方法加 tenantCtx：`getTask / completeTask / resolveNodeResult / transferTask / getTasksByAssignee / getAllPendingTasks / getParticipatedTasks / getPendingTaskCount / getTasksByInstance`
- 关键代码模式（completeTask 乐观锁 + company_id 过滤共存）：
  ```js
  UPDATE workflow_tasks SET status=?, action=?, comment=?, completed_at=?, version=version+1
  WHERE id=? AND version=?${tfTask.clause}
  ```
- INSERT 写入时正确设置 company_id（超管 null=全局模板，子公司 N=私有）；`workflow_task_history` INSERT SELECT 从 `workflow_tasks.company_id` 取值，保证审计完整性

**B4 路由层贯通**（已在 B3 一并完成）
- [workflow-routes.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-routes.js)：函数签名扩展 `{ requireAuth, requirePermission, getUsername, getTenantContext }`，23 个路由全部传 `getTenantContext(req)`
- [server.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/server.js)：单点注入 `getTenantContext: auth.getTenantContextFromReq`
- [routes/deviation.routes.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/routes/deviation.routes.js)：4 个 engine 调用 + 1 处直接 SQL 都加 tenantCtx（业务路由直接调 engine 方法的越权漏洞已修复）

**B3 测试结果**：20/20 通过
- 集群锁 + session 兜底：9 个
- 流程定义层越权防护：7 个（test10-test16）
- 流程实例层越权防护：4 个（test17-test20）

**B5 待办**
- 任务层关键方法（completeTask / recallInstance / transferTask）越权防护单测尚缺（目前 20 个测试主要覆盖 listInstances/getInstance/startInstance/getInstanceHistory，任务层仅靠 SQL 审查保证）
- 计划文档进度更新（本文档）

---

## 一、Repository Research（现状结论）

### 技术栈与结构
- 后端：Node.js + Express（[server.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/server.js)），MySQL（本地库 `pdf_print_db` + MIC 库），鉴权用内存 sessions Map + sid Cookie。
- 前端：**42 个多页面 HTML**（根目录），页面路由集中在 [routes/pages.routes.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/routes/pages.routes.js)，导航壳为 [nav-sidebar.html](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/nav-sidebar.html)。尚无 `frontend/` 目录。
- 会话结构：`sessions.set(sid, { username, createdAt })`（[auth.middleware.js:155](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/middleware/auth.middleware.js#L155)）。登录 SQL（[routes/auth.routes.js:28](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/routes/auth.routes.js#L28)）只查 id/username/password_hash/status，**未取 company_id**。

### 审批流现状
- 引擎 [workflow-engine.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-engine.js)（约 1164 行）+ 路由 [workflow-routes.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-routes.js)（23 个接口）。
- 5 张表（[sql/workflow-engine.sql](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/sql/workflow-engine.sql)）：`workflow_definitions / workflow_instances / workflow_tasks / workflow_task_history / workflow_instance_vars`，**全部无 company_id**；`workflow_tasks` **无版本号**（无乐观锁）。
- 节点类型仅 4 种：`start / approval / condition / end`；会签支持 all/any/ratio；条件用自研白名单表达式解析器。
- 已用 `beginTransaction` + `FOR UPDATE` 行锁；超时为单进程 `setInterval`；核心路径无单元测试。
- 业务接入方：deviation（偏差）、organization（组织变更）、supplier 等路由。

### 多租户基础（半成品）
- `users.company_id` 字段已存在（[sql/alter-users-add-company.sql](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/sql/alter-users-add-company.sql)），`companies`、`departments.company_id` 已存在。
- 但 company_id **未进入 session、未进入 workflow 表、查询不带租户过滤**。
- 部署模式决策：**统一部署 + 应用层软隔离**（不按子公司独立部署）。

### GMP 基础
- 有 [operation_logs](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/sql/operation-logs.sql) 审计雏形，但 [log.service.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/services/log.service.js) 写入失败被静默 catch；无电子签名；无 CAPA 模块。

### 选型结论（已与需求方确认）
- **不引入 Flowable**：各子公司独立使用、不混合审批、统一部署软隔离；自研引擎在补全节点/加固后可覆盖需求，且体量小、迭代快、无 JVM 双系统维护负担。
- 设计器未来用 **bpmn-js 混合模式**（画图用 bpmn-js，存储仍用自研 JSON，引擎不解析 BPMN XML）。

## 二、总体顺序与依赖关系

```
阶段 A 审批流稳定性加固（无业务破坏，先做）
   ↓
阶段 B 多租户 company_id 全链路贯通（数据/接口契约定型）
   ↓
阶段 C 引擎节点补课 + 表单数据（cc / parallel / timer / form_data_json）
   ↓
阶段 D GMP 合规地基（审计追踪强化 + 电子签名）
   ↓
阶段 E Vue3 SPA 共存脚手架 + 导航壳（可与 B/C/D 后期并行启动）
   ↓
阶段 F Vue3 页面分批迁移（含 workflow-designer 迁移时落地 bpmn-js）
   ↓
阶段 G CAPA 业务模块（依赖 C 的 timer/cc/表单）
   ↓
阶段 H 旧页面下线与清理
```

**核心原则**：数据层与接口契约定型（A~D）在前，Vue3 页面迁移（F）在后，避免前台对接旧契约后返工。bpmn-js 随设计器页面迁移一次性落地，不在旧 HTML 画布上提前做。

## 三、Files and Modules（按阶段）

### 阶段 A 稳定性加固 ✅ 已完成
- `sql/workflow-engine.sql` + 新增 `sql/alter-workflow-tasks-add-version.sql`：`workflow_tasks` 加 `version INT NOT NULL DEFAULT 1`。
- [workflow-engine.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-engine.js)：complete/transfer/withdraw 的 UPDATE 增加 `AND version=?`，成功后 `version=version+1`；影响行数为 0 时返回并发冲突错误。
- [workflow-engine.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-engine.js) 定时器：用 MySQL `GET_LOCK('workflow_reminder', N)` 包裹定时扫描，避免未来多实例重复触发。
- 新增 `test/workflow-engine.test.js`：start/approve/reject/会签三模式/并发 complete 冲突等核心用例（用现有测试框架；若无则在 package.json 增加 node:test，不引重依赖）。

### 阶段 B 多租户隔离 🟡 B1/B2/B3/B4 完成，B5 进行中
- [routes/auth.routes.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/routes/auth.routes.js)：登录 SQL 增加 `company_id`；调用 `createSession(res, username, companyId)`。
- [middleware/auth.middleware.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/middleware/auth.middleware.js)：session 结构增加 `companyId`；导出 `getCompanyId(req)`。规则：`companyId` 为 null = 集团超管，不加租户过滤。
- 新增 `sql/alter-workflow-add-company.sql`：5 张 workflow 表加 `company_id INT UNSIGNED NULL` + 索引；数据回填脚本（按 `workflow_instances.created_by → users.company_id` 回填实例，再按 instance_id 回填 tasks/history/vars；definitions 按 created_by 回填）。
- [workflow-engine.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-engine.js) + [workflow-routes.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-routes.js)：所有读写 SQL 增加租户条件 `AND (? IS NULL OR company_id = ?)`；创建定义/实例时写入 company_id。
- 新增统一辅助 `services/tenant.service.js`：`tenantWhere(req)` 返回片段与参数；`assertSameCompany(row, req)` 用于 `:id` 类接口的越权校验（实例详情、任务完成、历史查询）。
- [workflow-engine.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-engine.js) `resolveAssignee`：`[部门经理]` 解析加 company_id 边界。
- 前端（旧 HTML 临时最小改动）：导航栏显示当前公司名；超管可见公司切换（写 session `viewAsCompanyId`，作为可选项，非首期必需）。

### 阶段 C 引擎节点补课 ⬜ 待开始
- [workflow-engine.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-engine.js)：新增节点类型
  - `cc`：生成只读知会记录（不入审批链，可复用 history 表或新增 `workflow_cc` 表，二选一，倾向新增表语义清晰）。
  - `parallel`：fork 生成多分支待办、join 等所有分支完成才前进（配合 `current_node_ids` JSON）。
  - `timer`：到期由（已加 GET_LOCK 的）定时扫描生成下一节点任务，支撑 CAPA 有效性核查。
- 表单数据：`workflow_tasks` 加 `form_data_json LONGTEXT NULL`；引擎 complete 时接收并校验/落库。
- 节点先在现有自研画布 [workflow-designer.html](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/workflow-designer.html) 上用简单图形+配置弹窗落地，保证功能闭环，不追求可视化体验。

### 阶段 D GMP 合规地基 ⬜ 待开始
- [services/log.service.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/log.service.js)：审计写入失败改为**阻断业务**（抛错回滚），不再静默 catch；`operation_logs` 结构化 before/after/reason（新增列或 detail JSON 规范化）；应用层只 INSERT，并输出数据库账号权限收敛说明。
- 新增电子签名能力：审批/关键操作提交时二次输密码，记录签名含义（批准/复核）、与业务记录绑定；新增 `electronic_signatures` 表（记录 id、业务对象、签名人、含义、时间、凭证哈希）。
- NTP 时间同步检查脚本/说明（审计可信前提）。
- 不做 CAPA 模块本身（列入阶段 G）；本阶段只交付可复用的合规能力。

### 阶段 E Vue3 SPA 共存脚手架 ⬜ 待开始
- 新建 `frontend/`：Vite + Vue3 + TypeScript（JS 亦可，保持团队门槛低，建议 TS 但不强制）+ Element Plus + Vue Router（history，base `/app/`）+ Pinia + axios。
- `frontend/vite.config.js`：dev 代理 `/api`、`/login`、`/login.html`、`/nav-sidebar.html` 到 `http://localhost:3456`。
- [server.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/server.js)：静态托管 `frontend/dist` 于 `/app`，加 `/app/*` catch-all 返回 index.html（避开现有 `/*.html`）。
- 新增 `GET /api/auth/me`：返回 username、companyId、companyName、权限列表，供路由守卫与导航渲染。
- `frontend/src/`：MainLayout（侧边栏+顶栏，迁移 nav-sidebar 结构）、axios 401 拦截跳登录、路由守卫按 `meta.perm` 鉴权。共存期登录仍用现有 `login.html`。

### 阶段 F Vue3 页面分批迁移（42 页）⬜ 待开始
建议批次（每批独立可上线，迁一页删一页路由与 HTML）：
1. 导航壳 + 登录态对接（MainLayout、auth/me）。
2. 基础数据/列表表单类：公司、部门、用户、权限、供应商、产品、培训记录。
3. 业务记录类：COA、打印记录、模板管理、仪器仪表、推送类页面。
4. **审批流三页**：workflow-tasks、workflow-definitions、workflow-designer。
   - designer 迁移时落地 **bpmn-js 混合模式**：npm 引入 bpmn-js，moddle 扩展存自研属性（assignees/mode/expression），编写“bpmn 元素 ↔ 自研 nodes_json/edges_json”双向转换器；引擎零改动。
5. 复杂页放最后：daping（大屏）、ocr-*、template-admin。
6. 登录页最后迁移，迁移完成后移除旧 login.html 与共存重定向。
- [routes/pages.routes.js](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/routes/pages.routes.js)：每批迁移同步移除旧 HTML 路由并更新 [nav-sidebar.html](file:///c:/Users/Administrator/Documents/GitHub/DIC-AHY-System/nav-sidebar.html) 链接（切到 `/app/...`）。

### 阶段 G CAPA 模块 ⬜ 待开始
- 新增 CAPA 表与页面（发起/调查 RCA/纠正措施/有效性核查/关闭），复用阶段 C 的 timer（核查到期自动生成任务）、cc（措施知会）、form_data_json（RCA 记录），与 deviation 模块通过 business_key 联动。

### 阶段 H 清理 ⬜ 待开始
- 下线旧自研画布、旧 HTML 与对应路由；旧 workflow 表字段在稳定运行一个保留期后归档；补 CSV 验证文档模板（URS/IQ/OQ/PQ）。

## 四、Implementation Steps（执行步骤，依赖序）

1. 阶段 A：加 version 列迁移脚本 → 改引擎并发 UPDATE → 加 GET_LOCK → 写核心单元测试并跑通。
2. 阶段 B：登录 SQL + createSession 带 companyId → 5 表加列与索引 → 回填脚本（先备份）→ tenant.service 辅助 → 改造引擎与 23 个路由的 SQL → resolveAssignee 加边界 → 越权用例验证。
3. 阶段 C：form_data_json → cc 节点 → parallel fork/join → timer 节点（复用 GET_LOCK 扫描）→ 在旧画布补节点配置入口 → 引擎用例补齐。
4. 阶段 D：审计阻断式写入 + 结构化字段 → electronic_signatures 表与二次认证中间件 → 关键审批接口接入签名。
5. 阶段 E：初始化 frontend 工程 → 代理与 /app 托管 → /api/auth/me → MainLayout + 守卫跑通一个示例页。
6. 阶段 F：按 6 个批次逐页迁移；第 4 批落地 bpmn-js 混合模式与转换器；每批回归旧业务并清理旧路由。
7. 阶段 G：CAPA 模块开发并接入偏差联动。
8. 阶段 H：旧资源下线、归档、CSV 文档。

## 五、Dependencies and Considerations
- **契约冻结点**：阶段 B 完成后，workflow 23 个接口的多租户行为即定型；Vue3 审批页必须在此之后迁移。
- **超管语义**：`company_id IS NULL` 表示集团超管，所有 SQL 用 `(? IS NULL OR company_id = ?)`；禁止硬编码绕过。
- **回填安全**：阶段 B 回填前必须全量备份；回填后核对无归属（company_id 仍为 NULL）的业务数据并人工确认。
- **并发兼容**：乐观锁上线后，前端（含未来 Vue 端）complete 失败需提示“任务已被他人处理”而非报错。
- **并行网关**：若阶段 C 发现旧自研画布无法表达 fork/join 配对交互，可将 bpmn-js 提前到阶段 C（这是唯一允许提前的例外）。
- **不合并部署形态**：本计划面向“统一部署+软隔离”；若未来出现必须独立部署的子公司，另用定时 ETL 回流，不在本计划范围。
- **GMP 与引擎无关**：审计追踪/电子签名为应用层能力，自研与 Flowable 均需自建，不构成换引擎理由。
- **企业微信推送等旁路模块**（notifier 系列）与本计划解耦，不阻塞。

## 六、Validation
- 每个迁移 SQL 在测试库执行并验证回滚预案；回填后用对账 SQL 核对各 company 数据条数。
- 单元测试：乐观锁并发冲突、三模式会签、cc/parallel/timer 行为、表达式解析。
- 多租户渗透用例：A 公司用户携带 B 公司 instance_id/task_id 访问，必须 403/404；超管可跨公司查询。
- 审计验证：制造审计写入失败（如断库/拒权）时业务必须回滚；电子签名错误密码不得完成审批。
- Vue 每批：新旧页面同一账号、同一公司下数据一致；`/app` 刷新不 404；未登录与无权限跳转正确。
- bpmn-js：自研 JSON 往返（画图→保存→重新加载）节点/连线/属性零丢失；引擎仍可正常驱动该流程。
- 全部完成后：`node --check` 全量 JS、前端 `npm run build` 通过、核心接口回归清单走查。

## 七、Risks
- **回填导致老数据“无归属”被过滤**：先备份+回填对账脚本+人工确认 NULL 数据，再启用强制过滤。
- **多租户 SQL 漏改导致越权**：统一走 tenant.service，code review 逐接口核对，配越权测试用例。
- **乐观锁误伤正常审批**：先在测试库模拟并发；前端友好提示并可重新拉取任务。
- **parallel/timer 引入状态机复杂度**：current_node_ids 状态变更必须在同一事务内；补状态流转测试。
- **新旧前端长期双轨**：严格按批迁移并及时删旧路由，控制共存窗口。
- **bpmn-js 转换器与引擎语义偏差**：以现有 nodes_json/edges_json 为唯一事实来源，bpmn-js 仅作视图层；往返测试兜底。
- **范围蔓延**：Flowable 迁移、独立部署 ETL、CAPA 深化均为显式红线触发项，未触发不并入本计划。
