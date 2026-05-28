# Bid Document List Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补全「文档列表」能力：① EconomicTab 展示已上传文件名 + 状态 Badge；② 重进经济标工作台时自动回显最近已完成的文档（fileUrl 为本地服务器路径）。

**Architecture:**
- 后端新增 `GET /api/bids/:bidId/documents` 路由，返回该 bid 所有文档列表
- 前端 `bid.api.ts` 新增 `listDocuments` 方法 + `BidDocumentItem` 类型
- `EconomicTab` 使用 `useEffect` 拉取文档列表，渲染文件名 + 状态 Badge
- `useBidDocument` hook 新增 `useEffect` 在 mount 时拉取文档列表，若有 completed 文档则回填 fileUrl 和 items

**Tech Stack:** Fastify 4, Prisma, Next.js 14, React 18, TypeScript

---

## Chunk 1: 后端 — 新增文档列表接口

### Task 1: 在 Repository 新增 `findByBidId` 方法

**Files:**
- Modify: `apps/core-service/src/modules/bid/repositories/bid-document.repository.ts`

- [ ] **Step 1: 在 `BidDocumentRepository` 末尾添加 `findByBidId` 方法**

```ts
findByBidId(bidId: string) {
  return prisma.bidDocument.findMany({
    where: { bidId },
    select: { id: true, originalName: true, status: true, createdAt: true, fileUrl: true },
    orderBy: { createdAt: 'desc' },
  })
},
```

- [ ] **Step 2: 确认 TypeScript 编译无报错**

```bash
cd apps/core-service && pnpm tsc --noEmit 2>&1 | head -20
```

---

### Task 2: 在 Handler 新增 `listDocuments` 方法

**Files:**
- Modify: `apps/core-service/src/modules/bid/handlers/document.handler.ts`

- [ ] **Step 1: 在 `createDocumentHandlers` 返回对象末尾追加 `listDocuments` handler**

```ts
async listDocuments(
  req: FastifyRequest<{ Params: { bidId: string } }>,
  reply: FastifyReply,
) {
  const docs = await BidDocumentRepository.findByBidId(req.params.bidId)
  return reply.send(ok(docs))
},
```

- [ ] **Step 2: 在文件顶部导入 `BidDocumentRepository`**

```ts
import { BidDocumentRepository } from '../repositories/bid-document.repository.js'
```

- [ ] **Step 3: 确认编译无报错**

```bash
cd apps/core-service && pnpm tsc --noEmit 2>&1 | head -20
```

---

### Task 3: 在 routes.ts 注册新路由

**Files:**
- Modify: `apps/core-service/src/modules/bid/routes.ts`

- [ ] **Step 1: 在 `// ── 文件路由` 区域添加 GET 列表路由**（在 upload 路由之前添加，因 Fastify 路由顺序影响匹配）

```ts
app.get('/bids/:bidId/documents', { preHandler: [requireAuth] }, docHandlers.listDocuments as H)
```

- [ ] **Step 2: 重启 core-service 验证路由可访问**

```bash
curl -s http://localhost:8080/api/bids/test-bid/documents | jq .
```

预期输出：`{ "success": true, "data": [] }`（或已有文档列表）

---

## Chunk 2: 前端 API 层

### Task 4: 新增 `BidDocumentItem` 类型和 `listDocuments` 方法

**Files:**
- Modify: `apps/web/src/lib/api/bid.api.ts`

- [ ] **Step 1: 在文件顶部 `DocumentStatus` interface 附近新增类型**

```ts
export interface BidDocumentItem {
  id: string
  originalName: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  fileUrl: string
}
```

- [ ] **Step 2: 在 `bidApi` 对象的 `// ── 经济标条目` 区域前新增方法**

```ts
// ── 文档 ─────────────────────────────────────────────────────
listDocuments: async (bidId: string): Promise<BidDocumentItem[]> => {
  const res = await apiClient.get<{ success: boolean; data: BidDocumentItem[] }>(
    `/api/bids/${bidId}/documents`,
  )
  return res.data.data
},
```

- [ ] **Step 3: 确认前端 TypeScript 编译无报错**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -20
```

---

## Chunk 3: EconomicTab 文件列表 UI

### Task 5: 在 EconomicTab 展示已上传文件列表

**Files:**
- Modify: `apps/web/src/components/bid/EconomicTab.tsx`

- [ ] **Step 1: 新增文档列表 state 和 useEffect**

在 `const [bid, setBid] = useState...` 附近新增：

```ts
const [documents, setDocuments] = useState<import('../../lib/api/bid.api').BidDocumentItem[]>([])

useEffect(() => {
  bidApi.listDocuments(bidId)
    .then(setDocuments)
    .catch(() => {})
}, [bidId])
```

- [ ] **Step 2: 新增状态 Badge 辅助函数**（在组件函数体内，return 之前）

```ts
function statusBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    pending:    { label: '等待中',  className: 'bg-gray-100 text-gray-600' },
    processing: { label: '解析中',  className: 'bg-yellow-100 text-yellow-700' },
    completed:  { label: '已完成',  className: 'bg-green-100 text-green-700' },
    failed:     { label: '失败',    className: 'bg-red-100 text-red-600' },
  }
  const { label, className } = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-500' }
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${className}`}>{label}</span>
}
```

- [ ] **Step 3: 在「进入经济标工作台」按钮之前插入文件列表区块**

```tsx
{/* 已上传文件 */}
{documents.length > 0 && (
  <Card className="p-4 space-y-2">
    <h3 className="font-medium text-gray-900 text-sm">已上传图纸</h3>
    <ul className="space-y-1">
      {documents.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between text-sm py-1">
          <span className="text-gray-700 truncate max-w-xs">
            {doc.originalName ?? '未命名文件'}
          </span>
          {statusBadge(doc.status)}
        </li>
      ))}
    </ul>
  </Card>
)}
```

- [ ] **Step 4: 在浏览器中打开投标工作台经济标 Tab，确认文件列表展示正常**

访问 `http://localhost:3000/bids/test-bid`，切换到「经济标」Tab，确认已上传文件区域正常渲染（若无数据则不显示）。

---

## Chunk 4: EconomicWorkspace 文件回显

### Task 6: useBidDocument hook 新增 mount 时回显逻辑

**Files:**
- Modify: `apps/web/src/hooks/useBidDocument.ts`

- [ ] **Step 1: 导入 `useEffect`**（已有 `useState, useRef, useCallback`，追加 `useEffect`）

```ts
import { useState, useRef, useCallback, useEffect } from 'react'
```

- [ ] **Step 2: 导入 `BidDocumentItem` 类型**

```ts
import { bidApi, type BidItemData, type BidDocumentItem } from '../lib/api/bid.api'
```

- [ ] **Step 3: 新增 `lastDocument` state**（在 `esRef` 声明之后）

```ts
const [lastDocument, setLastDocument] = useState<BidDocumentItem | null>(null)
```

- [ ] **Step 4: 在 `uploadFile` callback 之后，return 之前，新增 mount effect**

```ts
// mount 时拉取文档列表，若存在 completed 文档则回显
useEffect(() => {
  let cancelled = false
  bidApi.listDocuments(bidId).then((docs) => {
    if (cancelled) return
    const completed = docs.find((d) => d.status === 'completed')
    if (!completed) return
    setLastDocument(completed)
    setLocalFileUrl(completed.fileUrl)
    void bidApi.getBidItems(bidId).then((items) => {
      if (cancelled) return
      setState((s) => ({ ...s, completed: true, items }))
    })
  }).catch(() => {})
  return () => { cancelled = true }
}, [bidId])
```

- [ ] **Step 5: 将 `lastDocument` 加入 hook 返回值**

```ts
return { state, localFileUrl, uploadFile, lastDocument }
```

---

### Task 7: EconomicWorkspace 使用回显的 fileUrl

**Files:**
- Modify: `apps/web/src/components/bid/EconomicWorkspace.tsx`

- [ ] **Step 1: 读取 `EconomicWorkspace.tsx` 当前全文，确认 `localFileUrl` 的使用位置**

- [ ] **Step 2: 解构 `lastDocument` 并在空状态判断中考虑已有文档**

找到渲染空状态（上传虚线框）的条件，通常类似：
```tsx
{!localFileUrl ? (
  // 上传区域
) : (
  // PdfViewer + BidItemTable
)}
```

确保当 `localFileUrl` 已通过 `useEffect` 回填时，直接显示工作台视图而非空状态。
这个逻辑依赖 `setLocalFileUrl` 在 effect 中被调用，**无需额外修改**，只需验证行为正确。

- [ ] **Step 3: 浏览器验证回显**

1. 上传一个 PDF 并等待解析完成
2. 刷新页面或重新进入 `/bids/[id]/economic`
3. 确认：PDF 预览恢复、清单列表恢复、不再显示空状态上传框

---

## Chunk 5: 提交

- [ ] **Step 1: 确认全部功能正常**

```bash
cd apps/core-service && pnpm tsc --noEmit 2>&1
cd apps/web && pnpm tsc --noEmit 2>&1
```

- [ ] **Step 2: 提交**

```bash
git add apps/core-service/src/modules/bid/repositories/bid-document.repository.ts \
        apps/core-service/src/modules/bid/handlers/document.handler.ts \
        apps/core-service/src/modules/bid/routes.ts \
        apps/web/src/lib/api/bid.api.ts \
        apps/web/src/components/bid/EconomicTab.tsx \
        apps/web/src/hooks/useBidDocument.ts
git commit -m "feat(bid): add document list API and restore file on re-entry"
```
