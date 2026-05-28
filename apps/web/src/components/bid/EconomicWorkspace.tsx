'use client'
// apps/web/src/components/bid/EconomicWorkspace.tsx
import { useRef, useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useBidDocument } from '../../hooks/useBidDocument'
import { BidItemTable } from './BidItemTable'
import { bidApi, type BidItemData } from '../../lib/api/bid.api'
import { useToast } from '../../hooks/use-toast'

const PdfViewer = dynamic(() => import('./PdfViewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-gray-300 text-sm">PDF 载入中…</div>
  ),
})

interface DrawingRegion { page: number; x: number; y: number; w: number; h: number }

function parseRegion(raw?: string): DrawingRegion | null {
  if (!raw) return null
  try { return JSON.parse(raw) as DrawingRegion } catch { return null }
}

interface Props { bidId: string }

export function EconomicWorkspace({ bidId }: Props) {
  const searchParams = useSearchParams()
  const documentId = searchParams.get('documentId') ?? undefined

  const { state, localFileUrl, uploadFile, lastDocument } = useBidDocument(bidId)
  const [manualItems, setManualItems] = useState<BidItemData[]>([])
  const [selectedItem, setSelectedItem] = useState<BidItemData | null>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const loadItems = useCallback((docId?: string) => {
    bidApi.getBidItems(bidId, docId)
      .then(setManualItems)
      .catch(() => {})
  }, [bidId])

  useEffect(() => {
    if (documentId) {
      bidApi.listDocuments(bidId)
        .then((docs) => {
          const doc = docs.find((d) => d.id === documentId)
          if (doc) setSelectedFileUrl(doc.fileUrl)
        })
        .catch(() => {})
      loadItems(documentId)
    } else {
      bidApi.listDocuments(bidId)
        .then((docs) => {
          const defaultDoc = docs.find((d) => d.status === 'completed')
          if (defaultDoc) setSelectedFileUrl(defaultDoc.fileUrl)
          loadItems(undefined)
        })
        .catch(() => { loadItems() })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId, documentId])

  useEffect(() => {
    if (state.completed && lastDocument) {
      setSelectedFileUrl(lastDocument.fileUrl)
      loadItems(lastDocument.id)
    }
  }, [state.completed, lastDocument, loadItems])

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
      loadItems(documentId)
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
  const displayFileUrl = localFileUrl ?? selectedFileUrl

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href={`/bids/${bidId}`}
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            ← 返回工作台
          </Link>
          <h1 className="text-lg font-semibold text-gray-800">经济标工作台</h1>
        </div>
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
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f) }}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
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
              className="text-xs text-blue-600 hover:underline px-2 py-1"
            >
              + 手动添加
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {displayItems.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-200 m-4 rounded-lg text-gray-400 cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium">上传图纸 PDF，AI 自动解析清单</p>
                <p className="text-xs mt-1">或点击「手动添加」逐行填写</p>
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
                  items={displayItems}
                  selectedIndex={selectedIndex}
                  onSelect={(item, idx) => { setSelectedItem(item); setSelectedIndex(idx) }}
                  editable
                  onUpdate={handleUpdateItem}
                  onDelete={handleDeleteItem}
                />
              </>
            )}
          </div>
        </div>

        <div className="w-1/2 flex flex-col bg-gray-100">
          <div className="px-4 py-2 bg-white border-b text-sm font-medium text-gray-600 flex items-center gap-2">
            图纸预览
            {selectedItem && (
              <span className="text-blue-500 text-xs">高亮：{selectedItem.itemName}</span>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {displayFileUrl ? (
              <PdfViewer fileUrl={displayFileUrl} highlightRegion={highlightRegion} />
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
