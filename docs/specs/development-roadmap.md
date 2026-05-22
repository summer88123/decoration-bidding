# 开发路线图

> 香港建筑及室内设计投标辅助系统 — 分阶段实施计划
> 最后更新：2026-05-22

---

## 开发原则

| 原则 | 说明 |
|------|------|
| **后端先行** | 每个模块先实现并验证 API，再开发前端页面 |
| **垂直切片** | 每个模块一次完成（后端 API + 前端页面 + 集成测试） |
| **MVP 优先** | 核心业务流程先做，AI 功能在核心流程稳定后接入 |
| **接口契约** | 前后端依赖 `shared-types` 中的类型定义，避免口头约定 |

---

## 阶段 0：基础设施就绪 ✅

> 预计时长：1-2 天

### 目标

确保本地开发环境全部服务可以正常启动，数据库 Schema 与代码同步。

### 任务清单

- [x] 复制 `.env.example` 为 `.env`，填写以下必填项
- [x] 启动基础设施容器：`./dev.sh start`
- [x] 执行数据库迁移与客户端生成
- [x] 启动全部服务并验证无报错
- [x] 验证各服务端口可访问（core-service / ai-agent-service / bim-service / web）

### 完成标准

✅ `./dev.sh start` 启动后四个服务均可访问，Health Check 全部返回 200。

---

## 阶段 1：认证模块 ✅

> 预计时长：3-4 天
> 依赖：阶段 0 完成
> **实际完成日期：2026-05-22**

### 后端（`core-service/src/modules/auth`）

- [x] `auth.repository.ts`
  - User CRUD（createUser、findByEmail、findById）
  - RefreshToken / PasswordResetToken CRUD
- [x] `auth.service.ts`
  - `register`：创建用户（含公司创建）
  - `login`：验证密码，颁发 accessToken（15min）+ refreshToken（7d），登录失败计数（Redis）
  - `refreshTokens`：验证 refreshToken，Rotation 机制，颁发新双 Token
  - `logout`：将 refreshToken 加入 Redis 黑名单
  - `forgotPassword`：生成重置 token，发送重置邮件
  - `resetPassword`：验证重置 token，更新密码
- [x] `token.service.ts`：JWT 签发/验证（RS256，开发降级 HS256）+ Redis 黑名单
- [x] `mail.service.ts`：Nodemailer 邮件发送
- [x] `auth.handlers/`
  - `POST /api/auth/register` ✅
  - `POST /api/auth/login` ✅
  - `POST /api/auth/refresh` ✅
  - `POST /api/auth/logout` ✅
  - `POST /api/auth/forgot-password` ✅
  - `POST /api/auth/reset-password` ✅
- [x] 完善 `core-service/src/shared/middleware/auth.ts`：RS256 验证 + requireRole 辅助

### 前端（`apps/web`）

- [x] `src/stores/auth-store.ts`（Zustand，AccessToken 存内存）
- [x] `src/proxy.ts`（Next.js 16 路由保护，检查 `logged_in` cookie）
- [x] `src/lib/api-client.ts`：
  - 请求拦截器：自动附加 `Authorization: Bearer <token>`
  - 响应拦截器：401 时调用 `/api/auth/refresh`，成功后重试；refresh 失败则跳 `/login`
  - 并发防抖（多个 401 只发一次刷新请求）
- [x] `app/(auth)/login/page.tsx`：邮箱 + 密码登录表单
- [x] `app/(auth)/register/page.tsx`：注册表单（公司名、邮箱、密码）
- [x] `app/(auth)/forgot-password/page.tsx`：找回密码表单
- [x] `app/(dashboard)/dashboard/page.tsx`：登录后落地页
- [x] `components/auth-provider.tsx`：页面加载时静默刷新 Token

### 已修复的问题

- CORS credentials 模式：将 `origin: '*'` 改为具体域名 + `credentials: true`
- `@fastify/cookie` 版本：降级至 v8.x（兼容 Fastify 4.x）
- Next.js 16 breaking change：`middleware.ts` → `proxy.ts`
- cross-port cookie：前端改用相对路径，通过 Next.js `rewrites` 代理
- `logged_in` 标记 cookie：解决 `refresh_token` path 限制导致 proxy 无法读取的问题

### 完成标准

✅ 可通过注册→登录→跳转 Dashboard→登出完整流程
✅ 未登录访问受保护路由自动重定向到 `/login`
✅ Token 过期后自动静默刷新，用户无感知

---

## 阶段 2：组织管理模块

> 预计时长：2-3 天
> 依赖：阶段 1 完成（需要认证中间件）

### 后端（`core-service/src/modules/org`）

- [ ] `org.repository.ts`
  - Company：`findByIdOrThrow`、`update`
  - Member：`listByCompany`、`inviteMember`、`updateRole`、`removeMember`
  - Material：`list`（支持分页+搜索）、`create`、`update`、`delete`、批量导入
- [ ] `org.service.ts`
  - 公司信息更新（名称、联系人、资质证书）
  - 成员邀请（发送邀请邮件，生成邀请 token）
  - 成员角色变更（仅 ADMIN 可操作）
  - 物料库 CRUD + Excel 批量导入（解析 xlsx）
- [ ] `org.handlers/`
  - `GET/PUT /api/org/company`
  - `GET /api/org/members`
  - `POST /api/org/members/invite`
  - `PUT /api/org/members/:memberId/role`
  - `DELETE /api/org/members/:memberId`
  - `GET/POST /api/org/materials`
  - `PUT/DELETE /api/org/materials/:materialId`
  - `POST /api/org/materials/import`

### 前端（`apps/web`）

- [ ] `app/(dashboard)/settings/page.tsx`（含三个子 Tab）：
  - **公司资料 Tab**：公司名、联系人、资质证书上传
  - **成员管理 Tab**：成员列表，邀请成员，修改角色，移除成员
  - **物料库 Tab**：物料列表（分页+搜索），新增/编辑/删除，Excel 批量导入

### 完成标准

- ADMIN 可完成公司信息更新
- 可邀请成员并通过邮件链接完成注册
- 物料库支持 Excel 导入并展示导入结果

---

## 阶段 3：招标项目管理

> 预计时长：3-4 天
> 依赖：阶段 2 完成

### 后端（`core-service/src/modules/tender`）

- [ ] `tender.repository.ts`
  - CRUD：`create`、`findById`、`listByCompany`（分页+筛选）、`update`、`delete`
  - 状态流转：`updateStatus`（草稿→发布→截止→归档）
- [ ] `tender.service.ts`
  - 创建招标项目（关联公司、设置截止日期）
  - 文件附件上传（调用 S3/MinIO，复用 `document.service.ts`）
  - 招标搜索与筛选（按状态、金额区间、截止日期）
- [ ] `tender.handlers/`
  - `GET /api/tenders`（列表，支持分页+筛选）
  - `POST /api/tenders`
  - `GET /api/tenders/:id`
  - `PUT /api/tenders/:id`
  - `DELETE /api/tenders/:id`
  - `POST /api/tenders/:id/attachments`（文件上传）
  - `DELETE /api/tenders/:id/attachments/:fileId`

### 前端（`apps/web`）

- [ ] `app/(dashboard)/tenders/page.tsx`：
  - 招标列表（卡片视图），状态筛选，搜索框
  - 创建招标快捷按钮
- [ ] `app/(dashboard)/tenders/new/page.tsx`：
  - 新建招标表单（标题、描述、预算范围、截止日期、附件上传）
- [ ] `app/(dashboard)/tenders/[id]/page.tsx`：
  - 招标详情（基本信息、附件列表、关联投标列表）
  - AI 匹配评分展示区（阶段 5 接入）

### 完成标准

- 可完整创建、编辑、查看招标项目
- 文件上传成功并可下载
- 招标列表支持状态筛选

---

## 阶段 4：投标核心流程（三标）

> 预计时长：5-7 天
> 依赖：阶段 3 完成

### 后端（`core-service/src/modules/bid`）

- [ ] `bid.repository.ts`
  - Bid 主体 CRUD
  - BidCommercial（商务标）：资质文件、公司资料关联
  - BidTechnical（技术标）：章节内容 CRUD、版本记录
  - BidItem（经济标）：`listByBid`、`upsertItem`、`batchUpdate`、`calculateTotal`
- [ ] `bid.service.ts`
  - 创建投标（关联 tender，初始化三标结构）
  - 提交审批流程（状态：草稿→审核中→已批准→已提交）
  - 经济标总价自动计算（单价 × 数量 + 人工费 + 材料费）
- [ ] `bid.handlers/`（在已有 `document.handler.ts` 基础上补全）：
  - `POST /api/tenders/:tenderId/bids`（创建投标）
  - `GET /api/bids/:id`
  - `PUT /api/bids/:id`
  - `POST /api/bids/:id/submit`（提交审批）
  - `GET/POST/PUT /api/bids/:id/items`（经济标条目）
  - `GET/PUT /api/bids/:id/technical`（技术标内容）

### 前端（`apps/web`）

- [ ] `app/(dashboard)/bids/[id]/page.tsx`：
  - BidWorkspace 组件（已有骨架，补全三标 Tab 切换）
  - 商务标 Tab：资质文件上传、公司信息自动填充
  - 技术标 Tab：富文本编辑器，AI 生成入口（阶段 5 接入）
  - 状态栏：当前审批状态、提交按钮
- [ ] `app/(dashboard)/bids/[id]/economic/page.tsx`：
  - BidItemTable 组件完善（行内编辑、自动求和）
  - 从物料库选取材料（弹窗搜索）
  - PdfViewer 集成（预览招标 PDF 对照填写）
- [ ] 完善 `src/components/bid/BidWorkspace.tsx`

### 完成标准

- 可为招标项目创建投标并完整填写三标
- 经济标总价实时计算
- 投标可提交审批并展示状态

---

## 阶段 5：AI 功能接入

> 预计时长：5-7 天
> 依赖：阶段 4 完成

### ai-agent-service

- [ ] 实现以下 7 个缺失的 Skill（`src/skills/`）：
  1. `tender-analyzer`：解析招标文件，提取关键信息（金额、工期、资质要求）
  2. `bid-matcher`：计算公司与招标的匹配评分（0-100 分）
  3. `technical-writer`：根据招标要求生成技术标初稿
  4. `price-estimator`：根据工程量清单估算材料与人工费
  5. `risk-assessor`：识别招标文件中的潜在风险条款
  6. `compliance-checker`：检查投标文件是否符合招标要求
  7. `report-generator`：生成投标分析报告
- [ ] 验证 `src/skills/registry.ts` 中 8 个 Skill 全部注册

### 前端集成

- [ ] 技术标 AI 生成：
  - 点击「AI 生成初稿」→ 调用 `POST /api/ai/technical-draft`
  - WebSocket 接收流式输出，实时展示生成进度
- [ ] 招标匹配评分：
  - 招标详情页展示 AI 评分卡片（匹配度、风险等级、建议）
- [ ] BIM IFC 分析接入：
  - 上传 IFC 文件 → 调用 bim-service → 展示构件清单与工程量

### 完成标准

- AI 技术标生成成功，内容与招标要求相关
- 招标详情页展示匹配评分
- BIM 文件上传后可查看解析结果

---

## 阶段 6：通知与系统完善

> 预计时长：2-3 天
> 依赖：阶段 4 完成

- [ ] 邮件通知完善：
  - 审批结果通知（批准/拒绝）
  - 截止日期提醒（BullMQ 定时任务）
  - 成员被移除通知
- [ ] 状态流转完整性检查（防止跳过步骤直接提交）
- [ ] 导出功能：
  - 经济标导出为 Excel（`xlsx` 库）
  - 投标文件导出为 PDF（`puppeteer` 生成）
- [ ] 错误处理统一：在 `shared-types` 补充 `ErrorCode` 枚举
- [ ] 基础 E2E 测试（关键流程）

### 完成标准

- 审批操作触发邮件通知
- 经济标可导出为 Excel
- ErrorCode 枚举覆盖所有已知错误场景

---

## 模块依赖关系

```
基础设施（阶段0）
    └─► 认证模块（阶段1）
            ├─► JWT 中间件（供后续所有模块使用）
            └─► 组织管理（阶段2）
                    └─► 招标管理（阶段3）
                                └─► 投标流程（阶段4）
                                            └─► AI 功能（阶段5）
                                            └─► 通知完善（阶段6）
```

---

## 当前代码可复用资产

| 文件/模块 | 状态 | 说明 |
|-----------|------|------|
| `core-service/modules/bid/handlers/document.handler.ts` | ✅ 可用 | 文件上传处理逻辑已完整 |
| `core-service/modules/bid/services/document.service.ts` | ✅ 可用 | 文件存储业务逻辑 |
| `core-service/modules/bid/storage/` | ✅ 可用 | S3/本地存储抽象层 |
| `core-service/queues/` | ✅ 可用 | BullMQ 队列定义与 Worker 框架 |
| `core-service/shared/middleware/auth.ts` | ⚠️ 需完善 | JWT 验证骨架，缺少黑名单检查 |
| `web/src/components/bid/` | ✅ 可用 | BidWorkspace 组件骨架已就绪 |
| `web/src/lib/api-client.ts` | ⚠️ 需完善 | 缺少 Token 自动刷新拦截器 |
| `bim-service` | ✅ 完整 | IFC/PDF 解析功能全部完成 |
| `packages/database` | ✅ 完整 | Prisma Schema 已定义所有表结构 |
| `packages/shared-types` | ⚠️ 需补充 | 需添加 `ErrorCode` 枚举 |

---

## 时间估算汇总

| 阶段 | 名称 | 预计时长 | 累计 |
|------|------|----------|------|
| 0 | 基础设施就绪 | 1-2 天 | 1-2 天 |
| 1 | 认证模块 | 3-4 天 | 4-6 天 |
| 2 | 组织管理 | 2-3 天 | 6-9 天 |
| 3 | 招标管理 | 3-4 天 | 9-13 天 |
| 4 | 投标核心流程 | 5-7 天 | 14-20 天 |
| 5 | AI 功能接入 | 5-7 天 | 19-27 天 |
| 6 | 通知与完善 | 2-3 天 | 21-30 天 |

> 以上估算基于单人全时开发，多人并行可适当压缩阶段 3-6 的时长。
