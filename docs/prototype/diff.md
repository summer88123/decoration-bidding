# 原型 vs 实现 — 数据层差异记录

> 最后更新：2026-05-23

本文档记录原型设计中展示的功能/字段，但当前数据模型或 API 尚不支持的部分。
纯 UI 样式差异不在此列，请查看源代码注释。

---

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

## 六、实现超出原型范围的字段

以下字段是当前实现新增的，原型中无对应展示，属于扩展功能：

| 字段 | 位置 | 原型 |
|------|------|------|
| `category`（项目类别） | Tender 新建/详情 | 无 |
| `matchScore`（AI 匹配评分） | Tender 详情占位 | 无（阶段5功能） |
| `riskLabels`（风险标签） | Tender 列表/详情 | 无（阶段5功能） |
| 语音助手导航项 | 侧边栏 | 无 |
