// apps/core-service/src/modules/bid/repositories/bid.repository.ts
import { prisma } from '@decoration-bidding/database'

export const BidRepository = {
  async create(data: {
    tenderId: string
    companyId: string
    name?: string
    assignedTo?: string
    currency?: string
  }) {
    return prisma.bid.create({
      data: {
        tenderId: data.tenderId,
        companyId: data.companyId,
        name: data.name ?? '默认方案',
        assignedTo: data.assignedTo,
        currency: data.currency ?? 'HKD',
        commercial: { create: {} },
        technical: { create: {} },
      },
      include: {
        commercial: true,
        technical: true,
      },
    })
  },

  async findById(id: string, companyId: string) {
    return prisma.bid.findFirst({
      where: { id, companyId },
      include: {
        commercial: true,
        technical: true,
        bidItems: { orderBy: { sortOrder: 'asc' } },
        documents: true,
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
  },

  async findByTenderId(tenderId: string, companyId: string) {
    return prisma.bid.findMany({
      where: { tenderId, companyId },
      orderBy: { createdAt: 'desc' },
    })
  },

  async update(id: string, data: {
    name?: string
    assignedTo?: string
    profitMarginPct?: number
    totalCost?: number
    totalBidPrice?: number
    submittedAt?: Date
  }) {
    return prisma.bid.update({ where: { id }, data })
  },

  async updateStatus(id: string, status: string) {
    return prisma.bid.update({
      where: { id },
      data: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: status as any,
        ...(status === 'SUBMITTED' ? { submittedAt: new Date() } : {}),
      },
    })
  },
}
