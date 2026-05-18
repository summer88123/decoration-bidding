# PDF 图纸上传 → AI 物料清单生成 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 PDF 图纸上传、AI 解析生成物料清单（BOQ）、前端左右分屏展示的完整业务流程。

**Architecture:** bid-service 接收上传并触发解析；bim-service（Python）用 PyMuPDF 提取文字和页面图片；ai-agent-service 调用 GPT-4o vision 生成带 bbox 坐标的 BOQ 清单；前端左右分屏展示列表与 PDF，点击定位高亮。

**Tech Stack:** Fastify 4, PyMuPDF (fitz), OpenAI GPT-4o vision, react-pdf, Zod, Prisma, Vitest, pytest

---

## 文件结构总览

### 新建文件

```
packages/shared-types/src/index.ts          ← 新增 StorageService 接口、DrawingRegion、BidItemAI 类型
packages/database/prisma/schema.prisma      ← BidDocument 新增 status/errorMsg 字段

apps/bid-service/src/
  storage/
    storage.interface.ts                    ← StorageService 接口
    local-storage.service.ts               ← 本地文件存储实现
    storage.factory.ts                     ← 根据 STORAGE_DRIVER 返回实现
  repositories/bid-document.repository.ts  ← BidDocument CRUD
  repositories/bid-item.repository.ts      ← BidItem CRUD
  services/document.service.ts            ← 上传 + 触发解析编排
  handlers/document.handler.ts            ← HTTP 处理函数
  routes/documents.route.ts               ← 路由注册

apps/bim-service/src/
  services/pdf_parser.py                   ← PyMuPDF 解析（文字 + 页面图片）
  api/routes.py                           ← 新增 POST /bim/parse-pdf 路由（修改）
  models/schemas.py                       ← 新增 ParsePdfRequest/Response（修改）

apps/ai-agent-service/src/
  services/rag.service.ts                 ← 预留 RAG 占位（本期为空实现）
  skills/parse-drawing.skill.ts           ← Vision LLM 分析，返回 BOQ + bbox
  handlers/skill.handler.ts               ← HTTP 处理函数
  routes/index.ts                         ← 注册 parse-drawing 路由（修改）

apps/web/src/
  app/(dashboard)/bids/[id]/page.tsx      ← 左右分屏页面（修改）
  components/bid/BidItemTable.tsx         ← 物料清单列表组件
  components/bid/PdfViewer.tsx            ← PDF 查看器 + 高亮覆盖层
  hooks/useBidDocument.ts                 ← 上传、轮询状态 hook
  lib/api/bid.api.ts                      ← bid-service API 封装
```

### 修改文件

```
packages/database/prisma/schema.prisma    ← BidDocument 新增 status/errorMsg
apps/bid-service/src/app.ts              ← 注册静态文件服务 + 新路由
apps/bid-service/src/config.ts           ← 新增 STORAGE_DRIVER/UPLOAD_DIR 配置
apps/bid-service/package.json            ← 新增 @fastify/static 依赖
```

---

## Chunk 1: 数据层 — Schema 变更 + 类型定义

### Task 1: 更新 Prisma Schema（BidDocument 新增状态字段）

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: 修改 BidDocument model，新增 status/errorMsg**

将 `BidDocument` 改为：

```prisma
model BidDocument {
  id           String   @id @default(cuid())
  bidId        String
  fileType     String   // pdf | dwg | ifc
  fileUrl      String
  status       String   @default("pending") // pending|processing|completed|failed
  errorMsg     String?
  pageCount    Int?
  drawingLinks String[]
  ifcMetadata  Json?
  createdAt    DateTime @default(now())

  bid      Bid        @relation(fields: [bidId], references: [id])
  bidItems BidItem[]
}
```

同时在 `BidItem` 新增 `documentId` 关联：

```prisma
model BidItem {
  // 在现有字段末尾新增：
  documentId  String?

  bid      Bid          @relation(fields: [bidId], references: [id])
  document BidDocument? @relation(fields: [documentId], references: [id])
}
```

- [ ] **Step 2: 同步数据库**

```bash
cd packages/database
pnpm exec prisma db push
```

期望输出：`Your database is now in sync with your Prisma schema`

- [ ] **Step 3: 重新生成 Prisma Client**

```bash
pnpm exec prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat(db): add BidDocument status fields and BidItem-document relation"
```

---

### Task 2: 更新 shared-types（新增本功能相关类型）

**Files:**
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: 追加以下类型定义**

```ts
// ─── 存储抽象层 ────────────────────────────────────────────────

export interface StorageService {
  save(file: Buffer, filename: string, mimeType?: string): Promise<string>
  getUrl(fileKey: string): string
  delete(fileKey: string): Promise<void>
}

// ─── 图纸解析 ─────────────────────────────────────────────────

export interface DrawingRegion {
  page: number   // 1-indexed
  x: number      // 左上角 x，占页面宽度比例 0-1
  y: number      // 左上角 y，占页面高度比例 0-1
  w: number      // 宽度比例 0-1
  h: number      // 高度比例 0-1
}

export interface BidItemFromAI {
  itemName: string
  quantity: number
  unit: string
  description?: string
  region: DrawingRegion
}

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed'
```

- [ ] **Step 2: 构建 shared-types**

```bash
cd packages/shared-types && pnpm build
```

期望输出：无报错，`dist/` 目录更新

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/index.ts
git commit -m "feat(types): add StorageService, DrawingRegion, BidItemFromAI types"
```



---

## Chunk 2: bid-service — 存储层 + 文件上传

### Task 3: 存储抽象层

**Files:**
- Create: `apps/bid-service/src/storage/storage.interface.ts`
- Create: `apps/bid-service/src/storage/local-storage.service.ts`
- Create: `apps/bid-service/src/storage/storage.factory.ts`

- [ ] **Step 1: 写 storage.interface.ts**

```ts
// apps/bid-service/src/storage/storage.interface.ts
import type { StorageService } from '@decoration-bidding/shared-types'
export type { StorageService }
```

- [ ] **Step 2: 写 local-storage.service.ts**

```ts
// apps/bid-service/src/storage/local-storage.service.ts
import fs from 'node:fs/promises'
import path from 'node:path'
import type { StorageService } from './storage.interface.js'

export class LocalStorageService implements StorageService {
  constructor(private readonly uploadDir: string, private readonly baseUrl: string) {}

  async save(file: Buffer, filename: string): Promise<string> {
    await fs.mkdir(this.uploadDir, { recursive: true })
    const fileKey = `${Date.now()}-${filename}`
    await fs.writeFile(path.join(this.uploadDir, fileKey), file)
    return fileKey
  }

  getUrl(fileKey: string): string {
    return `${this.baseUrl}/uploads/${fileKey}`
  }

  async delete(fileKey: string): Promise<void> {
    await fs.unlink(path.join(this.uploadDir, fileKey)).catch(() => {})
  }
}
```

- [ ] **Step 3: 写 storage.factory.ts**

```ts
// apps/bid-service/src/storage/storage.factory.ts
import { LocalStorageService } from './local-storage.service.js'
import type { StorageService } from './storage.interface.js'

export function createStorageService(
  driver: string,
  uploadDir: string,
  baseUrl: string,
): StorageService {
  if (driver === 'local') return new LocalStorageService(uploadDir, baseUrl)
  throw new Error(`Unknown storage driver: ${driver}`)
}
```

- [ ] **Step 4: 更新 config.ts，追加存储配置**

在 `apps/bid-service/src/config.ts` 的 `config` 对象末尾追加：

```ts
  STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3003',
  BIM_SERVICE_URL: process.env.BIM_SERVICE_URL || 'http://localhost:3008',
  AI_AGENT_SERVICE_URL: process.env.AI_AGENT_SERVICE_URL || 'http://localhost:3005',
```

- [ ] **Step 5: Commit**

```bash
git add apps/bid-service/src/storage/ apps/bid-service/src/config.ts
git commit -m "feat(bid-service): add local storage abstraction"
```

---

### Task 4: BidDocument + BidItem Repository

**Files:**
- Create: `apps/bid-service/src/repositories/bid-document.repository.ts`
- Create: `apps/bid-service/src/repositories/bid-item.repository.ts`

- [ ] **Step 1: 写 bid-document.repository.ts**

```ts
// apps/bid-service/src/repositories/bid-document.repository.ts
import { prisma } from '@decoration-bidding/database'
import type { DocumentStatus } from '@decoration-bidding/shared-types'

export const BidDocumentRepository = {
  create(data: { bidId: string; fileType: string; fileUrl: string }) {
    return prisma.bidDocument.create({ data })
  },
  findById(id: string) {
    return prisma.bidDocument.findUnique({ where: { id } })
  },
  updateStatus(
    id: string,
    status: DocumentStatus,
    extra?: { pageCount?: number; errorMsg?: string },
  ) {
    return prisma.bidDocument.update({ where: { id }, data: { status, ...extra } })
  },
}
```

- [ ] **Step 2: 写 bid-item.repository.ts**

```ts
// apps/bid-service/src/repositories/bid-item.repository.ts
import { prisma } from '@decoration-bidding/database'
import type { BidItemFromAI } from '@decoration-bidding/shared-types'

export const BidItemRepository = {
  findByBidId(bidId: string) {
    return prisma.bidItem.findMany({ where: { bidId }, orderBy: { sortOrder: 'asc' } })
  },
  createManyFromAI(bidId: string, documentId: string, items: BidItemFromAI[]) {
    return prisma.bidItem.createMany({
      data: items.map((item, idx) => ({
        bidId,
        documentId,
        itemName: item.itemName,
        description: item.description ?? null,
        quantity: item.quantity,
        unit: item.unit,
        costPrice: 0,
        sellPrice: 0,
        drawingPage: item.region.page,
        drawingRegion: JSON.stringify(item.region),
        sortOrder: idx,
      })),
    })
  },
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/bid-service/src/repositories/
git commit -m "feat(bid-service): add BidDocument and BidItem repositories"
```

---

### Task 5: DocumentService — 编排上传与解析

**Files:**
- Create: `apps/bid-service/src/services/document.service.ts`

- [ ] **Step 1: 写 document.service.ts（第一部分，constructor + uploadAndProcess）**

```ts
// apps/bid-service/src/services/document.service.ts
import type { StorageService, BidItemFromAI } from '@decoration-bidding/shared-types'
import { BidDocumentRepository } from '../repositories/bid-document.repository.js'
import { BidItemRepository } from '../repositories/bid-item.repository.js'

interface ParsedPage {
  pageNum: number
  text: string
  imageBase64: string
  width: number
  height: number
}

export class DocumentService {
  constructor(
    private readonly storage: StorageService,
    private readonly bimServiceUrl: string,
    private readonly aiServiceUrl: string,
  ) {}

  async uploadAndProcess(bidId: string, file: Buffer, filename: string) {
    const fileKey = await this.storage.save(file, filename)
    const fileUrl = this.storage.getUrl(fileKey)
    const doc = await BidDocumentRepository.create({ bidId, fileType: 'pdf', fileUrl })

    // 异步处理，不阻塞响应
    this.processAsync(bidId, doc.id, file).catch(async (err: Error) => {
      await BidDocumentRepository.updateStatus(doc.id, 'failed', { errorMsg: err.message })
    })

    return { documentId: doc.id, status: 'processing' as const }
  }
```

- [ ] **Step 2: 继续写 document.service.ts（processAsync + parsePdf + analyzeDrawing）**

紧接上方追加：

```ts
  private async processAsync(bidId: string, docId: string, file: Buffer) {
    await BidDocumentRepository.updateStatus(docId, 'processing')
    const pages = await this.parsePdf(file)
    await BidDocumentRepository.updateStatus(docId, 'processing', { pageCount: pages.length })
    const items = await this.analyzeDrawing(pages)
    await BidItemRepository.createManyFromAI(bidId, docId, items)
    await BidDocumentRepository.updateStatus(docId, 'completed')
  }

  private async parsePdf(file: Buffer): Promise<ParsedPage[]> {
    const formData = new FormData()
    formData.append('file', new Blob([file], { type: 'application/pdf' }), 'drawing.pdf')
    const res = await fetch(`${this.bimServiceUrl}/bim/parse-pdf`, { method: 'POST', body: formData })
    if (!res.ok) throw new Error(`bim-service error: ${res.status}`)
    const data = (await res.json()) as { pages: ParsedPage[] }
    return data.pages
  }

  private async analyzeDrawing(pages: ParsedPage[]): Promise<BidItemFromAI[]> {
    const res = await fetch(`${this.aiServiceUrl}/ai/skills/parse-drawing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages }),
    })
    if (!res.ok) throw new Error(`ai-agent error: ${res.status}`)
    const data = (await res.json()) as { items: BidItemFromAI[] }
    return data.items
  }

  getDocumentStatus(docId: string) { return BidDocumentRepository.findById(docId) }
  getBidItems(bidId: string) { return BidItemRepository.findByBidId(bidId) }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/bid-service/src/services/document.service.ts
git commit -m "feat(bid-service): add DocumentService orchestration"
```

---

### Task 6: Handler + Route — HTTP 层

**Files:**
- Create: `apps/bid-service/src/handlers/document.handler.ts`
- Create: `apps/bid-service/src/routes/documents.route.ts`
- Modify: `apps/bid-service/src/app.ts`
- Modify: `apps/bid-service/src/routes/index.ts`
- Modify: `apps/bid-service/package.json`

- [ ] **Step 1: 安装 @fastify/multipart 和 @fastify/static**

```bash
cd apps/bid-service
pnpm add @fastify/multipart @fastify/static
```

- [ ] **Step 2: 写 document.handler.ts**

```ts
// apps/bid-service/src/handlers/document.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { ok, fail } from '@decoration-bidding/shared-utils'
import type { DocumentService } from '../services/document.service.js'

export function createDocumentHandlers(svc: DocumentService) {
  return {
    async upload(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const data = await req.file()
      if (!data) return reply.status(400).send(fail('NO_FILE', '请上传 PDF 文件'))
      const buffer = await data.toBuffer()
      const result = await svc.uploadAndProcess(req.params.bidId, buffer, data.filename)
      return reply.status(202).send(ok(result))
    },

    async getStatus(
      req: FastifyRequest<{ Params: { bidId: string; docId: string } }>,
      reply: FastifyReply,
    ) {
      const doc = await svc.getDocumentStatus(req.params.docId)
      if (!doc) return reply.status(404).send(fail('NOT_FOUND', '文档不存在'))
      return reply.send(ok({ status: doc.status, pageCount: doc.pageCount, errorMsg: doc.errorMsg }))
    },

    async getItems(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const items = await svc.getBidItems(req.params.bidId)
      return reply.send(ok(items))
    },
  }
}
```

- [ ] **Step 3: 写 documents.route.ts**

```ts
// apps/bid-service/src/routes/documents.route.ts
import type { FastifyPluginAsync } from 'fastify'
import { DocumentService } from '../services/document.service.js'
import { createDocumentHandlers } from '../handlers/document.handler.js'
import { createStorageService } from '../storage/storage.factory.js'
import { config } from '../config.js'

export const documentsRoute: FastifyPluginAsync = async (app) => {
  const storage = createStorageService(config.STORAGE_DRIVER, config.UPLOAD_DIR, config.BASE_URL)
  const svc = new DocumentService(storage, config.BIM_SERVICE_URL, config.AI_AGENT_SERVICE_URL)
  const handlers = createDocumentHandlers(svc)

  app.post('/bids/:bidId/documents', handlers.upload)
  app.get('/bids/:bidId/documents/:docId/status', handlers.getStatus)
  app.get('/bids/:bidId/items', handlers.getItems)
}
```

- [ ] **Step 4: 更新 app.ts — 注册 multipart、static 插件和新路由**

在 `apps/bid-service/src/app.ts` 中加入：

```ts
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import path from 'node:path'
import { documentsRoute } from './routes/documents.route.js'
// ...在 buildApp 内部 register 区域追加：
await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }) // 50MB
await app.register(staticFiles, {
  root: path.resolve(config.UPLOAD_DIR),
  prefix: '/uploads/',
})
await app.register(documentsRoute)
```

- [ ] **Step 5: Commit**

```bash
git add apps/bid-service/src/handlers/ apps/bid-service/src/routes/ \
        apps/bid-service/src/app.ts apps/bid-service/package.json
git commit -m "feat(bid-service): add document upload/status/items HTTP routes"
```

---

## Chunk 3: bim-service — PDF 解析路由

### Task 7: pdf_parser.py

**Files:**
- Create: `apps/bim-service/src/services/pdf_parser.py`
- Modify: `apps/bim-service/src/models/schemas.py`
- Modify: `apps/bim-service/src/api/routes.py`

- [x] **Step 1: 写 pdf_parser.py（PyMuPDF，文字 + 72DPI 页面图片）**
- [x] **Step 2: 在 schemas.py 追加 ParsedPageResponse / ParsePdfResponse**
- [x] **Step 3: 在 routes.py 新增 POST /bim/parse-pdf**

---

## Chunk 4: ai-agent-service — parse-drawing Skill

### Task 8: parse-drawing.skill.ts + 路由

**Files:**
- Create: `apps/ai-agent-service/src/skills/parse-drawing.skill.ts`
- Modify: `apps/ai-agent-service/src/routes/index.ts`

- [x] **Step 1: 写 parse-drawing.skill.ts（generateObject + Zod schema）**
- [x] **Step 2: 在 routes/index.ts 注册 POST /ai/skills/parse-drawing**

---

## Chunk 5: 前端 — 左右分屏工作台

### Task 9: 前端组件 + 页面

**Files:**
- Create: `apps/web/src/lib/api/bid.api.ts`
- Create: `apps/web/src/hooks/useBidDocument.ts`
- Create: `apps/web/src/components/bid/BidItemTable.tsx`
- Create: `apps/web/src/components/bid/PdfViewer.tsx`
- Modify: `apps/web/src/app/(dashboard)/bids/[id]/page.tsx`

- [x] **Step 1: bid.api.ts — bidApi.uploadDrawing / getDocumentStatus / getBidItems**
- [x] **Step 2: useBidDocument.ts — 上传 + 轮询 hook**
- [x] **Step 3: BidItemTable.tsx — 物料清单表格，点击行高亮**
- [x] **Step 4: PdfViewer.tsx — react-pdf + 黄色 bbox 高亮覆盖层**
- [x] **Step 5: page.tsx — 左右分屏，drag-drop 上传入口**

---

## 完成状态

所有 Chunk 1-5 已实现完毕（2026-05-15）。
