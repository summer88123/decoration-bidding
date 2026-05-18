'use client'

// apps/web/src/components/bid/PdfViewer.tsx
// 使用浏览器原生 <iframe> 渲染 PDF，避免 pdfjs-dist 与 webpack 的兼容性问题

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
  return (
    <div className="relative w-full h-full">
      <iframe
        src={fileUrl}
        className="w-full h-full border-0 bg-white"
        title="PDF 图纸预览"
      />
      {/* 高亮覆盖层：浮于 iframe 之上（仅第 1 页有效；跨页场景需配合 pdfjs） */}
      {highlightRegion && highlightRegion.page === 1 && (
        <div
          className="absolute pointer-events-none border-2 border-yellow-400 bg-yellow-200/30"
          style={{
            left: `${highlightRegion.x * 100}%`,
            top: `${highlightRegion.y * 100}%`,
            width: `${highlightRegion.w * 100}%`,
            height: `${highlightRegion.h * 100}%`,
          }}
        />
      )}
    </div>
  )
}
