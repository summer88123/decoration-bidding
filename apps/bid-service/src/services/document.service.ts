// apps/bid-service/src/services/document.service.ts
import type { StorageService, BidItemFromAI } from '@decoration-bidding/shared-types'
import { createLogger } from '@decoration-bidding/shared-utils'
import { BidDocumentRepository } from '../repositories/bid-document.repository.js'
import { BidItemRepository } from '../repositories/bid-item.repository.js'
import { emitDocEvent } from './document-events.js'

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

  async uploadAndProcess(bidId: string, file: Buffer, filename: string) {
    const fileKey = await this.storage.save(file, filename)
    const fileUrl = this.storage.getUrl(fileKey)
    const doc = await BidDocumentRepository.create({ bidId, fileType: 'pdf', fileUrl })

    // 异步处理，不阻塞 HTTP 响应
    this.processAsync(bidId, doc.id, file).catch(async (err: Error) => {
      logger.error({ err, docId: doc.id }, '处理失败')
      emitDocEvent(doc.id, { type: 'error', message: err.message })
      await BidDocumentRepository.updateStatus(doc.id, 'failed', { errorMsg: err.message })
    })

    return { documentId: doc.id, status: 'processing' as const }
  }

  private async processAsync(bidId: string, docId: string, file: Buffer) {
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
    const items = await this.analyzeDrawingStream(pages, (item) => {
      emitDocEvent(docId, { type: 'item', item: item as unknown as Record<string, unknown> })
    })
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
  ): Promise<BidItemFromAI[]> {
    const res = await fetch(`${this.aiServiceUrl}/ai/skills/parse-drawing/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages }),
    })
    if (!res.ok) throw new Error(`ai-agent stream error: ${res.status}`)

    const items: BidItemFromAI[] = []
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw || raw === '[DONE]') continue
        try {
          const parsed = JSON.parse(raw) as { error?: string } & BidItemFromAI
          if (parsed.error) throw new Error(parsed.error)
          items.push(parsed)
          onItem(parsed)
        } catch (e) {
          logger.warn({ err: e }, 'SSE 条目解析失败')
        }
      }
    }
    return items
  }

  getDocumentStatus(docId: string) { return BidDocumentRepository.findById(docId) }
  getBidItems(bidId: string) { return BidItemRepository.findByBidId(bidId) }
}

