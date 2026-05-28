'use client'

// apps/web/src/hooks/useBidDocument.ts
import { useState, useRef, useCallback, useEffect } from 'react'
import { bidApi, type BidItemData, type BidDocumentItem } from '../lib/api/bid.api'

export interface UseBidDocumentState {
  uploading: boolean
  processing: boolean
  completed: boolean
  failed: boolean
  errorMsg?: string
  documentId?: string
  progressMessage?: string
  items: BidItemData[]
}

export function useBidDocument(bidId: string, initialDocumentId?: string) {
  const [state, setState] = useState<UseBidDocumentState>({
    uploading: false, processing: false, completed: false, failed: false, items: [],
  })
  const esRef = useRef<EventSource | null>(null)
  const [localFileUrl, setLocalFileUrl] = useState<string | undefined>()
  const [lastDocument, setLastDocument] = useState<BidDocumentItem | null>(null)

  const closeSSE = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
  }, [])

   /** 连接到 bid-service SSE 端点，接收实时解析进度 */
  const connectSSE = useCallback(
    (docId: string) => {
      closeSSE()
      // 直连 core-service（绕过 Next.js rewrite，两者都会缓冲 SSE 响应）
      // core-service 已设 Access-Control-Allow-Origin: *，CORS 无问题
      const CORE_SERVICE_URL = process.env.NEXT_PUBLIC_CORE_SERVICE_URL ?? 'http://localhost:8080'
      const es = new EventSource(`${CORE_SERVICE_URL}/api/bids/${bidId}/documents/${docId}/stream`)
      esRef.current = es

      es.onmessage = (e: MessageEvent<string>) => {
        let event: Record<string, unknown>
        try { event = JSON.parse(e.data) as Record<string, unknown> } catch { return }

        if (event.type === 'progress') {
          setState((s) => ({ ...s, progressMessage: event.message as string }))
        } else if (event.type === 'item') {
          // 每拿到一个 BOQ 条目就立即追加到列表（流式体验）
          const item = event.item as BidItemData
          setState((s) => ({ ...s, items: [...s.items, item] }))
        } else if (event.type === 'done') {
          // 解析完成：重新拉取最终条目列表（包含数据库 id 等字段）
          void bidApi.getBidItems(bidId, docId).then((items) => {
            setState((s) => ({ ...s, processing: false, completed: true, items, progressMessage: undefined }))
          })
          // 刷新 lastDocument，让 EconomicWorkspace 感知到最新文档
          void bidApi.listDocuments(bidId).then((docs) => {
            const doc = docs.find((d) => d.id === docId)
            if (doc) setLastDocument(doc)
          })
          closeSSE()
        } else if (event.type === 'error') {
          setState((s) => ({
            ...s, processing: false, failed: true, errorMsg: event.message as string, progressMessage: undefined,
          }))
          closeSSE()
        }
      }

      es.onerror = () => {
        // SSE 连接中断：降级为轮询一次确认最终状态
        closeSSE()
        void bidApi.getDocumentStatus(bidId, docId).then((status) => {
          if (status.status === 'completed') {
            void bidApi.getBidItems(bidId, docId).then((items) => {
              setState((s) => ({ ...s, processing: false, completed: true, items }))
            })
          } else if (status.status === 'failed') {
            setState((s) => ({ ...s, processing: false, failed: true, errorMsg: status.errorMsg }))
          }
        }).catch(() => {
          setState((s) => ({ ...s, processing: false, failed: true, errorMsg: 'SSE 连接中断' }))
        })
      }
    },
    [bidId, closeSSE],
  )

  const uploadFile = useCallback(
    async (file: File, customPrompt?: string) => {
      closeSSE()
      setLocalFileUrl(URL.createObjectURL(file))
      setState({ uploading: true, processing: false, completed: false, failed: false, items: [] })
      try {
        const { documentId } = await bidApi.uploadDrawing(bidId, file, customPrompt)
        setState((s) => ({ ...s, uploading: false, processing: true, documentId, progressMessage: '正在上传...' }))
        connectSSE(documentId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : '上传失败'
        setState((s) => ({ ...s, uploading: false, failed: true, errorMsg: msg }))
      }
    },
    [bidId, connectSSE, closeSSE],
  )

  // mount 时拉取文档列表，若存在 completed 文档则回显（优先使用指定的 documentId）
  useEffect(() => {
    let cancelled = false
    bidApi.listDocuments(bidId).then((docs) => {
      if (cancelled) return
      // 优先用 URL 指定的文档；否则回退到第一个 completed 文档
      const target = initialDocumentId
        ? docs.find((d) => d.id === initialDocumentId && d.status === 'completed')
        : docs.find((d) => d.status === 'completed')
      if (!target) return
      setLastDocument(target)
      setLocalFileUrl(target.fileUrl)
      void bidApi.getBidItems(bidId, target.id).then((items) => {
        if (cancelled) return
        setState((s) => ({ ...s, completed: true, items }))
      })
    }).catch(() => {})
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bidId, initialDocumentId])

  return { state, localFileUrl, uploadFile, lastDocument }
}