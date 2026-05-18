# 规格书：react-pdf 替换 iframe PDF 查看器

**日期**：2026-05-18  
**状态**：待实现

---

## 背景

现有 `PdfViewer.tsx` 使用浏览器原生 `<iframe src="xxx.pdf#page=N">` 实现 PDF 预览。该方案存在以下缺陷：

1. 高亮覆盖层因跨域限制**只对第 1 页有效**，多页无法精确框选
2. 每次切换页面需要重新 `key` 强制重载 iframe，体验差
3. 无法控制 PDF 渲染缩放比例，高亮坐标映射不可靠

---

## 目标

用 `react-pdf`（基于 `pdfjs-dist`）替换 iframe，实现：

- 点击清单项 → 自动跳转到 `drawingPage` 对应页码
- 在对应页面上精确渲染半透明高亮框（使用 `drawingRegion` 的 x/y/w/h 比例坐标）
- 支持翻页控制
- 首次加载性能可接受

---

## 组件设计

### PdfViewer（完全重写）

```
PdfViewer
├── props: { fileUrl: string, highlightRegion?: DrawingRegion | null }
├── <Document> — 加载 PDF，onLoadSuccess 拿到总页数
├── <Page pageNumber={currentPage} onRenderSuccess={...}> — 渲染当前页
├── 高亮覆盖层 <div>  — position:absolute，叠在 Page 上方
│     坐标 = drawingRegion.{x,y,w,h} × 实际渲染尺寸（px）
└── 翻页控制栏（上一页 / 页码 / 下一页）
```

**坐标计算方式**：
- `react-pdf` 的 `<Page>` 渲染后，通过 `onRenderSuccess` 回调获得实际宽高
- 高亮 div 的 left/top/width/height = `region.{x,y,w,h} × pageWidth/pageHeight`
- 使用 `position: relative` 包裹 `<Page>` 和覆盖层

**自动跳页逻辑**：
- `useEffect` 监听 `highlightRegion`，当 `highlightRegion.page` 变化时 `setCurrentPage(highlightRegion.page)`

**高亮动画**：
- 新选中时触发 CSS `animate-pulse` 1 秒，之后保持静态高亮框

### 依赖变更

```bash
# apps/web 安装
pnpm add react-pdf
# react-pdf 自带 pdfjs-dist，需配置 worker
```

**Worker 配置**（Next.js 14 App Router）：
- 在 `PdfViewer.tsx` 顶部设置 `pdfjs.GlobalWorkerOptions.workerSrc`
- 使用 CDN：`https://unpkg.com/pdfjs-dist@<version>/build/pdf.worker.min.js`
- 或复制 worker 到 `public/` 目录

### DrawingRegion 类型

```ts
// 与后端 drawingRegion JSON 字段对应（比例值，0-1）
interface DrawingRegion {
  page: number  // 1-indexed
  x: number     // 左上角 x
  y: number     // 左上角 y
  w: number     // 宽度
  h: number     // 高度
}
```

该类型定义存在于多处，迁移时统一到 `shared-types` 包（可选，不在本次范围）。

---

## 不在本次范围

- 多文档切换
- 缩放控制（使用 react-pdf 默认宽度 100%）
- 关键词搜索高亮
- DrawingRegion 类型迁移到 shared-types

---

## 验收标准

1. 点击清单任意行（含非第 1 页）→ PDF 自动跳到对应页
2. 高亮框精确覆盖清单项对应区域，用黄色半透明显示
3. 翻页控制正常工作
4. 无 drawingRegion 数据时，仍然可以正常翻页，不报错
5. 构建无类型错误
