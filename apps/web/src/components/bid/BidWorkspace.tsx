'use client'

// apps/web/src/components/bid/BidWorkspace.tsx
import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useBidDocument } from '../../hooks/useBidDocument'
import { BidItemTable } from './BidItemTable'
import type { BidItemData } from '../../lib/api/bid.api'

// PdfViewer 使用浏览器原生 <iframe> 渲染 PDF，通过 dynamic 确保只在客户端加载
const PdfViewer = dynamic(() => import('./PdfViewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-gray-300 text-sm">PDF 载入中…</div>
  ),
})

interface DrawingRegion {
  page: number
  x: number
  y: number
  w: number
  h: number
}

function parseRegion(raw?: string): DrawingRegion | null {
  if (!raw) return null
  try { return JSON.parse(raw) as DrawingRegion } catch { return null }
}

interface Props {
  bidId: string
}

export function BidWorkspace({ bidId }: Props) {
  const { state, localFileUrl, uploadFile } = useBidDocument(bidId)
  const [selectedItem, setSelectedItem] = useState<BidItemData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type === 'application/pdf') void uploadFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) void uploadFile(file)
  }

  const highlightRegion = selectedItem ? parseRegion(selectedItem.drawingRegion) : null

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800">
          标书工作台
          <span className="ml-2 text-sm font-normal text-gray-400">#{bidId}</span>
        </h1>
        <div className="flex items-center gap-3">
          {state.processing && (
            <span className="text-sm text-blue-500 animate-pulse">
              ⏳ {state.progressMessage ?? 'AI 解析中…'}
            </span>
          )}
          {state.failed && (
            <span className="text-sm text-red-500">解析失败：{state.errorMsg}</span>
          )}
          {state.completed && (
            <span className="text-sm text-green-600">✓ 解析完成，共 {state.items.length} 项</span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={state.uploading || state.processing}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {state.uploading ? '上传中…' : '上传图纸 PDF'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Main — split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: BOQ table */}
        <div className="w-1/2 border-r flex flex-col bg-white">
          <div className="px-4 py-2 border-b text-sm font-medium text-gray-600 flex items-center gap-2">
            物料清单（BOQ）
            {state.items.length > 0 && (
              <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                {state.items.length} 项
              </span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {!localFileUrl && !state.completed ? (
              <div
                className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-200 m-4 rounded-lg text-gray-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium">拖拽 PDF 图纸到此处</p>
                <p className="text-xs mt-1">或点击上传</p>
              </div>
            ) : state.processing && state.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm">{state.progressMessage ?? 'AI 正在分析图纸，请稍候…'}</p>
              </div>
            ) : (
              <>
                {state.processing && (
                  <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 text-xs text-blue-600 flex items-center gap-2">
                    <span className="inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    {state.progressMessage ?? 'AI 解析中，条目陆续出现…'}
                  </div>
                )}
                <BidItemTable
                  items={state.items}
                  selectedId={selectedItem?.id}
                  onSelect={setSelectedItem}
                />
              </>
            )}
          </div>
        </div>

        {/* Right: PDF viewer */}
        <div className="w-1/2 flex flex-col bg-gray-100">
          <div className="px-4 py-2 bg-white border-b text-sm font-medium text-gray-600 flex items-center gap-2">
            图纸预览
            {selectedItem && (
              <span className="text-blue-500 text-xs">
                高亮：{selectedItem.itemName}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {localFileUrl ? (
              <PdfViewer fileUrl={localFileUrl} highlightRegion={highlightRegion} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-300 text-sm">
                上传图纸后预览
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
