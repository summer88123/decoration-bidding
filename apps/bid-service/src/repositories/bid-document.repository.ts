// apps/bid-service/src/repositories/bid-document.repository.ts
import { prisma } from '@decoration-bidding/database'
import type { DocumentStatus } from '@decoration-bidding/shared-types'

export const BidDocumentRepository = {
  create(data: { bidId: string; fileType: string; fileUrl: string }) {
    return prisma.bidDocument.create({ data })
  },

  findById(id: string) {
    return prisma.bidDocument.findUnique({ where: { id } })
  },

  updateStatus(
    id: string,
    status: DocumentStatus,
    extra?: { pageCount?: number; errorMsg?: string },
  ) {
    return prisma.bidDocument.update({
      where: { id },
      data: { status, ...extra },
    })
  },
}
