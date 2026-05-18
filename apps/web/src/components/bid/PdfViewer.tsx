'use client'

// apps/web/src/components/bid/PdfViewer.tsx
// 使用 react-pdf 渲染 PDF，支持多页精确高亮覆盖

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Turbopack（Next.js 16 默认）不支持 new URL() worker 模式
// 使用 public 目录中的静态 worker 文件（由 postinstall 脚本自动同步）
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

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
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  // 是否显示高亮动画（pulse）
  const [isHighlightNew, setIsHighlightNew] = useState(false)
  // 用于动态计算 Page 宽度
  const [pageWidth, setPageWidth] = useState<number | undefined>(undefined)

  // 计算容器宽度，随窗口 resize 更新
  useEffect(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      if (w > 0) setPageWidth(Math.min(w - 32, 900))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 当 highlightRegion 变化时，自动跳转到对应页并触发高亮动画
  useEffect(() => {
    if (highlightRegion?.page && highlightRegion.page !== currentPage) {
      setCurrentPage(highlightRegion.page)
      setPageSize(null) // 切换页面时重置，等待 onRenderSuccess 更新
    }
    if (highlightRegion) {
      setIsHighlightNew(true)
      const timer = setTimeout(() => setIsHighlightNew(false), 1200)
      return () => clearTimeout(timer)
    }
  }, [highlightRegion])

  function handleDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n)
  }

  function handleRenderSuccess() {
    // 通过 canvas 元素获取实际渲染像素尺寸
    const canvas = containerRef.current?.querySelector('canvas')
    if (canvas) {
      setPageSize({ width: canvas.offsetWidth, height: canvas.offsetHeight })
    }
  }

  // 计算高亮框像素坐标（仅当前页且有尺寸数据时才显示）
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
      <div ref={scrollAreaRef} className="flex-1 overflow-auto bg-gray-100 flex justify-center py-4">
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
              width={pageWidth}
              onRenderSuccess={handleRenderSuccess}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />

            {/* 高亮覆盖层：黄色半透明框，叠加在 Canvas 上 */}
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
