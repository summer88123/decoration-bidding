// apps/core-service/src/modules/bid/services/bid.service.ts
import { prisma } from '@decoration-bidding/database'
import { BidRepository } from '../repositories/bid.repository.js'
import { BidStatusRepository } from '../repositories/bid-status.repository.js'
import { BidItemRepository } from '../repositories/bid-item.repository.js'
import { BidCommercialRepository } from '../repositories/bid-commercial.repository.js'
import { BidTechnicalRepository } from '../repositories/bid-technical.repository.js'

export class BidService {
  async createBid(companyId: string, dto: {
    tenderId: string
    name?: string
    assignedTo?: string
    currency?: string
  }) {
    const tender = await prisma.tenderProject.findFirst({
      where: { id: dto.tenderId, companyId },
    })
    if (!tender) {
      throw Object.assign(new Error('招标项目不存在'), { statusCode: 404 })
    }
    return BidRepository.create({ ...dto, companyId })
  }

  async getBid(id: string, companyId: string) {
    const bid = await BidRepository.findById(id, companyId)
    if (!bid) throw Object.assign(new Error('投标不存在'), { statusCode: 404 })
    return bid
  }

  async getBidsByTender(tenderId: string, companyId: string) {
    return BidRepository.findByTenderId(tenderId, companyId)
  }

  async updateBid(id: string, companyId: string, dto: {
    name?: string
    assignedTo?: string
    profitMarginPct?: number
  }) {
    await this.getBid(id, companyId)
    return BidRepository.update(id, dto)
  }

  async changeBidStatus(
    id: string,
    companyId: string,
    operatorId: string,
    dto: { status: string; comment?: string },
  ) {
    const bid = await this.getBid(id, companyId)

    const allowed: Record<string, string[]> = {
      DRAFT: ['IN_REVIEW'],
      IN_REVIEW: ['APPROVED', 'DRAFT'],
      APPROVED: ['SUBMITTED'],
      SUBMITTED: ['WON', 'LOST'],
    }
    if (!allowed[bid.status]?.includes(dto.status)) {
      throw Object.assign(
        new Error(`不允许从 ${bid.status} 变更为 ${dto.status}`),
        { statusCode: 422 },
      )
    }

    await BidStatusRepository.create({
      bidId: id,
      fromStatus: bid.status,
      toStatus: dto.status,
      operatorId,
      comment: dto.comment,
    })

    return BidRepository.updateStatus(id, dto.status)
  }

  async applyProfitMargin(id: string, companyId: string, profitMarginPct: number) {
    await this.getBid(id, companyId)

    const items = await prisma.bidItem.findMany({ where: { bidId: id } })
    const updates = items
      .filter((item) => !item.isManualPrice && !item.isSpecial)
      .map((item) =>
        prisma.bidItem.update({
          where: { id: item.id },
          data: { sellPrice: Number(item.costPrice) * (1 + profitMarginPct / 100) },
        }),
      )

    await prisma.$transaction([
      ...updates,
      prisma.bid.update({ where: { id }, data: { profitMarginPct } }),
    ])

    await BidItemRepository.recalcTotals(id)
    return BidRepository.findById(id, companyId)
  }

  // ── 商务标 ───────────────────────────────────────────────────
  getCommercial(bidId: string) {
    return BidCommercialRepository.findByBidId(bidId)
  }

  updateCommercial(bidId: string, data: Record<string, unknown>) {
    return BidCommercialRepository.upsert(bidId, data)
  }

  // ── 技术标 ───────────────────────────────────────────────────
  getTechnical(bidId: string) {
    return BidTechnicalRepository.findByBidId(bidId)
  }

  updateTechnical(bidId: string, data: Record<string, unknown>) {
    return BidTechnicalRepository.upsert(bidId, data)
  }

  // ── 经济标条目 ────────────────────────────────────────────────
  async createItem(bidId: string, companyId: string, data: Record<string, unknown>) {
    await this.getBid(bidId, companyId)
    const items = await prisma.bidItem.findMany({ where: { bidId } })
    const sortOrder = items.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const item = await BidItemRepository.create(bidId, { ...data, sortOrder } as any)
    await BidItemRepository.recalcTotals(bidId)
    return item
  }

  async updateItem(
    bidId: string,
    itemId: string,
    companyId: string,
    data: Record<string, unknown>,
  ) {
    await this.getBid(bidId, companyId)
    const item = await BidItemRepository.update(itemId, data)
    await BidItemRepository.recalcTotals(bidId)
    return item
  }

  async deleteItem(bidId: string, itemId: string, companyId: string) {
    await this.getBid(bidId, companyId)
    await BidItemRepository.delete(itemId)
    await BidItemRepository.recalcTotals(bidId)
  }

  async reorderItems(bidId: string, companyId: string, orderedIds: string[]) {
    await this.getBid(bidId, companyId)
    return BidItemRepository.reorder(bidId, orderedIds)
  }
}

export const bidService = new BidService()
