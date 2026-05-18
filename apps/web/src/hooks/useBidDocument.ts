'use client'

// apps/web/src/hooks/useBidDocument.ts
import { useState, useRef, useCallback } from 'react'
import { bidApi, type BidItemData } from '../lib/api/bid.api'

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

export function useBidDocument(bidId: string) {
  const [state, setState] = useState<UseBidDocumentState>({
    uploading: false, processing: false, completed: false, failed: false, items: [],
  })
  const esRef = useRef<EventSource | null>(null)
  const [localFileUrl, setLocalFileUrl] = useState<string | undefined>()

  const closeSSE = useCallback(() => {
    esRef.current?.close()
    esRef.current = null
  }, [])

   /** 连接到 bid-service SSE 端点，接收实时解析进度 */
  const connectSSE = useCallback(
    (docId: string) => {
      closeSSE()
      // 直连 bid-service（绕过 Next.js rewrite 和 gateway，两者都会缓冲 SSE 响应）
      // bid-service 已设 Access-Control-Allow-Origin: *，CORS 无问题
      const BID_SERVICE_URL = process.env.NEXT_PUBLIC_BID_SERVICE_URL ?? 'http://localhost:3003'
      const es = new EventSource(`${BID_SERVICE_URL}/bids/${bidId}/documents/${docId}/stream`)
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
          void bidApi.getBidItems(bidId).then((items) => {
            setState((s) => ({ ...s, processing: false, completed: true, items, progressMessage: undefined }))
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
            void bidApi.getBidItems(bidId).then((items) => {
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
    async (file: File) => {
      closeSSE()
      setLocalFileUrl(URL.createObjectURL(file))
      setState({ uploading: true, processing: false, completed: false, failed: false, items: [] })
      try {
        const { documentId } = await bidApi.uploadDrawing(bidId, file)
        setState((s) => ({ ...s, uploading: false, processing: true, documentId, progressMessage: '正在上传...' }))
        connectSSE(documentId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : '上传失败'
        setState((s) => ({ ...s, uploading: false, failed: true, errorMsg: msg }))
      }
    },
    [bidId, connectSSE, closeSSE],
  )

  return { state, localFileUrl, uploadFile }
}
