// apps/core-service/src/modules/bid/repositories/bid-status.repository.ts
import { prisma } from '@decoration-bidding/database'

export const BidStatusRepository = {
  create(data: {
    bidId: string
    fromStatus: string | null
    toStatus: string
    operatorId: string
    comment?: string
  }) {
    return prisma.bidStatusLog.create({ data })
  },

  findByBidId(bidId: string) {
    return prisma.bidStatusLog.findMany({
      where: { bidId },
      orderBy: { createdAt: 'desc' },
    })
  },
}
