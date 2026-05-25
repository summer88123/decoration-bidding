// apps/core-service/src/modules/bid/repositories/bid-technical.repository.ts
import { prisma } from '@decoration-bidding/database'

export const BidTechnicalRepository = {
  findByBidId(bidId: string) {
    return prisma.bidTechnical.findUnique({ where: { bidId } })
  },

  upsert(bidId: string, data: Record<string, unknown>) {
    return prisma.bidTechnical.upsert({
      where: { bidId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { bidId, ...data } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: data as any,
    })
  },
}
