# 招标项目管理

| 属性 | 值 |
|------|-----|
| 版本 | V1.0 |
| 日期 | 2026-05-19 |
| 模块 | Tender Project |

---

## 1. 功能范围

- 手动创建招标项目
- 招标项目列表与详情查看
- 状态管理（待决策 → 决定投标 / 放弃）
- 附件上传（招标文件 PDF）

> 爬虫自动抓取属于周边功能，本文档聚焦手动创建与管理流程。

---

## 2. 招标项目状态流转

```
PENDING（待决策）
    ├── [决定投标] → DECIDED → BIDDING（已创建投标）→ SUBMITTED → WON / LOST
    └── [放弃] → DECLINED
```

---

## 3. 用户故事

### US-TENDER-01：手动创建招标项目

**作为** 管理层或投标负责人，**我希望** 手动录入招标信息，**以便** 跟踪和管理每个投标机会。

**验收条件：**
- 必填字段：项目名称、业主/甲方名称、截标日期
- 选填字段：项目地点、预算估算、招标来源网址、备注
- 创建后状态默认为 `PENDING`
- 创建后可上传招标文件（PDF）

**API：** `POST /api/tender-projects`

```json
// Request
{
  "title": "尖东某商业大厦 B2 层装修工程",
  "clientName": "XX 地产集团",
  "location": "香港九龙尖沙咀",
  "deadline": "2026-06-30",
  "budgetEstimate": 3000000,
  "sourceUrl": "https://...",
  "notes": "需提供 BIM 模型"
}

// Response 201
{
  "id": "uuid",
  "status": "PENDING",
  ...
}
```

---

### US-TENDER-02：查看招标项目列表

**作为** 管理层，**我希望** 在仪表板看到所有招标项目，**以便** 快速掌握投标机会全局。

**验收条件：**
- 列表展示：项目名称、业主、截标日期、预算、状态、匹配度（若有）
- 支持按状态筛选（待决策 / 投标中 / 已提交 / 已中标）
- 支持关键词搜索（项目名称、业主名称）
- 支持按截标日期排序
- 分页，每页 20 条

**API：** `GET /api/tender-projects?status=PENDING&keyword=装修&page=1&pageSize=20`

---

### US-TENDER-03：查看招标项目详情

**作为** 用户，**我希望** 查看某个招标项目的完整信息，**以便** 了解项目概况并决策。

**验收条件：**
- 显示所有字段信息
- 显示已上传的招标文件列表（可下载）
- 显示关联的投标记录列表（bid 列表）
- 显示 AI 分析结果（匹配度评分、风险标签、AI 摘要，若已分析）

**API：** `GET /api/tender-projects/:id`

---

### US-TENDER-04：更新招标项目状态

**作为** 管理层，**我希望** 对招标项目做出「投标/放弃」决策，**以便** 推进工作或关闭机会。

**验收条件：**
- 状态为 `PENDING` 时，可操作「决定投标」或「放弃投标」
- 「决定投标」将状态改为 `DECIDED`，并引导用户创建新的投标（Bid）
- 「放弃投标」将状态改为 `DECLINED`，需填写放弃原因（选填）
- 状态变更记录操作人和时间

**API：** `PATCH /api/tender-projects/:id/status`

```json
{
  "status": "DECIDED",
  "reason": ""
}
```

---

### US-TENDER-05：上传招标文件

**作为** 投标负责人，**我希望** 上传招标 PDF 文件，**以便** 后续在投标中查阅和分析。

**验收条件：**
- 支持上传 PDF / DWG / IFC 格式
- 单个文件最大 100MB
- 上传完成后显示在「招标文件」列表
- 可删除已上传文件

**API：**
- `POST /api/tender-projects/:id/documents` — 上传（multipart/form-data）
- `DELETE /api/tender-projects/:id/documents/:docId` — 删除

---

### US-TENDER-06：编辑与删除招标项目

**作为** 公司管理员，**我希望** 编辑或删除错误录入的招标项目。

**验收条件：**
- 任何状态均可编辑基本信息
- 只有 `PENDING` 或 `DECLINED` 状态可物理删除
- 已有关联投标（bid）的项目不可删除，需先归档投标

**API：**
- `PATCH /api/tender-projects/:id` — 编辑
- `DELETE /api/tender-projects/:id` — 删除

---

## 4. 数据模型

```prisma
model TenderProject {
  id              String        @id @default(uuid())
  companyId       String
  title           String
  clientName      String
  location        String?
  sourceUrl       String?
  rawDocumentUrl  String?
  deadline        DateTime?
  budgetEstimate  Decimal?
  matchScore      Int?
  riskLabels      String[]
  status          TenderStatus  @default(PENDING)
  aiSummary       String?
  notes           String?
  createdBy       String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  company         Company        @relation(fields: [companyId], references: [id])
  bids            Bid[]
  documents       TenderDocument[]

  @@index([companyId])
  @@index([status])
  @@index([deadline])
}

model TenderDocument {
  id           String   @id @default(uuid())
  tenderId     String
  fileType     String   // pdf | dwg | ifc
  fileUrl      String
  originalName String
  fileSize     Int
  uploadedBy   String
  uploadedAt   DateTime @default(now())

  tender       TenderProject @relation(fields: [tenderId], references: [id])

  @@index([tenderId])
}

enum TenderStatus {
  PENDING
  DECIDED
  DECLINED
  BIDDING
  SUBMITTED
  WON
  LOST
}
```

---

## 5. 前端页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 商机仪表板 | `/dashboard` | 统计卡片 + 招标项目列表 |
| 创建招标项目 | `/tenders/new` | 表单录入 |
| 招标项目详情 | `/tenders/:id` | 信息展示 + 文件列表 + 关联投标 |
| 编辑招标项目 | `/tenders/:id/edit` | 编辑表单 |
