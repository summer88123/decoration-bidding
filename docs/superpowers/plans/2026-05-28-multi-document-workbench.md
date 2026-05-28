# Multi-Document Economic Workbench Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每份图纸文档维护独立 BOQ 清单；工作台支持文档切换，PDF 预览和条目列表联动显示对应文档内容。

**Architecture:**
- 后端：`deleteByDocumentId` 替代 `deleteByBidId`（上传新文档只清空自己的旧条目）；`getBidItems` 支持 `documentId` 过滤参数；新增 `GET /api/bids/:bidId/items?documentId=` 查询支持
- 前端：`EconomicWorkspace` 新增文档选择面板（左侧或顶部），切换文档时更新 PDF URL 和条目过滤；`useBidDocument` 调整为按选中文档拉取条目

**Tech Stack:** Fastify 4, Prisma, Next.js 14, React 18, TypeScript

---

## Chunk 1: 后端 — 按文档粒度管理条目

### Task 1: Repository 新增 `deleteByDocumentId` + `findByDocumentId`

**Files:**
- Modify: `apps/core-service/src/modules/bid/repositories/bid-item.repository.ts`

- [ ] **Step 1: 阅读 bid-item.repository.ts 全文，确认现有方法**

- [ ] **Step 2: 新增 `deleteByDocumentId` 方法**

```ts
deleteByDocumentId(documentId: string) {
  return prisma.bidItem.deleteMany({ where: { documentId } })
},
```

- [ ] **Step 3: 修改 `findByBidId` 支持可选 `documentId` 过滤**

```ts
findByBidId(bidId: string, documentId?: string) {
  return prisma.bidItem.findMany({
    where: { bidId, ...(documentId ? { documentId } : {}) },
    orderBy: { sortOrder: 'asc' },
  })
},
```

- [ ] **Step 4: 编译验证**

```bash
cd apps/core-service && pnpm tsc --noEmit 2>&1 | head -20
```

---

### Task 2: `document.service.ts` — 按文档 ID 删除旧条目

**Files:**
- Modify: `apps/core-service/src/modules/bid/services/document.service.ts`

- [ ] **Step 1: 将 `deleteByBidId(bidId)` 改为 `deleteByDocumentId(docId)`**

找到以下代码：
```ts
// Step 2: 清除该 bid 旧条目（重新解析时避免数据遗留）
const deleted = await BidItemRepository.deleteByBidId(bidId)
logger.info({ docId, bidId, deleted: deleted.count }, '已清除旧 BOQ 条目')
```

替换为：
```ts
// Step 2: 清除本文档旧条目（只清自己，不影响其他文档的条目）
const deleted = await BidItemRepository.deleteByDocumentId(docId)
logger.info({ docId, bidId, deleted: deleted.count }, '已清除本文档旧 BOQ 条目')
```

- [ ] **Step 2: 编译验证**

```bash
cd apps/core-service && pnpm tsc --noEmit 2>&1 | head -20
```

---

### Task 3: `bid-items.handler.ts` — list 接口支持 `documentId` 查询参数

**Files:**
- Modify: `apps/core-service/src/modules/bid/handlers/bid-items.handler.ts`

- [ ] **Step 1: 阅读 bid-items.handler.ts 全文**

- [ ] **Step 2: 修改 list handler，从 query 读取 `documentId` 并透传给 repository**

找到 list handler 中调用 repository 查询的行，添加 `documentId` 过滤：

```ts
async list(
  req: FastifyRequest<{ Params: { bidId: string }; Querystring: { documentId?: string } }>,
  reply: FastifyReply,
) {
  const items = await BidItemRepository.findByBidId(req.params.bidId, req.query.documentId)
  return reply.send(ok(items))
},
```

- [ ] **Step 3: 编译验证**

```bash
cd apps/core-service && pnpm tsc --noEmit 2>&1 | head -20
```

---

## Chunk 2: 前端 API 层

### Task 4: 更新 `bidApi.listItems` 支持 `documentId` 参数

**Files:**
- Modify: `apps/web/src/lib/api/bid.api.ts`

- [ ] **Step 1: 修改 `listItems` 方法，支持可选 `documentId` 参数**

```ts
listItems: (bidId: string, documentId?: string) => {
  const params = documentId ? { documentId } : {}
  return apiClient.get(`/api/bids/${bidId}/items`, { params })
},
```

同时修改 `getBidItems`：

```ts
getBidItems: async (bidId: string, documentId?: string): Promise<BidItemData[]> => {
  const params = documentId ? { documentId } : {}
  const res = await apiClient.get<{ success: boolean; data: BidItemData[] }>(
    `/api/bids/${bidId}/items`,
    { params },
  )
  return res.data.data
},
```

- [ ] **Step 2: 前端编译验证**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -20
```

---

## Chunk 3: EconomicWorkspace 文档切换 UI

### Task 5: 阅读 EconomicWorkspace.tsx 全文

**Files:**
- Read: `apps/web/src/components/bid/EconomicWorkspace.tsx`

- [ ] **Step 1: 阅读全文（约 200 行），理解当前布局结构**

---

### Task 6: 新增文档选择面板 + 联动逻辑

**Files:**
- Modify: `apps/web/src/components/bid/EconomicWorkspace.tsx`

- [ ] **Step 1: 新增文档列表 state 和加载逻辑**

在组件顶部（现有 state 之后）添加：

```ts
const [documents, setDocuments] = useState<import('../../lib/api/bid.api').BidDocumentItem[]>([])
const [selectedDocId, setSelectedDocId] = useState<string | undefined>()
const [selectedFileUrl, setSelectedFileUrl] = useState<string | undefined>()
```

在 `useEffect`（loadItems）之后添加文档列表加载：

```ts
useEffect(() => {
  bidApi.listDocuments(bidId)
    .then((docs) => {
      setDocuments(docs)
      // 若已有回显的 lastDocument，以它为默认选中项
      const defaultDoc = docs.find((d) => d.status === 'completed')
      if (defaultDoc && !selectedDocId) {
        setSelectedDocId(defaultDoc.id)
        setSelectedFileUrl(defaultDoc.fileUrl)
      }
    })
    .catch(() => {})
}, [bidId])
```

- [ ] **Step 2: 切换文档时更新 PDF URL 和条目列表**

添加切换处理函数：

```ts
function handleSelectDoc(doc: import('../../lib/api/bid.api').BidDocumentItem) {
  setSelectedDocId(doc.id)
  setSelectedFileUrl(doc.fileUrl)
  bidApi.getBidItems(bidId, doc.id).then(setManualItems).catch(() => {})
}
```

- [ ] **Step 3: 修改 `fileUrl` 来源优先级**

找到 PDF 预览区域，将 `fileUrl` 来源改为：

```ts
// 优先级：SSE上传中的本地URL > 选中文档URL > useBidDocument回显URL
const fileUrl = localFileUrl ?? selectedFileUrl
```

并修改 PdfViewer 使用 `fileUrl` 而非 `localFileUrl`。

- [ ] **Step 4: 在左侧面板顶部新增文档选择器**

在 `<BidItemTable>` 之前，插入文档列表（仅有多文档时显示）：

```tsx
{/* 文档切换（有多份文档时显示） */}
{documents.length > 1 && (
  <div className="border-b px-4 py-2 space-y-1">
    <p className="text-xs text-gray-500 font-medium">图纸文件</p>
    {documents.map((doc) => (
      <button
        key={doc.id}
        onClick={() => handleSelectDoc(doc)}
        className={`w-full text-left text-xs px-2 py-1.5 rounded truncate transition-colors ${
          selectedDocId === doc.id
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-600 hover:bg-gray-50'
        }`}
      >
        {doc.originalName ?? '未命名'}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 5: 编译验证**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -20
```

---

### Task 7: useBidDocument hook — 默认回显按第一个 completed 文档过滤条目

**Files:**
- Modify: `apps/web/src/hooks/useBidDocument.ts`

- [ ] **Step 1: 修改 mount effect，回显时按 documentId 拉取条目**

将现有 mount effect 中的 `bidApi.getBidItems(bidId)` 改为带 documentId：

```ts
void bidApi.getBidItems(bidId, completed.id).then((items) => {
  if (cancelled) return
  setState((s) => ({ ...s, completed: true, items }))
})
```

- [ ] **Step 2: 编译验证**

```bash
cd apps/web && pnpm tsc --noEmit 2>&1 | head -20
```

---

## Chunk 4: 提交

- [ ] **Step 1: 重启服务验证**

```bash
./dev.sh restart
```

- [ ] **Step 2: 浏览器验证**

1. 上传第一份 PDF，等待解析完成，确认条目正确
2. 上传第二份 PDF，等待解析完成，确认第一份 PDF 条目未被删除
3. 通过文档选择器切换，确认 PDF 预览和条目列表联动
4. 刷新页面后，确认文档列表和最后选中文档的内容正常回显

- [ ] **Step 3: 提交**

```bash
git add \
  apps/core-service/src/modules/bid/repositories/bid-item.repository.ts \
  apps/core-service/src/modules/bid/services/document.service.ts \
  apps/core-service/src/modules/bid/handlers/bid-items.handler.ts \
  apps/web/src/lib/api/bid.api.ts \
  apps/web/src/components/bid/EconomicWorkspace.tsx \
  apps/web/src/hooks/useBidDocument.ts
git commit -m "feat(bid): support multiple documents with independent item lists"
```
