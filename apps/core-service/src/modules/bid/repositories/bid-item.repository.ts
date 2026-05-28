// apps/bid-service/src/repositories/bid-item.repository.ts
import { prisma } from '@decoration-bidding/database'
import { createLogger } from '@decoration-bidding/shared-utils'
import type { BidItemFromAI } from '@decoration-bidding/shared-types'

const logger = createLogger('bid-item-repository')

export const BidItemRepository = {
  findByBidId(bidId: string, documentId?: string) {
    return prisma.bidItem.findMany({
      where: { bidId, ...(documentId ? { documentId } : {}) },
      orderBy: { sortOrder: 'asc' },
    })
  },

  /** 删除该 bid 下所有条目（重新解析前调用） */
  deleteByBidId(bidId: string) {
    return prisma.bidItem.deleteMany({ where: { bidId } })
  },

  /** 删除指定文档的条目（多文档模式下重新解析单个文档时调用） */
  deleteByDocumentId(documentId: string) {
    return prisma.bidItem.deleteMany({ where: { documentId } })
  },

  createManyFromAI(bidId: string, documentId: string, items: BidItemFromAI[]) {
    const validItems = items.filter(
      (item) => item.itemName && typeof item.itemName === 'string' && item.itemName.trim(),
    )
    if (validItems.length !== items.length) {
      logger.warn(`过滤掉 ${items.length - validItems.length} 条无效条目（itemName 为空）`)
    }
    if (validItems.length === 0) return Promise.resolve({ count: 0 })
    return prisma.bidItem.createMany({
      data: validItems.map((item, idx) => ({
        bidId,
        documentId,
        itemName: item.itemName,
        description: item.description ?? null,
        quantity: item.quantity,
        unit: item.unit,
        costPrice: 0,
        sellPrice: 0,
        drawingPage: item.region?.page != null ? String(item.region.page) : null,
        drawingRegion: item.region ? JSON.stringify(item.region) : null,
        sortOrder: idx,
      })),
    })
  },

  // ── 手动 CRUD ───────────────────────────────────────────────

  create(bidId: string, data: {
    itemCode?: string | null
    itemName: string
    description?: string | null
    quantity?: number
    unit?: string | null
    costPrice?: number
    sellPrice?: number
    isSpecial?: boolean
    remark?: string | null
    drawingPage?: string | null
    drawingRegion?: string | null
    sortOrder?: number
  }) {
    return prisma.bidItem.create({ data: { bidId, ...data } })
  },

  update(id: string, data: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return prisma.bidItem.update({ where: { id }, data: data as any })
  },

  delete(id: string) {
    return prisma.bidItem.delete({ where: { id } })
  },

  async reorder(bidId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, idx) =>
      prisma.bidItem.update({ where: { id }, data: { sortOrder: idx } })
    )
    return prisma.$transaction(updates)
  },

  async recalcTotals(bidId: string) {
    const items = await prisma.bidItem.findMany({ where: { bidId } })
    const totalCost = items.reduce((sum, i) => sum + Number(i.costPrice) * Number(i.quantity), 0)
    const totalBidPrice = items.reduce((sum, i) => sum + Number(i.sellPrice) * Number(i.quantity), 0)
    return prisma.bid.update({ where: { id: bidId }, data: { totalCost, totalBidPrice } })
  },
}


