// apps/bid-service/src/repositories/bid-item.repository.ts
import { prisma } from '@decoration-bidding/database'
import type { BidItemFromAI } from '@decoration-bidding/shared-types'

export const BidItemRepository = {
  findByBidId(bidId: string) {
    return prisma.bidItem.findMany({ where: { bidId }, orderBy: { sortOrder: 'asc' } })
  },

  /** 删除该 bid 下所有条目（重新解析前调用） */
  deleteByBidId(bidId: string) {
    return prisma.bidItem.deleteMany({ where: { bidId } })
  },

  createManyFromAI(bidId: string, documentId: string, items: BidItemFromAI[]) {
    const validItems = items.filter(
      (item) => item.itemName && typeof item.itemName === 'string' && item.itemName.trim(),
    )
    if (validItems.length !== items.length) {
      console.warn(`[BidItemRepository] 过滤掉 ${items.length - validItems.length} 条无效条目（itemName 为空）`)
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
        drawingPage: item.region?.page ?? null,
        drawingRegion: item.region ? JSON.stringify(item.region) : null,
        sortOrder: idx,
      })),
    })
  },
}

