# 原型 vs 实现 — 数据层差异记录

> 最后更新：2026-05-28

本文档记录原型设计中展示的功能/字段，但当前数据模型或 API 尚不支持的部分。
纯 UI 样式差异不在此列，请查看源代码注释。

**原型文件位置：** `docs/prototype/screens/`
**用户故事位置：** `docs/story/`

---

## 零、本次 tenders 页对比更新记录（2026-05-28）

### 0.1 已完成的 UI 对齐（纯前端）

| 改动 | 文件 | 说明 |
|------|------|------|
| 表头颜色 `text-fg` → `text-muted` | `tenders/page.tsx` | 与原型表头样式一致 |
| "操作"列改为右对齐 | `tenders/page.tsx` | 原型中操作列右对齐 |
| 预算格式缩写（M/K） | `tenders/page.tsx` | 原型显示 `HK$3.2M` 而非完整数字 |
| 紧急截标阈值 14天 → 7天 | `tenders/page.tsx` | 与原型逻辑一致 |
| 排序改为切换按钮 | `tenders/page.tsx` | 原型为"截标日期↑↓"切换按钮，而非 select |
| 记录数移至表格外侧 | `tenders/page.tsx` | 原型中 footer 在表格外部 |
| 信息卡标题 "基本信息" → "项目信息" | `tenders/[id]/page.tsx` | 原型卡片标题为"项目信息" |
| 信息网格 2列 → 3列，字段顺序调整 | `tenders/[id]/page.tsx` | 原型为3列：截标日期/预算/来源/地点/业主/AI评分 |
| 标签页"文件"→"招标文件"，"投标方案"→"投标版本" | `tenders/[id]/page.tsx` | 与原型标签名称一致 |
| 页面标题区域增加"决定投标"按钮（PENDING状态） | `tenders/[id]/page.tsx` | 原型在标题右侧有编辑+决定投标两个按钮 |
| 状态流转步骤标签调整 | `tenders/[id]/page.tsx` | 与原型显示"决定投标 → 投标中"等复合标签一致 |

### 0.2 需要后端支持的差异（未实现）

| 功能/字段 | 原型来源 | 所需变更 | 优先级 |
|-----------|----------|----------|--------|
| `notes`/备注字段 | `tender-detail.html` 信息卡底部有备注区块 | `TenderProject` 新增 `notes String?` 字段 + API | 中 |
| 信息卡3列显示"负责人" | `tender-detail.html`：info-grid 第6格显示负责人姓名 | `assigneeId` 外键 + 关联用户表查询（见下方第一节） | 中 |
| 招标文件列表（多文件） | `tender-detail.html`：文件行显示图标/名称/大小/日期/下载按钮 | 需 `TenderDocument` 表（见下方第三节） | 高 |
| 文件类型图标（PDF/DWG等） | 文件行左侧有颜色化文件类型图标 | 依赖 `TenderDocument.fileType` 字段 | 低 |

---

## 一、Tender（招标项目）模型差异

| 字段/功能 | 原型需求（见 `tender-detail.html`） | 当前状态 | 优先级 |
|-----------|----------|----------|--------|
| `assigneeId` 负责人 | 每个招标有指定负责人（显示姓名） | ❌ Schema 无此字段 | 中 |
| `documents[]` 多文件 | 文件列表：类型/大小/上传时间/文件名 | ❌ 仅 `rawDocumentUrl`（单字符串） | 高 |
| `history[]` 操作记录 | 时间线：操作人+时间+事件描述 | ❌ 无审计日志表 | 低 |
| 状态枚举标准化 | 用户故事用大写 `PENDING/DECIDED/BIDDING`... | ⚠️ Schema 用小写 string，未用 enum | 中 |
| `winRate` 中标率 | Dashboard 统计卡片，需聚合计算 | ⚠️ 前端自行计算（加载最多200条），非服务端聚合 | 中 |
| 状态统计接口 | `GET /api/tenders/stats`（按状态分组计数） | ❌ 无此端点，前端 workaround 见 dashboard/page.tsx | 中 |

## 二、Bid（投标）模型差异

**对照文件：** `docs/prototype/screens/bid-workspace.html` · `docs/story/04-bid.md`

### 2.1 Bid 主体字段差异

| 字段/功能 | 用户故事需求 | 当前 Schema | 优先级 |
|-----------|-------------|-------------|--------|
| `name` 投标方案名 | 创建时填写版本名（如"A 方案"） | ❌ 无此字段（Schema 无 name） | 高 |
| `companyId` 公司关联 | Bid 需关联 companyId（权限隔离） | ❌ 无此字段 | 高 |
| `currency` 货币 | 默认 HKD，可修改 | ❌ 无此字段 | 低 |
| `status` 枚举 | `DRAFT/IN_REVIEW/APPROVED/SUBMITTED/WON/LOST` | ⚠️ 用 String，默认 `"draft"`，非标准枚举 | 高 |
| `submittedAt` 提交时间 | 提交业主时记录 | ❌ 无此字段 | 低 |

### 2.2 BidCommercial（商务标）— 完全缺失

用户故事 US-BID-COMM-01/02/03 及原型 `bid-workspace.html` 商务标 Tab 需要：

```prisma
// 需新增
model BidCommercial {
  id             String   @id @default(cuid())
  bidId          String   @unique
  companyName    String?
  registrationNo String?
  licenses       Json     @default("[]")   // 资质证书列表
  keyPersonnel   Json     @default("[]")   // 关键人员列表
  pastProjects   Json     @default("[]")   // 业绩案例列表
  companyProfile String?
  updatedAt      DateTime @updatedAt
  bid            Bid @relation(fields: [bidId], references: [id])
}
```

**影响：** `bid.repository.ts` / `bid.service.ts` 需新增商务标 CRUD；
API：`GET/PATCH /api/bids/:id/commercial`

### 2.3 BidTechnical（技术标）— 完全缺失

用户故事 US-BID-TECH-01/02/03 及原型 `bid-workspace.html` 技术标 Tab 需要：

```prisma
// 需新增
model BidTechnical {
  id                 String   @id @default(cuid())
  bidId              String   @unique
  constructionMethod String?
  siteManagement     String?
  safetyMeasures     String?
  qualityControl     String?
  durationDays       Int?
  milestonePlan      Json     @default("[]")   // 里程碑节点列表
  updatedAt          DateTime @updatedAt
  bid                Bid @relation(fields: [bidId], references: [id])
}
```

**影响：** `bid.repository.ts` / `bid.service.ts` 需新增技术标 CRUD；
API：`GET/PATCH /api/bids/:id/technical`

### 2.4 BidItem（经济标明细）字段差异

| 字段 | 原型/用户故事需求 | 当前 Schema | 优先级 |
|------|-----------------|-------------|--------|
| `itemCode` 编号 | US-BID-ECON-02 需要序号/编号 | ❌ 无此字段 | 高 |
| `isManualPrice` 手动定价标记 | US-BID-ECON-03：手动覆盖后标记 | ❌ 无此字段 | 高 |
| `drawingPage` 图纸页码 | 与图纸高亮联动（String 类型） | ⚠️ 当前为 `Int?`，用户故事为 String | 中 |
| `ifcElementId` IFC 构件 ID | BIM 服务自动提取工程量 | ✅ 已有 | — |

### 2.5 BidStatusLog（审批记录）— 完全缺失

用户故事 US-BID-03 需要审批历史记录：

```prisma
// 需新增
model BidStatusLog {
  id         String   @id @default(cuid())
  bidId      String
  fromStatus String?
  toStatus   String
  operatorId String
  comment    String?
  createdAt  DateTime @default(now())
  bid        Bid @relation(fields: [bidId], references: [id])
  @@index([bidId])
}
```

### 2.6 经济标功能差异（前端）

| 功能 | 原型需求（`bid-economic.html`） | 当前状态 |
|------|-------------------------------|---------|
| 统一利润率设定 | 顶部利润率输入框，自动重算所有行 `sellPrice` | ❌ 前端未实现 |
| 总成本/总报价/综合利润率 | 实时汇总展示 | ❌ 前端未实现 |
| 从物料库选取 | 弹窗搜索物料，自动填入 `costPrice` | ❌ 未实现 |
| 左右分屏布局 | 左侧清单 + 右侧图纸/BIM 查看器 | ❌ 未实现（仅后端骨架） |
| 行内编辑 | 清单行可直接点击编辑 | ❌ 未实现 |
| 拖拽排序 | 通过拖拽调整明细排序 | ❌ 未实现 |

## 三、TenderDocument（招标文件）模型差异

当前使用 `TenderProject.rawDocumentUrl`（单字符串），原型需要完整的文件管理功能：

**目标模型（需新增 `TenderDocument` 表）：**
```prisma
model TenderDocument {
  id           String   @id @default(cuid())
  tenderId     String
  filename     String
  fileUrl      String
  fileType     String   // PDF | DOCX | DWG | XLSX | OTHER
  fileSize     Int?     // bytes
  uploadedAt   DateTime @default(now())
  uploadedBy   String?  // userId
  tender TenderProject @relation(fields: [tenderId], references: [id], onDelete: Cascade)
}
```

**影响范围：**
- `packages/database/prisma/schema.prisma` 新增 model
- `TenderProject` model 新增 `documents TenderDocument[]` 关联
- `tender.repository.ts` 新增文件 CRUD 方法
- `tender.service.ts` 重构 `uploadTenderDocumentService`
- API：`GET /api/tenders/:id/documents` 返回文件列表

## 四、操作记录（AuditLog）

原型详情页有时间线，展示「谁在什么时候做了什么操作」。

**目标模型（需新增 `AuditLog` 表）：**
```prisma
model AuditLog {
  id         String   @id @default(cuid())
  entityType String   // TENDER | BID
  entityId   String
  action     String   // CREATED | STATUS_CHANGED | DOCUMENT_UPLOADED | etc.
  actorId    String?
  metadata   Json?
  createdAt  DateTime @default(now())
}
```

---

## 五、Dashboard 统计接口

原型首页展示 4 个统计卡片（见 `docs/prototype/screens/dashboard.html`）：

| 指标 | 计算方式 | 当前 API |
|------|----------|----------|
| 待决策 | `COUNT WHERE status = 'PENDING'` | ⚠️ 前端加载全量数据后自行计算（最多500条） |
| 投标中 | `COUNT WHERE status = 'BIDDING'` | ⚠️ 同上 |
| 已提交 | `COUNT WHERE status = 'SUBMITTED'` | ⚠️ 同上 |
| 中标率 | `WON / (WON + LOST) * 100` | ⚠️ 同上 |

**建议新增端点：** `GET /api/tenders/stats` — 返回各状态计数及中标率，避免前端大量加载

---

## 六、实现超出原型范围的字段

以下字段是当前实现新增的，原型中无对应展示，属于扩展功能：

| 字段 | 位置 | 原型 |
|------|------|------|
| `category`（项目类别） | Tender 新建/详情 | 无 |
| `matchScore`（AI 匹配评分） | Tender 详情占位 | 无（阶段5功能） |
| `riskLabels`（风险标签） | Tender 列表/详情 | 无（阶段5功能） |
| 语音助手导航项 | 侧边栏 | 无 |
| `BidDocument.status/errorMsg/drawingLinks` | BidDocument | 无（BIM 服务扩展字段） |


## 一、Tender（招标项目）模型差异

| 字段/功能 | 原型需求 | 当前状态 | 优先级 |
|-----------|----------|----------|--------|
| `assigneeId` 负责人 | 每个招标有指定负责人（显示姓名） | ❌ Schema 无此字段 | 中 |
| `documents[]` 多文件 | 文件列表：类型/大小/上传时间/文件名 | ❌ 仅 `rawDocumentUrl`（单字符串） | 高 |
| `history[]` 操作记录 | 时间线：操作人+时间+事件描述 | ❌ 无审计日志表 | 低 |
| `winRate` 中标率 | Dashboard 统计卡片，需聚合计算 | ❌ 无聚合 API | 中 |
| 状态统计接口 | `GET /api/tenders/stats`（按状态分组计数） | ❌ 无此端点 | 中 |

## 二、Bid（投标）模型差异

| 字段/功能 | 原型需求 | 当前状态 | 优先级 |
|-----------|----------|----------|--------|
| 一个 Tender 多个投标方案 | 投标版本列表（A/B方案并存） | ✅ Schema 支持，但详情页未展示 | 高（前端展示） |
| 投标负责人 | Bid 的 `assignedTo` 展示为用户名 | ⚠️ Schema 有 `assignedTo`（String），但未展示 | 中 |

## 三、TenderDocument（招标文件）模型差异

当前使用 `TenderProject.rawDocumentUrl`（单字符串），原型需要完整的文件管理功能：

**目标模型（需新增 `TenderDocument` 表）：**
```prisma
model TenderDocument {
  id         String   @id @default(cuid())
  tenderId   String
  filename   String
  fileUrl    String
  fileType   String   // PDF | DOCX | DWG | XLSX | OTHER
  fileSize   Int?     // bytes
  uploadedAt DateTime @default(now())
  uploadedBy String?  // userId

  tender TenderProject @relation(fields: [tenderId], references: [id], onDelete: Cascade)
}
```

**影响范围：**
- `packages/database/prisma/schema.prisma` 新增 model
- `TenderProject` model 新增 `documents TenderDocument[]` 关联
- `tender.repository.ts` 新增文件 CRUD 方法
- `tender.service.ts` 重构 `uploadTenderDocumentService`
- API：`GET /api/tenders/:id/documents` 返回文件列表

## 四、操作记录（AuditLog）

原型详情页有时间线，展示「谁在什么时候做了什么操作」。

**目标模型（需新增 `AuditLog` 表）：**
```prisma
model AuditLog {
  id        String   @id @default(cuid())
  entityType String  // TENDER | BID
  entityId  String
  action    String   // CREATED | STATUS_CHANGED | DOCUMENT_UPLOADED | etc.
  actorId   String?
  metadata  Json?
  createdAt DateTime @default(now())
}
```

---

## 五、Dashboard 统计接口

原型首页展示 4 个统计卡片：

| 指标 | 计算方式 | 当前 API |
|------|----------|----------|
| 待决策 | `COUNT WHERE status = 'PENDING'` | ❌ 无聚合端点 |
| 投标中 | `COUNT WHERE status = 'BIDDING'` | ❌ 无聚合端点 |
| 已提交 | `COUNT WHERE status = 'SUBMITTED'` | ❌ 无聚合端点 |
| 中标率 | `WON / (WON + LOST) * 100` | ❌ 无聚合端点 |

**需新增端点：** `GET /api/tenders/stats`

---

## 七、投标工作台列表接口缺失（bids/page.tsx）

原型 `bids.html` 展示**所有**投标方案列表（跨 Tender），但后端仅有：

- `GET /api/tenders/:tenderId/bids` — 按 Tender 查询该 Tender 下的投标列表

**缺失端点：**

| 端点 | 描述 | 优先级 |
|------|------|--------|
| `GET /api/bids` | 返回当前公司所有 Bid（支持 `status`/`search`/`page` 过滤） | 高 |

**当前前端 Workaround（`/bids/page.tsx`）：**  
先调 `GET /api/tenders?pageSize=200` 获取全量 Tender 列表，再用 `Promise.allSettled` 并发请求每个 Tender 的 bids，最终合并展示。

**副作用：** 当 Tender 数量较多时，会发起大量并发请求。建议后端尽快补充 `GET /api/bids`。

---

## 六、实现超出原型范围的字段

以下字段是当前实现新增的，原型中无对应展示，属于扩展功能：

| 字段 | 位置 | 原型 |
|------|------|------|
| `category`（项目类别） | Tender 新建/详情 | 无 |
| `matchScore`（AI 匹配评分） | Tender 详情占位 | 无（阶段5功能） |
| `riskLabels`（风险标签） | Tender 列表/详情 | 无（阶段5功能） |
| 语音助手导航项 | 侧边栏 | 无 |
