# 投标核心流程（商务标 / 技术标 / 经济标）

| 属性 | 值 |
|------|-----|
| 版本 | V1.0 |
| 日期 | 2026-05-19 |
| 模块 | Bid |

---

## 1. 功能范围

- 创建投标（Bid）并关联招标项目
- 商务标：公司资质、业绩、人员
- 技术标：施工方案、工期计划、安全质量
- 经济标：工程量清单明细、利润率、总报价
- 文件上传（图纸 PDF / DWG / IFC）
- 投标状态流转与审批
- 导出（PDF / Excel）

---

## 2. 投标状态流转

```
DRAFT（草稿）
  └─[提交审查]→ IN_REVIEW（审查中）
       ├─[审查通过]→ APPROVED（已批准）
       │    └─[提交业主]→ SUBMITTED（已提交）
       │         ├─[中标]→ WON
       │         └─[未中标]→ LOST
       └─[退回修改]→ DRAFT
```

---

## 3. 整体流程概览

```
1. 从招标项目创建 Bid
2. 填写商务标（资质/业绩/人员）
3. 上传图纸文件（PDF/DWG/IFC）
4. 填写技术标（施工方案/工期/安全）
5. 填写经济标明细（工程量清单）
6. 设定利润率 → 自动计算总报价
7. 提交内部审查
8. 审查通过 → 导出并提交业主
```

---

## 4. 用户故事 — 投标基础

### US-BID-01：创建投标

**作为** 投标负责人，**我希望** 从招标项目创建新投标，**以便** 开始编制标书。

**验收条件：**
- 入口：招标项目详情页「创建投标」按钮
- 一个招标项目可创建多个投标版本（如 A 方案 / B 方案）
- 创建时可填写投标版本名称和负责人
- 创建后状态为 `DRAFT`，自动初始化三标空白内容

**API：** `POST /api/bids`

```json
// Request
{
  "tenderId": "uuid",
  "name": "A 方案",
  "assignedTo": "userId",
  "currency": "HKD"
}

// Response 201
{
  "id": "uuid",
  "tenderId": "uuid",
  "status": "DRAFT",
  "commercial": { "id": "uuid" },
  "technical": { "id": "uuid" }
}
```

---

### US-BID-02：查看投标详情

**作为** 用户，**我希望** 查看投标的完整内容，**以便** 了解当前进度和内容。

**验收条件：**
- 展示三标（商务/技术/经济）完成进度
- 展示投标总报价和利润率
- 展示附件文件列表
- 展示状态历史记录

**API：** `GET /api/bids/:id`

---

### US-BID-03：提交审查 / 审查操作

**作为** 投标负责人，**我希望** 提交投标给管理层审查。  
**作为** 管理层，**我希望** 审查后批准或退回投标。

**验收条件：**
- `DRAFT` 状态下可提交审查，状态变为 `IN_REVIEW`
- 管理层可「批准」（→ `APPROVED`）或「退回」（→ `DRAFT`），需填写意见
- 操作记录保存审查人、时间、意见

**API：** `PATCH /api/bids/:id/status`

```json
{ "status": "IN_REVIEW" }
// or
{ "status": "APPROVED", "comment": "报价合理，可提交" }
// or
{ "status": "DRAFT", "comment": "经济标第3项单价偏高，请修改" }
```

---

## 5. 用户故事 — 商务标

### US-BID-COMM-01：填写商务标基本信息

**作为** 投标负责人，**我希望** 填写公司资质信息，**以便** 证明公司有资格参与投标。

**验收条件：**
- 系统自动从公司档案预填以下字段，用户可针对本次投标修改：
  - 公司名称、营业执照号
  - 资质证书列表（证书名、编号、有效期）
- 用户可额外添加本次投标专用说明（公司简介、经营理念等）

**API：**
- `GET /api/bids/:id/commercial` — 获取商务标
- `PATCH /api/bids/:id/commercial` — 更新商务标

```json
{
  "companyName": "ABC 装修工程有限公司",
  "registrationNo": "12345678",
  "licenses": [
    { "name": "室内设计师注册证", "no": "IDD-001", "expiresAt": "2027-12-31" }
  ],
  "companyProfile": "本公司成立于 2010 年，专注于商业室内设计..."
}
```

---

### US-BID-COMM-02：填写业绩案例

**作为** 投标负责人，**我希望** 在商务标中录入过往业绩，**以便** 证明公司实力。

**验收条件：**
- 可添加多个业绩案例
- 每条业绩字段：项目名称、业主、合同金额、完工日期、项目描述
- 支持上传业绩证明文件（PDF）
- 支持排序（拖拽）

```json
// 业绩案例结构（存于 commercial.pastProjects JSON 字段）
{
  "pastProjects": [
    {
      "title": "某银行分行装修工程",
      "client": "XX 银行",
      "contractAmount": 2500000,
      "completedAt": "2024-08-01",
      "description": "完成约 800 平方米商业装修..."
    }
  ]
}
```

---

### US-BID-COMM-03：填写关键人员

**作为** 投标负责人，**我希望** 在商务标中填写项目团队人员，**以便** 满足招标资质要求。

**验收条件：**
- 可添加多名人员
- 每条字段：姓名、职位、资质证书、从业年限、负责角色
- 支持上传人员资质证明文件

```json
// 关键人员结构（存于 commercial.keyPersonnel JSON 字段）
{
  "keyPersonnel": [
    {
      "name": "张三",
      "title": "项目经理",
      "certificate": "注册建筑师",
      "yearsExp": 12,
      "role": "项目总负责"
    }
  ]
}
```

---

## 6. 用户故事 — 技术标

### US-BID-TECH-01：填写施工方案

**作为** 投标负责人，**我希望** 填写施工方案，**以便** 说明工程实施能力。

**验收条件：**
- 富文本编辑器支持段落、表格、图片插入
- 字段：施工方法描述、主要施工工序、特殊工艺说明
- 可使用 AI 生成初稿（调用备注生成 Skill）

**API：**
- `GET /api/bids/:id/technical`
- `PATCH /api/bids/:id/technical`

```json
{
  "constructionMethod": "采用干法施工，减少噪音及粉尘...",
  "siteManagement": "实行封闭式施工管理..."
}
```

---

### US-BID-TECH-02：填写工期计划

**作为** 投标负责人，**我希望** 填写工期计划，**以便** 满足招标书的工期要求。

**验收条件：**
- 填写总工期天数
- 支持添加里程碑节点（阶段名称、开始天、结束天）
- 系统自动验证里程碑合计不超过总工期

```json
{
  "durationDays": 90,
  "milestonePlan": [
    { "phase": "拆除及准备", "startDay": 1, "endDay": 14 },
    { "phase": "水电工程", "startDay": 15, "endDay": 35 },
    { "phase": "装修工程", "startDay": 36, "endDay": 80 },
    { "phase": "收尾验收", "startDay": 81, "endDay": 90 }
  ]
}
```

---

### US-BID-TECH-03：填写安全与质量管理

**作为** 投标负责人，**我希望** 填写安全及质量管理内容，**以便** 满足合规要求。

**验收条件：**
- 字段：安全措施描述、质量控制方案
- 富文本格式支持
- 可使用 AI 生成初稿

```json
{
  "safetyMeasures": "严格遵守香港建筑安全条例...",
  "qualityControl": "实行三检制度（自检、互检、专检）..."
}
```

---

## 7. 用户故事 — 经济标

### US-BID-ECON-01：上传图纸文件

**作为** 投标负责人，**我希望** 上传图纸文件，**以便** 在填写工程量清单时参照图纸。

**验收条件：**
- 支持 PDF / DWG / IFC 格式，单文件最大 100MB
- PDF 文件由前端 PDF.js 渲染，支持翻页和缩放
- IFC 文件由 BIM 服务解析，在 3D 查看器展示
- 上传完成后文件出现在右侧查看器

**API：** `POST /api/bids/:id/documents`（multipart/form-data）

---

### US-BID-ECON-02：管理工程量清单明细

**作为** 投标负责人，**我希望** 逐行填写工程量清单，**以便** 精确计算报价。

**验收条件：**
- 左右分屏布局：左侧清单表格，右侧图纸/BIM 查看器
- 支持新增、编辑、删除、拖拽排序明细行
- 每行字段：序号、编号、名称、描述、数量、单位、成本价、售价、备注
- 点击某行可在右侧图纸高亮对应区域（通过 drawing_page + drawing_region）
- IFC 项目：数量可由 BIM 服务自动提取，用户确认后填入
- 可从物料资料库快速检索选取物料，自动填入成本价

**API：**
- `GET /api/bids/:id/items` — 获取清单列表
- `POST /api/bids/:id/items` — 新增明细
- `PATCH /api/bids/:id/items/:itemId` — 编辑明细
- `DELETE /api/bids/:id/items/:itemId` — 删除明细
- `PATCH /api/bids/:id/items/reorder` — 排序

```json
// 新增明细 Request
{
  "itemCode": "A-001",
  "itemName": "地板拆除",
  "description": "拆除现有地板及清运",
  "quantity": 850,
  "unit": "m²",
  "costPrice": 35,
  "sellPrice": 50,
  "drawingPage": "3",
  "drawingRegion": "B2-FLOOR"
}
```

---

### US-BID-ECON-03：设定利润率与自动计算总报价

**作为** 管理层，**我希望** 设定统一利润率，系统自动计算各项售价和总报价，**以便** 快速定价。

**验收条件：**
- 可在投标页面顶部设定整体利润率（%）
- 设定后系统对所有明细行按公式计算：`sellPrice = costPrice × (1 + profitMargin/100)`
- 用户可对单行售价手动覆盖（覆盖后标记为「手动定价」）
- 实时显示：总成本 / 总售价 / 实际综合利润率
- 特殊项目（is_special=true）不参与统一利润率计算

**API：** `PATCH /api/bids/:id`

```json
{ "profitMarginPct": 25 }
```

---

### US-BID-ECON-04：导出经济标

**作为** 投标负责人，**我希望** 将经济标导出为 Excel 或 PDF，**以便** 提交给业主。

**验收条件：**
- 支持导出格式：Excel（.xlsx）、PDF
- Excel 导出包含完整清单明细，按模板格式输出
- PDF 导出包含封面、公司信息、清单汇总页
- 导出文件保存至 S3 并提供下载链接

**API：** `POST /api/bids/:id/export`

```json
{ "format": "excel" }
// or
{ "format": "pdf" }
```

---

## 8. 数据模型

```prisma
model Bid {
  id              String    @id @default(uuid())
  tenderId        String
  companyId       String
  name            String    @default("默认方案")
  assignedTo      String?
  status          BidStatus @default(DRAFT)
  profitMarginPct Decimal   @default(0)
  totalCost       Decimal   @default(0)
  totalBidPrice   Decimal   @default(0)
  currency        String    @default("HKD")
  submittedAt     DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  tender          TenderProject  @relation(fields: [tenderId], references: [id])
  commercial      BidCommercial?
  technical       BidTechnical?
  items           BidItem[]
  documents       BidDocument[]
  statusHistory   BidStatusLog[]

  @@index([tenderId])
  @@index([companyId])
}

enum BidStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  SUBMITTED
  WON
  LOST
}
```

---

```prisma
model BidCommercial {
  id             String   @id @default(uuid())
  bidId          String   @unique
  companyName    String?
  registrationNo String?
  licenses       Json     @default("[]")
  keyPersonnel   Json     @default("[]")
  pastProjects   Json     @default("[]")
  companyProfile String?
  updatedAt      DateTime @updatedAt

  bid            Bid @relation(fields: [bidId], references: [id])
}

model BidTechnical {
  id                 String   @id @default(uuid())
  bidId              String   @unique
  constructionMethod String?
  projectSchedule    String?
  durationDays       Int?
  safetyMeasures     String?
  qualityControl     String?
  siteManagement     String?
  milestonePlan      Json     @default("[]")
  updatedAt          DateTime @updatedAt

  bid                Bid @relation(fields: [bidId], references: [id])
}
```

---

```prisma
model BidItem {
  id            String   @id @default(uuid())
  bidId         String
  sortOrder     Int
  itemCode      String?
  itemName      String
  description   String?
  quantity      Decimal  @default(0)
  unit          String?
  costPrice     Decimal  @default(0)
  sellPrice     Decimal  @default(0)
  isSpecial     Boolean  @default(false)
  isManualPrice Boolean  @default(false)
  remark        String?
  drawingPage   String?
  drawingRegion String?
  ifcElementId  String?

  bid           Bid @relation(fields: [bidId], references: [id])

  @@index([bidId])
}

model BidDocument {
  id           String   @id @default(uuid())
  bidId        String
  fileType     String
  fileUrl      String
  originalName String
  fileSize     Int
  pageCount    Int?
  drawingLinks Json     @default("[]")
  ifcMetadata  Json?
  uploadedAt   DateTime @default(now())

  bid          Bid @relation(fields: [bidId], references: [id])

  @@index([bidId])
}

model BidStatusLog {
  id        String   @id @default(uuid())
  bidId     String
  fromStatus String?
  toStatus  String
  operatorId String
  comment   String?
  createdAt DateTime @default(now())

  bid       Bid @relation(fields: [bidId], references: [id])

  @@index([bidId])
}
```

---

## 9. 前端页面

| 页面 | 路径 | 说明 |
|------|------|------|
| 投标详情/工作台 | `/bids/:id` | Tab 导航：商务标/技术标/经济标 |
| 经济标工作台 | `/bids/:id/economic` | 左右分屏：清单表格 + 图纸查看器 |
| 商务标编辑 | `/bids/:id/commercial` | 资质/业绩/人员表单 |
| 技术标编辑 | `/bids/:id/technical` | 施工方案/工期/安全富文本 |
