// apps/bid-service/src/handlers/document.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { ok, fail } from '@decoration-bidding/shared-utils'
import { findUserById } from '../../auth/repositories/auth.repository.js'
import type { DocumentService } from '../services/document.service.js'
import { BidDocumentRepository } from '../repositories/bid-document.repository.js'

export function createDocumentHandlers(svc: DocumentService) {
  return {
    async upload(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const data = await req.file()
      if (!data) return reply.status(400).send(fail('NO_FILE', '请上传 PDF 文件'))
      const buffer = await data.toBuffer()

      // 查询当前登录用户邮箱，用于 Langfuse userId 追踪
      const authUser = (req as unknown as { authUser?: { userId: string } }).authUser
      let userEmail: string | undefined
      if (authUser?.userId) {
        const user = await findUserById(authUser.userId).catch(() => null)
        userEmail = user?.email ?? undefined
      }

      const result = await svc.uploadAndProcess(req.params.bidId, buffer, data.filename, userEmail)
      return reply.status(202).send(ok(result))
    },

    async getStatus(
      req: FastifyRequest<{ Params: { bidId: string; docId: string } }>,
      reply: FastifyReply,
    ) {
      const doc = await svc.getDocumentStatus(req.params.docId)
      if (!doc) return reply.status(404).send(fail('NOT_FOUND', '文档不存在'))
      return reply.send(
        ok({ status: doc.status, pageCount: doc.pageCount, errorMsg: doc.errorMsg }),
      )
    },

    async getItems(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const items = await svc.getBidItems(req.params.bidId)
      return reply.send(ok(items))
    },

    async listDocuments(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const docs = await BidDocumentRepository.findByBidId(req.params.bidId)
      return reply.send(ok(docs))
    },
  }
}
