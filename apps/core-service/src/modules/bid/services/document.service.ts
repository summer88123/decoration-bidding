// apps/bid-service/src/services/document.service.ts
import { Agent, fetch as undiciFetch } from 'undici'
import type { StorageService, BidItemFromAI } from '@decoration-bidding/shared-types'
import { createLogger } from '@decoration-bidding/shared-utils'
import { BidDocumentRepository } from '../repositories/bid-document.repository.js'
import { BidItemRepository } from '../repositories/bid-item.repository.js'
import { emitDocEvent } from './document-events.js'

// 长时间 SSE 连接使用此 dispatcher，禁用 body timeout（避免 undici BodyTimeoutError）
const longRunningAgent = new Agent({ bodyTimeout: 0, headersTimeout: 60_000 })

const logger = createLogger('document-service')

interface ParsedPage {
  pageNum: number
  text: string
  imageBase64: string
  width: number
  height: number
}

export class DocumentService {
  constructor(
    private readonly storage: StorageService,
    private readonly bimServiceUrl: string,
    private readonly aiServiceUrl: string,
  ) {}

  async uploadAndProcess(bidId: string, file: Buffer, filename: string, userEmail?: string) {
    const fileKey = await this.storage.save(file, filename)
    const fileUrl = this.storage.getUrl(fileKey)
    const doc = await BidDocumentRepository.create({ bidId, fileType: 'pdf', fileUrl })

    // 异步处理，不阻塞 HTTP 响应
    this.processAsync(bidId, doc.id, file, userEmail).catch(async (err: Error) => {
      logger.error({ err, docId: doc.id }, '处理失败')
      emitDocEvent(doc.id, { type: 'error', message: err.message })
      await BidDocumentRepository.updateStatus(doc.id, 'failed', { errorMsg: err.message })
    })

    return { documentId: doc.id, status: 'processing' as const }
  }

  private async processAsync(bidId: string, docId: string, file: Buffer, userEmail?: string) {
    await BidDocumentRepository.updateStatus(docId, 'processing')

    // Step 1: 解析 PDF
    emitDocEvent(docId, { type: 'progress', message: '正在解析 PDF 图纸...' })
    logger.info({ docId }, '开始解析 PDF')
    const t1 = Date.now()
    const pages = await this.parsePdf(file)
    logger.info({ docId, pages: pages.length, ms: Date.now() - t1 }, 'PDF 解析完成')
    await BidDocumentRepository.updateStatus(docId, 'processing', { pageCount: pages.length })
    emitDocEvent(docId, { type: 'progress', message: `PDF 解析完成，共 ${pages.length} 页，正在 AI 分析...` })

    // Step 2: 清除该 bid 旧条目（重新解析时避免数据遗留）
    const deleted = await BidItemRepository.deleteByBidId(bidId)
    logger.info({ docId, bidId, deleted: deleted.count }, '已清除旧 BOQ 条目')

    // Step 3: AI 分析图纸（流式接收条目）
    logger.info({ docId }, '开始 AI 分析，调用 ai-agent 流式端点')
    const t2 = Date.now()
    const items = await this.analyzeDrawingStream(
      pages,
      (item) => {
        // 将 AI 返回的 region 对象转为前端期望的 drawingRegion 字符串格式
        const normalized = {
          ...item,
          drawingPage: item.region?.page,
          drawingRegion: item.region ? JSON.stringify(item.region) : undefined,
        }
        logger.info({ docId, itemName: item.itemName, page: item.region?.page }, `[SSE] 收到条目: ${item.itemName}`)
        emitDocEvent(docId, { type: 'item', item: normalized as unknown as Record<string, unknown> })
      },
      (page, total) => { emitDocEvent(docId, { type: 'progress', message: `正在 AI 分析第 ${page}/${total} 页...` }) },
      userEmail,
    )
    logger.info({ docId, items: items.length, ms: Date.now() - t2 }, 'AI 分析完成')

    // Step 4: 写入数据库
    await BidItemRepository.createManyFromAI(bidId, docId, items)
    await BidDocumentRepository.updateStatus(docId, 'completed')
    emitDocEvent(docId, { type: 'done', count: items.length })
    logger.info({ docId, bidId, items: items.length }, '全部完成，条目已写入数据库')
  }

  private async parsePdf(file: Buffer): Promise<ParsedPage[]> {
    const formData = new FormData()
    formData.append('file', new Blob([file], { type: 'application/pdf' }), 'drawing.pdf')
    const res = await fetch(`${this.bimServiceUrl}/bim/parse-pdf`, { method: 'POST', body: formData })
    if (!res.ok) throw new Error(`bim-service error: ${res.status}`)
    const data = (await res.json()) as {
      pages: Array<{ page_num: number; text: string; image_base64: string; width: number; height: number }>
    }
    return data.pages.map((p) => ({
      pageNum: p.page_num, text: p.text, imageBase64: p.image_base64, width: p.width, height: p.height,
    }))
  }

  /** 调用 ai-agent 流式端点，通过 SSE 逐条接收 BOQ 条目 */
  private async analyzeDrawingStream(
    pages: ParsedPage[],
    onItem: (item: BidItemFromAI) => void,
    onPageProgress?: (page: number, total: number) => void,
    userEmail?: string,
  ): Promise<BidItemFromAI[]> {
    // 超时：页数 × 3 分钟，最少 10 分钟
    const timeoutMs = Math.max(pages.length * 3 * 60 * 1000, 10 * 60 * 1000)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      logger.error({ pages: pages.length, timeoutMs }, 'analyzeDrawingStream 超时，中止连接')
      controller.abort()
    }, timeoutMs)

    try {
      const res = await undiciFetch(`${this.aiServiceUrl}/ai/skills/parse-drawing/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages, userEmail }),
        signal: controller.signal,
        dispatcher: longRunningAgent,
      })
      if (!res.ok) throw new Error(`ai-agent stream error: ${res.status}`)

      const items: BidItemFromAI[] = []
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const processLines = (lines: string[]) => {
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (!raw || raw === '[DONE]') continue
          try {
            const parsed = JSON.parse(raw) as { type?: string; error?: string; page?: number; total?: number } & BidItemFromAI
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.type === 'page_progress') {
              onPageProgress?.(parsed.page ?? 0, parsed.total ?? 0)
            } else if (parsed.itemName && typeof parsed.itemName === 'string' && parsed.itemName.trim()) {
              items.push(parsed)
              onItem(parsed)
            } else {
              logger.warn({ parsed }, 'SSE 收到无效条目（itemName 为空），已跳过')
            }
          } catch (e) {
            logger.warn({ err: e }, 'SSE 条目解析失败')
          }
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // 流结束后冲洗解码器，处理 buffer 中残留的最后一行
          buffer += decoder.decode()
          if (buffer.trim()) processLines(buffer.split('\n'))
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        processLines(lines)
      }
      return items
    } finally {
      clearTimeout(timer)
    }
  }

  getDocumentStatus(docId: string) { return BidDocumentRepository.findById(docId) }
  getBidItems(bidId: string) { return BidItemRepository.findByBidId(bidId) }
}

