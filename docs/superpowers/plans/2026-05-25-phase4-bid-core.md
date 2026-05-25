# 阶段 4：投标核心流程（三标）实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的投标三标流程（商务标/技术标/经济标），包含后端 API、数据库迁移和前端工作台页面。

**Architecture:** 在现有 bid 模块骨架基础上扩展，新增 BidCommercial/BidTechnical/BidStatusLog 三个数据表，补全 bid.repository.ts / bid.service.ts / bid.handlers，前端实现三标 Tab 工作台和经济标左右分屏页面。

**Tech Stack:** Fastify 4, Prisma ORM, Next.js 14 App Router, React Hook Form + Zod, TailwindCSS + shadcn/ui, @tiptap/react（富文本）

---

## 现有骨架总结

| 文件 | 状态 | 说明 |
|------|------|------|
| `packages/database/prisma/schema.prisma` | ⚠️ 需迁移 | Bid 缺少 name/companyId/status enum/BidCommercial/BidTechnical/BidStatusLog |
| `core-service/modules/bid/handlers/document.handler.ts` | ✅ 可用 | 文件上传已完整 |
| `core-service/modules/bid/repositories/bid-item.repository.ts` | ⚠️ 需扩展 | 仅有 AI 批量导入，缺少手动 CRUD |
| `core-service/modules/bid/routes.ts` | ⚠️ 需扩展 | 只有文件/条目路由 |
| `web/src/components/bid/BidWorkspace.tsx` | ⚠️ 需重构 | 当前只有经济标+PDF查看器，无三标 Tab |
| `web/src/app/(dashboard)/bids/[id]/page.tsx` | ⚠️ 需完善 | 只是骨架 |

---

## 文件结构规划

### 新建文件

```
packages/database/prisma/
  └── migrations/                  # 自动生成

apps/core-service/src/modules/bid/
  ├── repositories/
  │   ├── bid.repository.ts         # Bid 主体 CRUD
  │   ├── bid-commercial.repository.ts
  │   ├── bid-technical.repository.ts
  │   └── bid-status.repository.ts  # BidStatusLog CRUD
  ├── services/
  │   ├── bid.service.ts            # 创建投标、状态流转、利润计算
  │   ├── bid-commercial.service.ts
  │   └── bid-technical.service.ts
  ├── handlers/
  │   ├── bid.handler.ts            # 创建/查看/更新/状态变更
  │   ├── bid-commercial.handler.ts
  │   ├── bid-technical.handler.ts
  │   └── bid-items.handler.ts      # 经济标条目 CRUD
  └── schemas/
      └── bid.schema.ts             # Zod 验证 Schema

apps/web/src/
  ├── app/(dashboard)/bids/[id]/
  │   ├── page.tsx                  # 重构：三标 Tab 工作台
  │   ├── commercial/page.tsx       # 商务标编辑页
  │   ├── technical/page.tsx        # 技术标编辑页
  │   └── economic/page.tsx         # 经济标左右分屏
  ├── components/bid/
  │   ├── BidWorkspace.tsx          # 重构：三标 Tab 导航 + 状态栏
  │   ├── CommercialTab.tsx          # 商务标表单
  │   ├── TechnicalTab.tsx           # 技术标富文本
  │   ├── EconomicTab.tsx            # 经济标汇总（重定向到 /economic）
  │   ├── BidItemTable.tsx           # 保留+扩展：行内编辑
  │   └── MaterialPickerDialog.tsx   # 从物料库选取对话框
  └── lib/api/
      └── bid.api.ts                 # 扩展 API 客户端
```

### 修改文件

```
packages/database/prisma/schema.prisma   # 新增 3 个 model，更新 Bid 字段
apps/core-service/src/modules/bid/routes.ts  # 注册所有新路由
```

---

## Chunk 1：数据库 Schema 迁移

### Task 1：更新 Prisma Schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: 更新 Bid model，添加缺失字段**

在 `schema.prisma` 的 `model Bid` 块中，将现有定义替换为：

```prisma
enum BidStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  SUBMITTED
  WON
  LOST
}

model Bid {
  id                  String    @id @default(cuid())
  tenderId            String
  companyId           String
  name                String    @default("默认方案")
  assignedTo          String?
  status              BidStatus @default(DRAFT)
  profitMarginPct     Decimal   @default(0) @db.Decimal(5,2)
  totalCost           Decimal   @default(0) @db.Decimal(14,2)
  totalBidPrice       Decimal   @default(0) @db.Decimal(14,2)
  currency            String    @default("HKD")
  submittedAt         DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  tender        TenderProject  @relation(fields: [tenderId], references: [id])
  commercial    BidCommercial?
  technical     BidTechnical?
  items         BidItem[]
  documents     BidDocument[]
  statusHistory BidStatusLog[]

  @@index([tenderId])
  @@index([companyId])
}
```

- [ ] **Step 2: 更新 BidItem model，添加 itemCode/isManualPrice，修正 drawingPage 类型**

将现有 `model BidItem` 替换为：

```prisma
model BidItem {
  id            String   @id @default(cuid())
  bidId         String
  documentId    String?
  sortOrder     Int      @default(0)
  itemCode      String?
  itemName      String
  description   String?
  quantity      Decimal  @default(0) @db.Decimal(12,3)
  unit          String?
  costPrice     Decimal  @default(0) @db.Decimal(12,2)
  sellPrice     Decimal  @default(0) @db.Decimal(12,2)
  isSpecial     Boolean  @default(false)
  isManualPrice Boolean  @default(false)
  remark        String?
  drawingPage   String?
  drawingRegion String?
  ifcElementId  String?

  bid      Bid          @relation(fields: [bidId], references: [id], onDelete: Cascade)
  document BidDocument? @relation(fields: [documentId], references: [id])

  @@index([bidId])
}
```

- [ ] **Step 3: 新增 BidCommercial model**

在 BidItem 定义后添加：

```prisma
model BidCommercial {
  id             String   @id @default(cuid())
  bidId          String   @unique
  companyName    String?
  registrationNo String?
  licenses       Json     @default("[]")
  keyPersonnel   Json     @default("[]")
  pastProjects   Json     @default("[]")
  companyProfile String?
  updatedAt      DateTime @updatedAt

  bid Bid @relation(fields: [bidId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 4: 新增 BidTechnical model**

```prisma
model BidTechnical {
  id                 String   @id @default(cuid())
  bidId              String   @unique
  constructionMethod String?
  siteManagement     String?
  safetyMeasures     String?
  qualityControl     String?
  durationDays       Int?
  milestonePlan      Json     @default("[]")
  updatedAt          DateTime @updatedAt

  bid Bid @relation(fields: [bidId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 5: 新增 BidStatusLog model**

```prisma
model BidStatusLog {
  id         String   @id @default(cuid())
  bidId      String
  fromStatus String?
  toStatus   String
  operatorId String
  comment    String?
  createdAt  DateTime @default(now())

  bid Bid @relation(fields: [bidId], references: [id], onDelete: Cascade)

  @@index([bidId])
}
```

- [ ] **Step 6: 运行迁移**

```bash
cd packages/database
pnpm db:migrate
# 提示输入迁移名称时输入：phase4_bid_core
```

Expected: 迁移成功，无报错

- [ ] **Step 7: 重新生成 Prisma Client**

```bash
pnpm db:generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 8: Commit**

```bash
git add packages/database/prisma/
git commit -m "feat(db): add BidCommercial/BidTechnical/BidStatusLog, update Bid/BidItem fields"
```

---

## Chunk 2：后端 bid 核心 Repository + Service

### Task 2：bid.schema.ts（Zod 验证）

**Files:**
- Create: `apps/core-service/src/modules/bid/schemas/bid.schema.ts`

- [ ] **Step 1: 创建 Zod 验证 Schema 文件**

```typescript
// apps/core-service/src/modules/bid/schemas/bid.schema.ts
import { z } from 'zod'

export const CreateBidSchema = z.object({
  tenderId: z.string().min(1),
  name: z.string().default('默认方案'),
  assignedTo: z.string().optional(),
  currency: z.string().default('HKD'),
})

export const UpdateBidSchema = z.object({
  name: z.string().optional(),
  assignedTo: z.string().optional(),
  profitMarginPct: z.number().min(0).max(100).optional(),
})

export const BidStatusSchema = z.object({
  status: z.enum(['IN_REVIEW', 'APPROVED', 'DRAFT', 'SUBMITTED']),
  comment: z.string().optional(),
})

export const UpdateCommercialSchema = z.object({
  companyName: z.string().optional(),
  registrationNo: z.string().optional(),
  licenses: z.array(z.object({
    name: z.string(),
    no: z.string(),
    expiresAt: z.string().optional(),
  })).optional(),
  keyPersonnel: z.array(z.object({
    name: z.string(),
    title: z.string(),
    certificate: z.string().optional(),
    yearsExp: z.number().optional(),
    role: z.string().optional(),
  })).optional(),
  pastProjects: z.array(z.object({
    title: z.string(),
    client: z.string().optional(),
    contractAmount: z.number().optional(),
    completedAt: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
  companyProfile: z.string().optional(),
})

export const UpdateTechnicalSchema = z.object({
  constructionMethod: z.string().optional(),
  siteManagement: z.string().optional(),
  safetyMeasures: z.string().optional(),
  qualityControl: z.string().optional(),
  durationDays: z.number().int().positive().optional(),
  milestonePlan: z.array(z.object({
    phase: z.string(),
    startDay: z.number().int(),
    endDay: z.number().int(),
  })).optional(),
})

export const CreateBidItemSchema = z.object({
  itemCode: z.string().optional(),
  itemName: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().min(0).default(0),
  unit: z.string().optional(),
  costPrice: z.number().min(0).default(0),
  sellPrice: z.number().min(0).default(0),
  isSpecial: z.boolean().default(false),
  remark: z.string().optional(),
  drawingPage: z.string().optional(),
  drawingRegion: z.string().optional(),
})

export const UpdateBidItemSchema = CreateBidItemSchema.partial().extend({
  isManualPrice: z.boolean().optional(),
})

export const ReorderItemsSchema = z.object({
  orderedIds: z.array(z.string()),
})
```

- [ ] **Step 2: Commit**

```bash
git add apps/core-service/src/modules/bid/schemas/
git commit -m "feat(bid): add Zod validation schemas"
```

---

### Task 3：Repositories

**Files:**
- Create: `apps/core-service/src/modules/bid/repositories/bid.repository.ts`
- Create: `apps/core-service/src/modules/bid/repositories/bid-commercial.repository.ts`
- Create: `apps/core-service/src/modules/bid/repositories/bid-technical.repository.ts`
- Create: `apps/core-service/src/modules/bid/repositories/bid-status.repository.ts`
- Modify: `apps/core-service/src/modules/bid/repositories/bid-item.repository.ts`

- [ ] **Step 1: 创建 bid.repository.ts**

```typescript
// apps/core-service/src/modules/bid/repositories/bid.repository.ts
import { prisma } from '@decoration-bidding/database'

export const BidRepository = {
  async create(data: {
    tenderId: string
    companyId: string
    name?: string
    assignedTo?: string
    currency?: string
  }) {
    return prisma.bid.create({
      data: {
        ...data,
        status: 'DRAFT',
        commercial: { create: {} },
        technical: { create: {} },
      },
      include: { commercial: true, technical: true },
    })
  },

  async findById(id: string, companyId: string) {
    return prisma.bid.findFirst({
      where: { id, companyId },
      include: {
        commercial: true,
        technical: true,
        items: { orderBy: { sortOrder: 'asc' } },
        documents: true,
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
  },

  async findByTenderId(tenderId: string, companyId: string) {
    return prisma.bid.findMany({
      where: { tenderId, companyId },
      orderBy: { createdAt: 'desc' },
    })
  },

  async update(id: string, data: {
    name?: string
    assignedTo?: string
    profitMarginPct?: number
    totalCost?: number
    totalBidPrice?: number
  }) {
    return prisma.bid.update({ where: { id }, data })
  },

  async updateStatus(id: string, status: string) {
    return prisma.bid.update({
      where: { id },
      data: {
        status: status as any,
        ...(status === 'SUBMITTED' ? { submittedAt: new Date() } : {}),
      },
    })
  },
}
```

- [ ] **Step 2: 创建 bid-commercial.repository.ts**

```typescript
// apps/core-service/src/modules/bid/repositories/bid-commercial.repository.ts
import { prisma } from '@decoration-bidding/database'

export const BidCommercialRepository = {
  findByBidId(bidId: string) {
    return prisma.bidCommercial.findUnique({ where: { bidId } })
  },

  upsert(bidId: string, data: Record<string, unknown>) {
    return prisma.bidCommercial.upsert({
      where: { bidId },
      create: { bidId, ...data } as any,
      update: data as any,
    })
  },
}
```

- [ ] **Step 3: 创建 bid-technical.repository.ts**

```typescript
// apps/core-service/src/modules/bid/repositories/bid-technical.repository.ts
import { prisma } from '@decoration-bidding/database'

export const BidTechnicalRepository = {
  findByBidId(bidId: string) {
    return prisma.bidTechnical.findUnique({ where: { bidId } })
  },

  upsert(bidId: string, data: Record<string, unknown>) {
    return prisma.bidTechnical.upsert({
      where: { bidId },
      create: { bidId, ...data } as any,
      update: data as any,
    })
  },
}
```

- [ ] **Step 4: 创建 bid-status.repository.ts**

```typescript
// apps/core-service/src/modules/bid/repositories/bid-status.repository.ts
import { prisma } from '@decoration-bidding/database'

export const BidStatusRepository = {
  create(data: {
    bidId: string
    fromStatus: string | null
    toStatus: string
    operatorId: string
    comment?: string
  }) {
    return prisma.bidStatusLog.create({ data })
  },

  findByBidId(bidId: string) {
    return prisma.bidStatusLog.findMany({
      where: { bidId },
      orderBy: { createdAt: 'desc' },
    })
  },
}
```

- [ ] **Step 5: 扩展 bid-item.repository.ts，在 BidItemRepository 对象末尾添加手动 CRUD 方法**

在 `createManyFromAI` 方法之后（`}` 闭合前）追加：

```typescript
  create(bidId: string, data: {
    itemCode?: string | null
    itemName: string
    description?: string | null
    quantity?: number
    unit?: string | null
    costPrice?: number
    sellPrice?: number
    isSpecial?: boolean
    remark?: string | null
    drawingPage?: string | null
    drawingRegion?: string | null
    sortOrder?: number
  }) {
    return prisma.bidItem.create({ data: { bidId, ...data } })
  },

  update(id: string, data: Record<string, unknown>) {
    return prisma.bidItem.update({ where: { id }, data: data as any })
  },

  delete(id: string) {
    return prisma.bidItem.delete({ where: { id } })
  },

  async reorder(bidId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, idx) =>
      prisma.bidItem.update({ where: { id }, data: { sortOrder: idx } })
    )
    return prisma.$transaction(updates)
  },

  async recalcTotals(bidId: string) {
    const items = await prisma.bidItem.findMany({ where: { bidId } })
    const totalCost = items.reduce((sum, i) => sum + Number(i.costPrice) * Number(i.quantity), 0)
    const totalBidPrice = items.reduce((sum, i) => sum + Number(i.sellPrice) * Number(i.quantity), 0)
    return prisma.bid.update({ where: { id: bidId }, data: { totalCost, totalBidPrice } })
  },
```

- [ ] **Step 6: Commit**

```bash
git add apps/core-service/src/modules/bid/repositories/
git commit -m "feat(bid): add repositories for bid/commercial/technical/status/items"
```

---

### Task 4：bid.service.ts

**Files:**
- Create: `apps/core-service/src/modules/bid/services/bid.service.ts`

- [ ] **Step 1: 创建 bid.service.ts**

```typescript
// apps/core-service/src/modules/bid/services/bid.service.ts
import { prisma } from '@decoration-bidding/database'
import { BidRepository } from '../repositories/bid.repository.js'
import { BidStatusRepository } from '../repositories/bid-status.repository.js'
import { BidItemRepository } from '../repositories/bid-item.repository.js'
import { BidCommercialRepository } from '../repositories/bid-commercial.repository.js'
import { BidTechnicalRepository } from '../repositories/bid-technical.repository.js'

export class BidService {
  async createBid(companyId: string, dto: {
    tenderId: string
    name?: string
    assignedTo?: string
    currency?: string
  }) {
    // 验证招标项目属于该公司
    const tender = await prisma.tenderProject.findFirst({
      where: { id: dto.tenderId, companyId },
    })
    if (!tender) throw Object.assign(new Error('招标项目不存在'), { statusCode: 404 })

    return BidRepository.create({ ...dto, companyId })
  }

  async getBid(id: string, companyId: string) {
    const bid = await BidRepository.findById(id, companyId)
    if (!bid) throw Object.assign(new Error('投标不存在'), { statusCode: 404 })
    return bid
  }

  async getBidsByTender(tenderId: string, companyId: string) {
    return BidRepository.findByTenderId(tenderId, companyId)
  }

  async updateBid(id: string, companyId: string, dto: {
    name?: string
    assignedTo?: string
    profitMarginPct?: number
  }) {
    await this.getBid(id, companyId)
    return BidRepository.update(id, dto)
  }

  async changeBidStatus(id: string, companyId: string, operatorId: string, dto: {
    status: string
    comment?: string
  }) {
    const bid = await this.getBid(id, companyId)

    // 状态流转校验
    const allowed: Record<string, string[]> = {
      DRAFT: ['IN_REVIEW'],
      IN_REVIEW: ['APPROVED', 'DRAFT'],
      APPROVED: ['SUBMITTED'],
      SUBMITTED: ['WON', 'LOST'],
    }
    if (!allowed[bid.status]?.includes(dto.status)) {
      throw Object.assign(
        new Error(`不允许从 ${bid.status} 变更为 ${dto.status}`),
        { statusCode: 422 }
      )
    }

    await BidStatusRepository.create({
      bidId: id,
      fromStatus: bid.status,
      toStatus: dto.status,
      operatorId,
      comment: dto.comment,
    })

    return BidRepository.updateStatus(id, dto.status)
  }

  async applyProfitMargin(id: string, companyId: string, profitMarginPct: number) {
    await this.getBid(id, companyId)

    // 对非手动定价的条目，按利润率重新计算 sellPrice
    const items = await prisma.bidItem.findMany({ where: { bidId: id } })
    const updates = items
      .filter((item) => !item.isManualPrice && !item.isSpecial)
      .map((item) =>
        prisma.bidItem.update({
          where: { id: item.id },
          data: { sellPrice: Number(item.costPrice) * (1 + profitMarginPct / 100) },
        })
      )

    await prisma.$transaction([
      ...updates,
      prisma.bid.update({ where: { id }, data: { profitMarginPct } }),
    ])

    await BidItemRepository.recalcTotals(id)
    return BidRepository.findById(id, companyId)
  }

  // 商务标
  getCommercial(bidId: string) {
    return BidCommercialRepository.findByBidId(bidId)
  }

  updateCommercial(bidId: string, data: Record<string, unknown>) {
    return BidCommercialRepository.upsert(bidId, data)
  }

  // 技术标
  getTechnical(bidId: string) {
    return BidTechnicalRepository.findByBidId(bidId)
  }

  updateTechnical(bidId: string, data: Record<string, unknown>) {
    return BidTechnicalRepository.upsert(bidId, data)
  }

  // 经济标条目
  async createItem(bidId: string, companyId: string, data: Record<string, unknown>) {
    await this.getBid(bidId, companyId)
    const items = await prisma.bidItem.findMany({ where: { bidId } })
    const sortOrder = items.length
    const item = await BidItemRepository.create(bidId, { ...data, sortOrder } as any)
    await BidItemRepository.recalcTotals(bidId)
    return item
  }

  async updateItem(bidId: string, itemId: string, companyId: string, data: Record<string, unknown>) {
    await this.getBid(bidId, companyId)
    const item = await BidItemRepository.update(itemId, data)
    await BidItemRepository.recalcTotals(bidId)
    return item
  }

  async deleteItem(bidId: string, itemId: string, companyId: string) {
    await this.getBid(bidId, companyId)
    await BidItemRepository.delete(itemId)
    await BidItemRepository.recalcTotals(bidId)
  }

  async reorderItems(bidId: string, companyId: string, orderedIds: string[]) {
    await this.getBid(bidId, companyId)
    return BidItemRepository.reorder(bidId, orderedIds)
  }
}

export const bidService = new BidService()
```

- [ ] **Step 2: Commit**

```bash
git add apps/core-service/src/modules/bid/services/bid.service.ts
git commit -m "feat(bid): add bid.service with CRUD, status transition, profit margin"
```

---

## Chunk 3：后端 Handlers + 路由注册

### Task 5：bid.handler.ts（主体路由）

**Files:**
- Create: `apps/core-service/src/modules/bid/handlers/bid.handler.ts`

- [ ] **Step 1: 创建 bid.handler.ts**

```typescript
// apps/core-service/src/modules/bid/handlers/bid.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { bidService } from '../services/bid.service.js'
import {
  CreateBidSchema,
  UpdateBidSchema,
  BidStatusSchema,
} from '../schemas/bid.schema.js'

export function createBidHandlers() {
  return {
    async create(req: FastifyRequest, reply: FastifyReply) {
      const user = (req as any).user
      const body = CreateBidSchema.parse(req.body)
      const bid = await bidService.createBid(user.companyId, body)
      return reply.code(201).send({ success: true, data: bid })
    },

    async getById(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const user = (req as any).user
      const bid = await bidService.getBid(req.params.bidId, user.companyId)
      return reply.send({ success: true, data: bid })
    },

    async getByTender(req: FastifyRequest<{ Params: { tenderId: string } }>, reply: FastifyReply) {
      const user = (req as any).user
      const bids = await bidService.getBidsByTender(req.params.tenderId, user.companyId)
      return reply.send({ success: true, data: bids })
    },

    async update(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const user = (req as any).user
      const body = UpdateBidSchema.parse(req.body)
      const bid = await bidService.updateBid(req.params.bidId, user.companyId, body)
      return reply.send({ success: true, data: bid })
    },

    async changeStatus(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const user = (req as any).user
      const body = BidStatusSchema.parse(req.body)
      const bid = await bidService.changeBidStatus(
        req.params.bidId,
        user.companyId,
        user.id,
        body,
      )
      return reply.send({ success: true, data: bid })
    },

    async applyProfitMargin(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const user = (req as any).user
      const { profitMarginPct } = req.body as { profitMarginPct: number }
      const bid = await bidService.applyProfitMargin(
        req.params.bidId,
        user.companyId,
        profitMarginPct,
      )
      return reply.send({ success: true, data: bid })
    },
  }
}
```

- [ ] **Step 2: 创建 bid-commercial.handler.ts**

```typescript
// apps/core-service/src/modules/bid/handlers/bid-commercial.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { bidService } from '../services/bid.service.js'
import { UpdateCommercialSchema } from '../schemas/bid.schema.js'

export function createCommercialHandlers() {
  return {
    async get(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const data = await bidService.getCommercial(req.params.bidId)
      return reply.send({ success: true, data })
    },

    async update(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const body = UpdateCommercialSchema.parse(req.body)
      const data = await bidService.updateCommercial(req.params.bidId, body as Record<string, unknown>)
      return reply.send({ success: true, data })
    },
  }
}
```

- [ ] **Step 3: 创建 bid-technical.handler.ts**

```typescript
// apps/core-service/src/modules/bid/handlers/bid-technical.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { bidService } from '../services/bid.service.js'
import { UpdateTechnicalSchema } from '../schemas/bid.schema.js'

export function createTechnicalHandlers() {
  return {
    async get(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const data = await bidService.getTechnical(req.params.bidId)
      return reply.send({ success: true, data })
    },

    async update(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const body = UpdateTechnicalSchema.parse(req.body)
      const data = await bidService.updateTechnical(req.params.bidId, body as Record<string, unknown>)
      return reply.send({ success: true, data })
    },
  }
}
```

- [ ] **Step 4: 创建 bid-items.handler.ts**

```typescript
// apps/core-service/src/modules/bid/handlers/bid-items.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { bidService } from '../services/bid.service.js'
import {
  CreateBidItemSchema,
  UpdateBidItemSchema,
  ReorderItemsSchema,
} from '../schemas/bid.schema.js'

export function createBidItemsHandlers() {
  return {
    async list(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const user = (req as any).user
      const bid = await bidService.getBid(req.params.bidId, user.companyId)
      return reply.send({ success: true, data: bid.items })
    },

    async create(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const user = (req as any).user
      const body = CreateBidItemSchema.parse(req.body)
      const item = await bidService.createItem(req.params.bidId, user.companyId, body)
      return reply.code(201).send({ success: true, data: item })
    },

    async update(
      req: FastifyRequest<{ Params: { bidId: string; itemId: string } }>,
      reply: FastifyReply,
    ) {
      const user = (req as any).user
      const body = UpdateBidItemSchema.parse(req.body)
      const item = await bidService.updateItem(
        req.params.bidId,
        req.params.itemId,
        user.companyId,
        body,
      )
      return reply.send({ success: true, data: item })
    },

    async delete(
      req: FastifyRequest<{ Params: { bidId: string; itemId: string } }>,
      reply: FastifyReply,
    ) {
      const user = (req as any).user
      await bidService.deleteItem(req.params.bidId, req.params.itemId, user.companyId)
      return reply.send({ success: true })
    },

    async reorder(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const user = (req as any).user
      const body = ReorderItemsSchema.parse(req.body)
      await bidService.reorderItems(req.params.bidId, user.companyId, body.orderedIds)
      return reply.send({ success: true })
    },
  }
}
```

- [ ] **Step 5: Commit handlers**

```bash
git add apps/core-service/src/modules/bid/handlers/
git commit -m "feat(bid): add bid/commercial/technical/items handlers"
```

---

### Task 6：更新 routes.ts，注册所有路由

**Files:**
- Modify: `apps/core-service/src/modules/bid/routes.ts`

- [ ] **Step 1: 重写 routes.ts，保留原有文件路由，添加新路由**

将文件内容替换为：

```typescript
// apps/core-service/src/modules/bid/routes.ts
import type { FastifyPluginAsync } from 'fastify'
import { DocumentService } from './services/document.service.js'
import { createDocumentHandlers } from './handlers/document.handler.js'
import { createBidHandlers } from './handlers/bid.handler.js'
import { createCommercialHandlers } from './handlers/bid-commercial.handler.js'
import { createTechnicalHandlers } from './handlers/bid-technical.handler.js'
import { createBidItemsHandlers } from './handlers/bid-items.handler.js'
import { createStorageService } from './storage/storage.factory.js'
import { config } from '../../config.js'
import { onDocEvent } from './services/document-events.js'
import { BidDocumentRepository } from './repositories/bid-document.repository.js'
import { authenticate } from '../../shared/middleware/auth.js'

export const bidRoutes: FastifyPluginAsync = async (app) => {
  const storage = createStorageService(config.STORAGE_DRIVER, config.UPLOAD_DIR, config.BASE_URL)
  const docSvc = new DocumentService(storage, config.BIM_SERVICE_URL, config.AI_AGENT_SERVICE_URL)
  const docHandlers = createDocumentHandlers(docSvc)
  const bidHandlers = createBidHandlers()
  const commercialHandlers = createCommercialHandlers()
  const technicalHandlers = createTechnicalHandlers()
  const itemsHandlers = createBidItemsHandlers()

  // ── 投标主体路由（需认证）──────────────────────────────
  app.post('/bids', { preHandler: [authenticate] }, bidHandlers.create)
  app.get('/bids/:bidId', { preHandler: [authenticate] }, bidHandlers.getById)
  app.patch('/bids/:bidId', { preHandler: [authenticate] }, bidHandlers.update)
  app.patch('/bids/:bidId/status', { preHandler: [authenticate] }, bidHandlers.changeStatus)
  app.patch('/bids/:bidId/profit-margin', { preHandler: [authenticate] }, bidHandlers.applyProfitMargin)

  // 按招标查询投标列表
  app.get('/tenders/:tenderId/bids', { preHandler: [authenticate] }, bidHandlers.getByTender)

  // ── 商务标路由 ───────────────────────────────────────
  app.get('/bids/:bidId/commercial', { preHandler: [authenticate] }, commercialHandlers.get)
  app.patch('/bids/:bidId/commercial', { preHandler: [authenticate] }, commercialHandlers.update)

  // ── 技术标路由 ───────────────────────────────────────
  app.get('/bids/:bidId/technical', { preHandler: [authenticate] }, technicalHandlers.get)
  app.patch('/bids/:bidId/technical', { preHandler: [authenticate] }, technicalHandlers.update)

  // ── 经济标条目路由 ────────────────────────────────────
  app.get('/bids/:bidId/items', { preHandler: [authenticate] }, itemsHandlers.list)
  app.post('/bids/:bidId/items', { preHandler: [authenticate] }, itemsHandlers.create)
  app.patch('/bids/:bidId/items/:itemId', { preHandler: [authenticate] }, itemsHandlers.update)
  app.delete('/bids/:bidId/items/:itemId', { preHandler: [authenticate] }, itemsHandlers.delete)
  app.patch('/bids/:bidId/items/reorder', { preHandler: [authenticate] }, itemsHandlers.reorder)

  // ── 文件路由（原有，保留）────────────────────────────
  app.post('/bids/:bidId/documents', { preHandler: [authenticate] }, docHandlers.upload)
  app.get('/bids/:bidId/documents/:docId/status', docHandlers.getStatus)

  // SSE 流（原有，保留）
  app.get<{ Params: { bidId: string; docId: string } }>(
    '/bids/:bidId/documents/:docId/stream',
    (req, reply) => {
      reply.hijack()
      const raw = reply.raw
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })
      raw.write(': connected\n\n')
      const send = (data: unknown) => {
        if (!raw.destroyed) raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }
      void BidDocumentRepository.findById(req.params.docId).then((doc) => {
        if (doc?.status === 'completed') { send({ type: 'done', count: 0 }); raw.end(); return }
        if (doc?.status === 'failed') { send({ type: 'error', message: doc.errorMsg ?? '未知错误' }); raw.end(); return }
        const off = onDocEvent(req.params.docId, (event) => {
          send(event)
          if (event.type === 'done' || event.type === 'error') { raw.end(); off(); clearInterval(keepAlive) }
        })
        const keepAlive = setInterval(() => { if (!raw.destroyed) raw.write(': ping\n\n') }, 15000)
        req.raw.on('close', () => { off(); clearInterval(keepAlive) })
      })
    },
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/core-service/src/modules/bid/routes.ts
git commit -m "feat(bid): register all bid routes with auth middleware"
```

---

## Chunk 4：前端 API 客户端扩展 + 投标工作台重构

### Task 7：扩展 bid.api.ts

**Files:**
- Modify: `apps/web/src/lib/api/bid.api.ts`

- [ ] **Step 1: 读取现有 bid.api.ts 内容，追加以下类型和函数**

在现有文件末尾追加：

```typescript
// ─── Bid 主体 ─────────────────────────────────────────────────
export interface BidData {
  id: string
  tenderId: string
  companyId: string
  name: string
  assignedTo?: string
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SUBMITTED' | 'WON' | 'LOST'
  profitMarginPct: number
  totalCost: number
  totalBidPrice: number
  currency: string
  submittedAt?: string
  createdAt: string
  commercial?: BidCommercialData
  technical?: BidTechnicalData
  items?: BidItemData[]
  statusHistory?: BidStatusLogData[]
}

export interface BidCommercialData {
  id: string
  companyName?: string
  registrationNo?: string
  licenses: Array<{ name: string; no: string; expiresAt?: string }>
  keyPersonnel: Array<{ name: string; title: string; certificate?: string; yearsExp?: number; role?: string }>
  pastProjects: Array<{ title: string; client?: string; contractAmount?: number; completedAt?: string; description?: string }>
  companyProfile?: string
}

export interface BidTechnicalData {
  id: string
  constructionMethod?: string
  siteManagement?: string
  safetyMeasures?: string
  qualityControl?: string
  durationDays?: number
  milestonePlan: Array<{ phase: string; startDay: number; endDay: number }>
}

export interface BidStatusLogData {
  id: string
  fromStatus?: string
  toStatus: string
  operatorId: string
  comment?: string
  createdAt: string
}

// ─── API 函数 ─────────────────────────────────────────────────
import apiClient from '../api-client'

export const bidApi = {
  // Bid 主体
  create: (data: { tenderId: string; name?: string; assignedTo?: string; currency?: string }) =>
    apiClient.post<{ success: boolean; data: BidData }>('/api/bids', data),

  getById: (bidId: string) =>
    apiClient.get<{ success: boolean; data: BidData }>(`/api/bids/${bidId}`),

  getByTender: (tenderId: string) =>
    apiClient.get<{ success: boolean; data: BidData[] }>(`/api/tenders/${tenderId}/bids`),

  update: (bidId: string, data: { name?: string; assignedTo?: string }) =>
    apiClient.patch<{ success: boolean; data: BidData }>(`/api/bids/${bidId}`, data),

  changeStatus: (bidId: string, data: { status: string; comment?: string }) =>
    apiClient.patch<{ success: boolean; data: BidData }>(`/api/bids/${bidId}/status`, data),

  applyProfitMargin: (bidId: string, profitMarginPct: number) =>
    apiClient.patch<{ success: boolean; data: BidData }>(`/api/bids/${bidId}/profit-margin`, { profitMarginPct }),

  // 商务标
  getCommercial: (bidId: string) =>
    apiClient.get<{ success: boolean; data: BidCommercialData }>(`/api/bids/${bidId}/commercial`),

  updateCommercial: (bidId: string, data: Partial<BidCommercialData>) =>
    apiClient.patch<{ success: boolean; data: BidCommercialData }>(`/api/bids/${bidId}/commercial`, data),

  // 技术标
  getTechnical: (bidId: string) =>
    apiClient.get<{ success: boolean; data: BidTechnicalData }>(`/api/bids/${bidId}/technical`),

  updateTechnical: (bidId: string, data: Partial<BidTechnicalData>) =>
    apiClient.patch<{ success: boolean; data: BidTechnicalData }>(`/api/bids/${bidId}/technical`, data),

  // 经济标条目
  listItems: (bidId: string) =>
    apiClient.get<{ success: boolean; data: BidItemData[] }>(`/api/bids/${bidId}/items`),

  createItem: (bidId: string, data: Partial<BidItemData>) =>
    apiClient.post<{ success: boolean; data: BidItemData }>(`/api/bids/${bidId}/items`, data),

  updateItem: (bidId: string, itemId: string, data: Partial<BidItemData>) =>
    apiClient.patch<{ success: boolean; data: BidItemData }>(`/api/bids/${bidId}/items/${itemId}`, data),

  deleteItem: (bidId: string, itemId: string) =>
    apiClient.delete(`/api/bids/${bidId}/items/${itemId}`),

  reorderItems: (bidId: string, orderedIds: string[]) =>
    apiClient.patch(`/api/bids/${bidId}/items/reorder`, { orderedIds }),
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api/bid.api.ts
git commit -m "feat(web): extend bid.api.ts with full type definitions and API functions"
```

---

### Task 8：重构 BidWorkspace.tsx — 三标 Tab 工作台

**Files:**
- Modify: `apps/web/src/components/bid/BidWorkspace.tsx`

- [ ] **Step 1: 将 BidWorkspace 重构为三标 Tab 导航组件**

用以下内容替换整个文件：

```tsx
'use client'
// apps/web/src/components/bid/BidWorkspace.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { bidApi, type BidData } from '../../lib/api/bid.api'
import { CommercialTab } from './CommercialTab'
import { TechnicalTab } from './TechnicalTab'
import { EconomicTab } from './EconomicTab'
import { useToast } from '../../hooks/use-toast'

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  DRAFT: { label: '草稿', variant: 'secondary' },
  IN_REVIEW: { label: '审查中', variant: 'default' },
  APPROVED: { label: '已批准', variant: 'default' },
  SUBMITTED: { label: '已提交', variant: 'default' },
  WON: { label: '已中标', variant: 'default' },
  LOST: { label: '已落标', variant: 'destructive' },
}

const NEXT_STATUS: Record<string, { label: string; status: string }> = {
  DRAFT: { label: '提交审查', status: 'IN_REVIEW' },
  IN_REVIEW: { label: '批准', status: 'APPROVED' },
  APPROVED: { label: '提交业主', status: 'SUBMITTED' },
}

interface Props {
  bidId: string
}

export function BidWorkspace({ bidId }: Props) {
  const [bid, setBid] = useState<BidData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    bidApi.getById(bidId)
      .then((res) => setBid(res.data.data))
      .catch(() => toast({ title: '加载失败', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [bidId])

  async function handleStatusChange(status: string) {
    setStatusLoading(true)
    try {
      const res = await bidApi.changeStatus(bidId, { status })
      setBid(res.data.data)
      toast({ title: '状态已更新' })
    } catch {
      toast({ title: '操作失败', variant: 'destructive' })
    } finally {
      setStatusLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!bid) return <div className="p-8 text-gray-500">投标不存在</div>

  const statusInfo = STATUS_MAP[bid.status] ?? { label: bid.status, variant: 'secondary' as const }
  const nextAction = NEXT_STATUS[bid.status]

  return (
    <div className="flex flex-col h-full">
      {/* 顶部信息栏 */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{bid.name}</h1>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              总报价：<span className="font-medium text-gray-800">
                {bid.currency} {Number(bid.totalBidPrice).toLocaleString()}
              </span>
              {' · '}
              总成本：{bid.currency} {Number(bid.totalCost).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => router.back()}>
              返回
            </Button>
            {nextAction && (
              <Button
                size="sm"
                disabled={statusLoading}
                onClick={() => handleStatusChange(nextAction.status)}
              >
                {statusLoading ? '处理中…' : nextAction.label}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 三标 Tab */}
      <Tabs defaultValue="commercial" className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b px-6">
          <TabsList className="h-10">
            <TabsTrigger value="commercial">商务标</TabsTrigger>
            <TabsTrigger value="technical">技术标</TabsTrigger>
            <TabsTrigger value="economic">经济标</TabsTrigger>
          </TabsList>
        </div>
        <div className="flex-1 overflow-auto">
          <TabsContent value="commercial" className="m-0 h-full">
            <CommercialTab bidId={bidId} />
          </TabsContent>
          <TabsContent value="technical" className="m-0 h-full">
            <TechnicalTab bidId={bidId} />
          </TabsContent>
          <TabsContent value="economic" className="m-0 h-full">
            <EconomicTab bidId={bidId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/bid/BidWorkspace.tsx
git commit -m "feat(web): refactor BidWorkspace to three-tab layout"
```

---

## Chunk 5：前端三标 Tab 组件

### Task 9：CommercialTab.tsx（商务标）

**Files:**
- Create: `apps/web/src/components/bid/CommercialTab.tsx`

- [ ] **Step 1: 创建商务标表单组件**

```tsx
'use client'
// apps/web/src/components/bid/CommercialTab.tsx
import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card } from '../ui/card'
import { bidApi, type BidCommercialData } from '../../lib/api/bid.api'
import { useToast } from '../../hooks/use-toast'

interface Props { bidId: string }

export function CommercialTab({ bidId }: Props) {
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const { register, control, handleSubmit, reset } = useForm<BidCommercialData>({
    defaultValues: { licenses: [], keyPersonnel: [], pastProjects: [] },
  })
  const { fields: licenses, append: addLicense, remove: removeLicense } =
    useFieldArray({ control, name: 'licenses' })
  const { fields: personnel, append: addPersonnel, remove: removePersonnel } =
    useFieldArray({ control, name: 'keyPersonnel' })
  const { fields: projects, append: addProject, remove: removeProject } =
    useFieldArray({ control, name: 'pastProjects' })

  useEffect(() => {
    bidApi.getCommercial(bidId)
      .then((res) => res.data.data && reset(res.data.data))
      .catch(() => {})
  }, [bidId])

  async function onSubmit(data: BidCommercialData) {
    setSaving(true)
    try {
      await bidApi.updateCommercial(bidId, data)
      toast({ title: '商务标已保存' })
    } catch {
      toast({ title: '保存失败', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 max-w-3xl">
      {/* 公司基本信息 */}
      <Card className="p-4 space-y-4">
        <h3 className="font-medium text-gray-900">公司基本信息</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>公司名称</Label>
            <Input {...register('companyName')} placeholder="ABC 装修工程有限公司" />
          </div>
          <div>
            <Label>营业执照号</Label>
            <Input {...register('registrationNo')} placeholder="12345678" />
          </div>
        </div>
        <div>
          <Label>公司简介</Label>
          <Textarea {...register('companyProfile')} rows={4} placeholder="公司简介..." />
        </div>
      </Card>

      {/* 资质证书 */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">资质证书</h3>
          <Button type="button" variant="outline" size="sm"
            onClick={() => addLicense({ name: '', no: '', expiresAt: '' })}>
            + 添加证书
          </Button>
        </div>
        {licenses.map((field, idx) => (
          <div key={field.id} className="flex gap-2 items-start">
            <Input {...register(`licenses.${idx}.name`)} placeholder="证书名称" />
            <Input {...register(`licenses.${idx}.no`)} placeholder="证书编号" />
            <Input {...register(`licenses.${idx}.expiresAt`)} placeholder="有效期 YYYY-MM-DD" className="w-40" />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeLicense(idx)}>删除</Button>
          </div>
        ))}
      </Card>

      {/* 关键人员 */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">关键人员</h3>
          <Button type="button" variant="outline" size="sm"
            onClick={() => addPersonnel({ name: '', title: '', certificate: '', yearsExp: 0, role: '' })}>
            + 添加人员
          </Button>
        </div>
        {personnel.map((field, idx) => (
          <div key={field.id} className="grid grid-cols-5 gap-2 items-start">
            <Input {...register(`keyPersonnel.${idx}.name`)} placeholder="姓名" />
            <Input {...register(`keyPersonnel.${idx}.title`)} placeholder="职位" />
            <Input {...register(`keyPersonnel.${idx}.certificate`)} placeholder="资质证书" />
            <Input {...register(`keyPersonnel.${idx}.role`)} placeholder="项目角色" />
            <Button type="button" variant="ghost" size="sm" onClick={() => removePersonnel(idx)}>删除</Button>
          </div>
        ))}
      </Card>

      {/* 业绩案例 */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">业绩案例</h3>
          <Button type="button" variant="outline" size="sm"
            onClick={() => addProject({ title: '', client: '', contractAmount: 0, completedAt: '', description: '' })}>
            + 添加业绩
          </Button>
        </div>
        {projects.map((field, idx) => (
          <div key={field.id} className="space-y-2 border rounded p-3">
            <div className="grid grid-cols-3 gap-2">
              <Input {...register(`pastProjects.${idx}.title`)} placeholder="项目名称" />
              <Input {...register(`pastProjects.${idx}.client`)} placeholder="业主" />
              <Input {...register(`pastProjects.${idx}.completedAt`)} placeholder="完工日期" />
            </div>
            <Textarea {...register(`pastProjects.${idx}.description`)} placeholder="项目描述" rows={2} />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeProject(idx)}>删除</Button>
          </div>
        ))}
      </Card>

      <Button type="submit" disabled={saving}>
        {saving ? '保存中…' : '保存商务标'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/bid/CommercialTab.tsx
git commit -m "feat(web): add CommercialTab component"
```

---

### Task 10：TechnicalTab.tsx（技术标）

**Files:**
- Create: `apps/web/src/components/bid/TechnicalTab.tsx`

- [ ] **Step 1: 创建技术标表单组件**

```tsx
'use client'
// apps/web/src/components/bid/TechnicalTab.tsx
import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Card } from '../ui/card'
import { bidApi, type BidTechnicalData } from '../../lib/api/bid.api'
import { useToast } from '../../hooks/use-toast'

interface Props { bidId: string }

export function TechnicalTab({ bidId }: Props) {
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()
  const { register, control, handleSubmit, reset } = useForm<BidTechnicalData>({
    defaultValues: { milestonePlan: [] },
  })
  const { fields: milestones, append: addMilestone, remove: removeMilestone } =
    useFieldArray({ control, name: 'milestonePlan' })

  useEffect(() => {
    bidApi.getTechnical(bidId)
      .then((res) => res.data.data && reset(res.data.data))
      .catch(() => {})
  }, [bidId])

  async function onSubmit(data: BidTechnicalData) {
    setSaving(true)
    try {
      await bidApi.updateTechnical(bidId, data)
      toast({ title: '技术标已保存' })
    } catch {
      toast({ title: '保存失败', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6 max-w-3xl">
      {/* 施工方案 */}
      <Card className="p-4 space-y-4">
        <h3 className="font-medium text-gray-900">施工方案</h3>
        <div>
          <Label>施工方法描述</Label>
          <Textarea {...register('constructionMethod')} rows={5}
            placeholder="描述主要施工方法、特殊工艺..." />
        </div>
        <div>
          <Label>现场管理方案</Label>
          <Textarea {...register('siteManagement')} rows={4}
            placeholder="现场管理方式、封闭施工措施..." />
        </div>
      </Card>

      {/* 工期计划 */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium text-gray-900">工期计划</h3>
        <div className="w-32">
          <Label>总工期（天）</Label>
          <Input {...register('durationDays', { valueAsNumber: true })} type="number" min={1} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>里程碑节点</Label>
            <Button type="button" variant="outline" size="sm"
              onClick={() => addMilestone({ phase: '', startDay: 1, endDay: 7 })}>
              + 添加里程碑
            </Button>
          </div>
          {milestones.map((field, idx) => (
            <div key={field.id} className="flex gap-2 items-center mb-2">
              <Input {...register(`milestonePlan.${idx}.phase`)} placeholder="阶段名称" className="flex-1" />
              <Input {...register(`milestonePlan.${idx}.startDay`, { valueAsNumber: true })}
                type="number" placeholder="开始天" className="w-24" />
              <Input {...register(`milestonePlan.${idx}.endDay`, { valueAsNumber: true })}
                type="number" placeholder="结束天" className="w-24" />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeMilestone(idx)}>删除</Button>
            </div>
          ))}
        </div>
      </Card>

      {/* 安全与质量 */}
      <Card className="p-4 space-y-4">
        <h3 className="font-medium text-gray-900">安全与质量管理</h3>
        <div>
          <Label>安全措施</Label>
          <Textarea {...register('safetyMeasures')} rows={4}
            placeholder="安全管理措施、合规要求..." />
        </div>
        <div>
          <Label>质量控制方案</Label>
          <Textarea {...register('qualityControl')} rows={4}
            placeholder="质量检验流程、验收标准..." />
        </div>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving ? '保存中…' : '保存技术标'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/bid/TechnicalTab.tsx
git commit -m "feat(web): add TechnicalTab component"
```

---

### Task 11：EconomicTab.tsx（经济标汇总）

**Files:**
- Create: `apps/web/src/components/bid/EconomicTab.tsx`

- [ ] **Step 1: 创建经济标汇总 Tab（含利润率设定 + 进入经济标工作台按钮）**

```tsx
'use client'
// apps/web/src/components/bid/EconomicTab.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Card } from '../ui/card'
import { bidApi, type BidData } from '../../lib/api/bid.api'
import { useToast } from '../../hooks/use-toast'

interface Props { bidId: string }

export function EconomicTab({ bidId }: Props) {
  const [bid, setBid] = useState<BidData | null>(null)
  const [profitMargin, setProfitMargin] = useState<string>('0')
  const [applying, setApplying] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  useEffect(() => {
    bidApi.getById(bidId)
      .then((res) => {
        setBid(res.data.data)
        setProfitMargin(String(res.data.data.profitMarginPct ?? 0))
      })
      .catch(() => {})
  }, [bidId])

  async function applyMargin() {
    setApplying(true)
    try {
      const res = await bidApi.applyProfitMargin(bidId, parseFloat(profitMargin))
      setBid(res.data.data)
      toast({ title: `已应用 ${profitMargin}% 利润率` })
    } catch {
      toast({ title: '应用失败', variant: 'destructive' })
    } finally {
      setApplying(false)
    }
  }

  if (!bid) return <div className="p-6 text-gray-400">加载中…</div>

  const totalCost = Number(bid.totalCost)
  const totalBid = Number(bid.totalBidPrice)
  const actualMargin = totalCost > 0 ? ((totalBid - totalCost) / totalCost * 100).toFixed(1) : '—'

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* 汇总统计 */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">总成本</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">
            {bid.currency} {totalCost.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">总报价</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">
            {bid.currency} {totalBid.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-sm text-gray-500">综合利润率</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{actualMargin}%</p>
        </Card>
      </div>

      {/* 利润率设定 */}
      <Card className="p-4 space-y-3">
        <h3 className="font-medium text-gray-900">统一利润率</h3>
        <p className="text-sm text-gray-500">
          设定后，所有非手动定价条目将按公式重新计算：售价 = 成本价 × (1 + 利润率%)
        </p>
        <div className="flex items-end gap-3">
          <div>
            <Label>利润率 (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={profitMargin}
              onChange={(e) => setProfitMargin(e.target.value)}
              className="w-32"
            />
          </div>
          <Button onClick={applyMargin} disabled={applying}>
            {applying ? '计算中…' : '应用利润率'}
          </Button>
        </div>
      </Card>

      {/* 进入工作台 */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => router.push(`/bids/${bidId}/economic`)}
      >
        进入经济标工作台（详细清单）
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/bid/EconomicTab.tsx
git commit -m "feat(web): add EconomicTab with profit margin and summary"
```

---

## Chunk 6：经济标工作台页面 + 招标详情入口 + 收尾

### Task 12：经济标左右分屏工作台页面

**Files:**
- Create: `apps/web/src/app/(dashboard)/bids/[id]/economic/page.tsx`

> 此页面复用现有的 `BidWorkspace`（文件上传+PDF查看器）骨架，但顶部导航增加返回到三标工作台的链接，
> 左侧清单改为支持手动行内编辑的 BidItemTable。

- [ ] **Step 1: 创建经济标工作台页面**

```tsx
// apps/web/src/app/(dashboard)/bids/[id]/economic/page.tsx
import { EconomicWorkspace } from '../../../../../components/bid/EconomicWorkspace'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EconomicWorkspacePage({ params }: Props) {
  const { id } = await params
  return <EconomicWorkspace bidId={id} />
}
```

- [ ] **Step 2: 创建 EconomicWorkspace 组件**

Create: `apps/web/src/components/bid/EconomicWorkspace.tsx`

```tsx
'use client'
// apps/web/src/components/bid/EconomicWorkspace.tsx
import { useRef, useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useBidDocument } from '../../hooks/useBidDocument'
import { BidItemTable } from './BidItemTable'
import { bidApi, type BidItemData } from '../../lib/api/bid.api'
import { useToast } from '../../hooks/use-toast'

const PdfViewer = dynamic(() => import('./PdfViewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full text-gray-300 text-sm">PDF 载入中…</div>,
})

interface DrawingRegion { page: number; x: number; y: number; w: number; h: number }

function parseRegion(raw?: string): DrawingRegion | null {
  if (!raw) return null
  try { return JSON.parse(raw) as DrawingRegion } catch { return null }
}

interface Props { bidId: string }

export function EconomicWorkspace({ bidId }: Props) {
  const { state, localFileUrl, uploadFile } = useBidDocument(bidId)
  const [manualItems, setManualItems] = useState<BidItemData[]>([])
  const [selectedItem, setSelectedItem] = useState<BidItemData | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // 加载手动填写的条目
  const loadItems = useCallback(() => {
    bidApi.listItems(bidId)
      .then((res) => setManualItems(res.data.data))
      .catch(() => {})
  }, [bidId])

  useEffect(() => { loadItems() }, [loadItems])

  // 合并 AI 解析条目和手动条目（AI 条目优先展示，有数据则覆盖）
  const displayItems = state.items.length > 0 ? state.items : manualItems

  async function handleAddItem() {
    try {
      const res = await bidApi.createItem(bidId, {
        itemName: '新条目',
        quantity: 1,
        unit: '项',
        costPrice: 0,
        sellPrice: 0,
      })
      setManualItems((prev) => [...prev, res.data.data])
    } catch {
      toast({ title: '添加失败', variant: 'destructive' })
    }
  }

  async function handleUpdateItem(itemId: string, data: Partial<BidItemData>) {
    try {
      await bidApi.updateItem(bidId, itemId, data)
      loadItems()
    } catch {
      toast({ title: '保存失败', variant: 'destructive' })
    }
  }

  async function handleDeleteItem(itemId: string) {
    try {
      await bidApi.deleteItem(bidId, itemId)
      setManualItems((prev) => prev.filter((i) => i.id !== itemId))
    } catch {
      toast({ title: '删除失败', variant: 'destructive' })
    }
  }

  const highlightRegion = selectedItem ? parseRegion(selectedItem.drawingRegion) : null

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm">
        <div className="flex items-center gap-3">
          <Link href={`/bids/${bidId}`} className="text-sm text-blue-600 hover:underline">← 返回工作台</Link>
          <h1 className="text-lg font-semibold text-gray-800">经济标工作台</h1>
        </div>
        <div className="flex items-center gap-3">
          {state.processing && (
            <span className="text-sm text-blue-500 animate-pulse">⏳ {state.progressMessage ?? 'AI 解析中…'}</span>
          )}
          {state.completed && (
            <span className="text-sm text-green-600">✓ 解析完成，共 {state.items.length} 项</span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={state.uploading || state.processing}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {state.uploading ? '上传中…' : '上传图纸 PDF'}
          </button>
          <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f) }} />
        </div>
      </div>

      {/* 主体左右分屏 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左：清单 */}
        <div className="w-1/2 border-r flex flex-col bg-white">
          <div className="px-4 py-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">
              工程量清单
              {displayItems.length > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                  {displayItems.length} 项
                </span>
              )}
            </span>
            <button
              onClick={handleAddItem}
              className="text-xs text-blue-600 hover:underline"
            >
              + 手动添加
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {displayItems.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-200 m-4 rounded-lg text-gray-400 cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <p className="text-sm font-medium">上传图纸 PDF，AI 自动解析清单</p>
                <p className="text-xs mt-1">或点击「手动添加」逐行填写</p>
              </div>
            ) : (
              <BidItemTable
                items={displayItems}
                selectedIndex={selectedIndex}
                onSelect={(item, idx) => { setSelectedItem(item); setSelectedIndex(idx) }}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
                editable
              />
            )}
          </div>
        </div>

        {/* 右：PDF 预览 */}
        <div className="w-1/2 flex flex-col bg-gray-100">
          <div className="px-4 py-2 bg-white border-b text-sm font-medium text-gray-600">
            图纸预览
            {selectedItem && <span className="text-blue-500 text-xs ml-2">高亮：{selectedItem.itemName}</span>}
          </div>
          <div className="flex-1 overflow-hidden">
            {localFileUrl
              ? <PdfViewer fileUrl={localFileUrl} highlightRegion={highlightRegion} />
              : <div className="flex items-center justify-center h-full text-gray-300 text-sm">上传图纸后预览</div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/bids/
git add apps/web/src/components/bid/EconomicWorkspace.tsx
git commit -m "feat(web): add economic workspace with split-pane layout and manual item CRUD"
```

---

### Task 13：招标详情页 — 添加「创建投标」按钮和投标列表

**Files:**
- Modify: `apps/web/src/app/(dashboard)/tenders/[id]/page.tsx`

- [ ] **Step 1: 在招标详情页添加「关联投标」区域**

读取现有的 `tenders/[id]/page.tsx`，在文件末尾的 JSX 中，在「AI 评分占位区」之后添加「关联投标」区块：

```tsx
{/* 关联投标列表 */}
<BidListSection tenderId={tender.id} />
```

并新增 `BidListSection` 组件（内联或新建文件 `tenders/[id]/BidListSection.tsx`）：

```tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { bidApi, type BidData } from '../../../../lib/api/bid.api'
import { Badge } from '../../../../components/ui/badge'
import { Button } from '../../../../components/ui/button'
import { useToast } from '../../../../hooks/use-toast'

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', IN_REVIEW: '审查中', APPROVED: '已批准',
  SUBMITTED: '已提交', WON: '已中标', LOST: '已落标',
}

export function BidListSection({ tenderId }: { tenderId: string }) {
  const [bids, setBids] = useState<BidData[]>([])
  const [creating, setCreating] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    bidApi.getByTender(tenderId).then((res) => setBids(res.data.data)).catch(() => {})
  }, [tenderId])

  async function createBid() {
    setCreating(true)
    try {
      const res = await bidApi.create({ tenderId, name: 'A 方案' })
      router.push(`/bids/${res.data.data.id}`)
    } catch {
      toast({ title: '创建失败', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800">关联投标</h3>
        <Button size="sm" onClick={createBid} disabled={creating}>
          {creating ? '创建中…' : '+ 创建投标'}
        </Button>
      </div>
      {bids.length === 0 ? (
        <p className="text-sm text-gray-400">暂无投标方案，点击「创建投标」开始编制。</p>
      ) : (
        <div className="space-y-2">
          {bids.map((bid) => (
            <div
              key={bid.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-white hover:border-blue-300 cursor-pointer"
              onClick={() => router.push(`/bids/${bid.id}`)}
            >
              <span className="font-medium text-gray-800">{bid.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {bid.currency} {Number(bid.totalBidPrice).toLocaleString()}
                </span>
                <Badge variant="secondary">{STATUS_LABEL[bid.status] ?? bid.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/\(dashboard\)/tenders/
git commit -m "feat(web): add BidListSection to tender detail page"
```

---

### Task 14：BidItemTable 扩展 — 行内编辑支持

**Files:**
- Modify: `apps/web/src/components/bid/BidItemTable.tsx`

- [ ] **Step 1: 读取现有 BidItemTable.tsx，在组件 Props 中添加可选的 editable / onUpdate / onDelete**

在现有组件定义中增加以下 props 类型：

```tsx
interface BidItemTableProps {
  items: BidItemData[]
  selectedIndex: number | null
  onSelect: (item: BidItemData, idx: number) => void
  // 以下为可选扩展 props
  editable?: boolean
  onUpdate?: (itemId: string, data: Partial<BidItemData>) => void
  onDelete?: (itemId: string) => void
}
```

在行渲染中，当 `editable=true` 时，将只读 `<td>` 替换为可点击进入编辑状态的内联输入框，失焦时调用 `onUpdate`；最右侧增加删除按钮调用 `onDelete`。

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/bid/BidItemTable.tsx
git commit -m "feat(web): extend BidItemTable with inline edit and delete support"
```

---

### Task 15：最终验证

- [ ] **Step 1: 启动服务验证后端 API**

```bash
./dev.sh start
# 等待服务启动后执行：
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# 拿到 token 后：
curl -X POST http://localhost:8080/api/bids \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"tenderId":"<existing-tender-id>","name":"测试方案"}'
```

Expected: 返回 201 含 `commercial` 和 `technical` 对象

- [ ] **Step 2: 验证前端编译无报错**

```bash
cd apps/web
pnpm build
```

Expected: Build succeeded, no TypeScript errors

- [ ] **Step 3: 最终 Commit**

```bash
git add .
git commit -m "feat: phase 4 bid core flow complete"
```

---

## 实施顺序总结

| Chunk | 内容 | 预计时长 |
|-------|------|---------|
| Chunk 1 | Schema 迁移 | 30 分钟 |
| Chunk 2 | Repositories + Service | 1 小时 |
| Chunk 3 | Handlers + Routes | 45 分钟 |
| Chunk 4 | 前端 API + BidWorkspace 重构 | 1 小时 |
| Chunk 5 | 三标 Tab 组件 | 1 小时 |
| Chunk 6 | 经济标工作台 + 招标入口 + BidItemTable | 1.5 小时 |

> 总计约 5-6 小时，建议按 Chunk 顺序执行，每个 Chunk 完成后可独立验证。

