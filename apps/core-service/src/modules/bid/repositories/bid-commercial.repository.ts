// apps/core-service/src/modules/bid/repositories/bid-commercial.repository.ts
import { prisma } from '@decoration-bidding/database'

export const BidCommercialRepository = {
  findByBidId(bidId: string) {
    return prisma.bidCommercial.findUnique({ where: { bidId } })
  },

  upsert(bidId: string, data: Record<string, unknown>) {
    return prisma.bidCommercial.upsert({
      where: { bidId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: { bidId, ...data } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: data as any,
    })
  },
}
