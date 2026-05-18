# react-pdf 替换 iframe PDF 查看器 实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `PdfViewer.tsx` 从 iframe 方案完全重写为 `react-pdf`，支持点击清单项自动跳页并精确高亮对应区域。

**Architecture:** 重写 `PdfViewer.tsx`，使用 `react-pdf` 的 `<Document>` + `<Page>` 渲染 PDF Canvas，在 `<Page>` 外层包裹 `position:relative` 容器，高亮层用 `position:absolute` 叠加，坐标通过 `drawingRegion` 比例值 × 实际渲染像素尺寸计算。`BidWorkspace.tsx` 和 `BidItemTable.tsx` 无需修改。

**Tech Stack:** `react-pdf@10`（已安装），Next.js 14 App Router，TypeScript，TailwindCSS

**Spec:** `docs/superpowers/specs/2026-05-18-react-pdf-viewer-design.md`

---

## Chunk 1: 配置 pdfjs worker 并重写 PdfViewer

### Task 1: 配置 pdfjs GlobalWorkerOptions

**Files:**
- Modify: `apps/web/src/components/bid/PdfViewer.tsx`

react-pdf v10 依赖 pdfjs-dist worker，必须在使用前配置，否则报错。

- [ ] **Step 1: 查看 react-pdf 版本，确认对应 pdfjs-dist 版本**

```bash
cd apps/web && cat node_modules/react-pdf/package.json | grep '"pdfjs-dist"'
```

Expected output 类似：`"pdfjs-dist": "^4.x.x"`

- [ ] **Step 2: 确认 pdfjs-dist worker 路径**

```bash
ls apps/web/node_modules/pdfjs-dist/build/ | grep worker
```

Expected output：`pdf.worker.min.mjs` 或 `pdf.worker.min.js`

---

### Task 2: 重写 PdfViewer.tsx

**Files:**
- Modify: `apps/web/src/components/bid/PdfViewer.tsx`（完全重写）

- [ ] **Step 1: 用以下内容替换 PdfViewer.tsx**

```tsx
'use client'

// apps/web/src/components/bid/PdfViewer.tsx
// 使用 react-pdf 渲染 PDF，支持多页精确高亮覆盖

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// 配置 pdfjs worker（使用 CDN，避免复制 worker 文件）
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface DrawingRegion {
  page: number
  x: number
  y: number
  w: number
  h: number
}

interface Props {
  fileUrl: string
  highlightRegion?: DrawingRegion | null
}

export function PdfViewer({ fileUrl, highlightRegion }: Props) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState<number>(1)
  // 记录 <Page> 渲染后的实际像素宽高，用于计算高亮框坐标
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  // 是否显示高亮动画（pulse）
  const [isHighlightNew, setIsHighlightNew] = useState(false)

  // 当 highlightRegion 变化时，自动跳转到对应页
  useEffect(() => {
    if (highlightRegion?.page && highlightRegion.page !== currentPage) {
      setCurrentPage(highlightRegion.page)
      // 页面切换后 pageSize 会在 onRenderSuccess 更新，不需要手动清除
    }
    if (highlightRegion) {
      // 触发高亮动画
      setIsHighlightNew(true)
      const timer = setTimeout(() => setIsHighlightNew(false), 1200)
      return () => clearTimeout(timer)
    }
  }, [highlightRegion])

  function handleDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)
  }

  function handleRenderSuccess() {
    // 从 container 中获取 canvas 实际渲染尺寸
    const canvas = containerRef.current?.querySelector('canvas')
    if (canvas) {
      setPageSize({ width: canvas.offsetWidth, height: canvas.offsetHeight })
    }
  }

  // 计算高亮框像素坐标
  const highlightStyle =
    highlightRegion && pageSize && highlightRegion.page === currentPage
      ? {
          left: `${highlightRegion.x * pageSize.width}px`,
          top: `${highlightRegion.y * pageSize.height}px`,
          width: `${highlightRegion.w * pageSize.width}px`,
          height: `${highlightRegion.h * pageSize.height}px`,
        }
      : null

  return (
    <div className="flex flex-col h-full">
      {/* 翻页控制栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b text-sm text-gray-600 shrink-0">
        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="px-2 py-0.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ‹ 上一页
        </button>
        <span className="tabular-nums">
          {currentPage} / {numPages || '—'}
        </span>
        <button
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          className="px-2 py-0.5 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          下一页 ›
        </button>
      </div>

      {/* PDF 渲染区域 */}
      <div className="flex-1 overflow-auto bg-gray-100 flex justify-center py-4">
        <Document
          file={fileUrl}
          onLoadSuccess={handleDocumentLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              PDF 载入中…
            </div>
          }
          error={
            <div className="flex items-center justify-center h-40 text-red-400 text-sm">
              PDF 加载失败
            </div>
          }
        >
          {/* position:relative 包裹层，高亮 div 相对此层定位 */}
          <div ref={containerRef} className="relative shadow-lg">
            <Page
              pageNumber={currentPage}
              width={containerRef.current?.parentElement?.clientWidth
                ? Math.min(containerRef.current.parentElement.clientWidth - 32, 900)
                : undefined}
              onRenderSuccess={handleRenderSuccess}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />

            {/* 高亮覆盖层 */}
            {highlightStyle && (
              <div
                className={`absolute pointer-events-none border-2 border-yellow-400 bg-yellow-200/40 rounded-sm ${
                  isHighlightNew ? 'animate-pulse' : ''
                }`}
                style={highlightStyle}
              />
            )}
          </div>
        </Document>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 保存文件，检查是否有 TypeScript 编译错误**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Expected：无错误，或只有与本次无关的已有错误

---

## Chunk 2: 验证与构建检查

### Task 3: 确认构建通过

**Files:**
- 无新文件

- [ ] **Step 1: 运行 Next.js 构建（仅类型检查，不启动服务）**

```bash
cd apps/web && npx next build 2>&1 | tail -20
```

Expected：成功输出 `Route (app)` 构建摘要，无 TypeScript 错误

- [ ] **Step 2: 如果出现 pdfjs worker 404 错误（运行时）**

这是运行时 CDN 加载问题，不影响构建。如需本地 worker，执行：

```bash
# 复制 worker 到 public 目录
cp apps/web/node_modules/pdfjs-dist/build/pdf.worker.min.mjs apps/web/public/
```

然后将 `PdfViewer.tsx` 中的 workerSrc 改为：
```ts
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
```

- [ ] **Step 3: 启动开发服务器，手动验证功能**

```bash
pnpm dev --filter web
```

验证清单：
1. 上传 PDF 图纸后，右侧能正常渲染 PDF（不是空白 iframe）
2. 点击清单中某一行 → PDF 自动跳转到对应页
3. 高亮框出现在正确位置，黄色半透明
4. 翻页按钮工作正常
5. 无 drawingRegion 数据的清单行点击时不报错

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/components/bid/PdfViewer.tsx
git commit -m "feat: replace iframe with react-pdf for precise multi-page highlight"
```

---

## 验收标准

| # | 标准 | 验证方式 |
|---|------|---------|
| 1 | 点击清单任意行 → PDF 跳到对应页 | 手动测试 |
| 2 | 高亮框精确覆盖对应区域 | 手动测试 |
| 3 | 翻页控制正常 | 手动测试 |
| 4 | 无 drawingRegion 数据时不报错 | 手动测试 |
| 5 | TypeScript 无新增错误 | `npx tsc --noEmit` |
