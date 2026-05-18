// apps/bid-service/src/handlers/document.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { ok, fail } from '@decoration-bidding/shared-utils'
import type { DocumentService } from '../services/document.service.js'

export function createDocumentHandlers(svc: DocumentService) {
  return {
    async upload(req: FastifyRequest<{ Params: { bidId: string } }>, reply: FastifyReply) {
      const data = await req.file()
      if (!data) return reply.status(400).send(fail('NO_FILE', '请上传 PDF 文件'))
      const buffer = await data.toBuffer()
      const result = await svc.uploadAndProcess(req.params.bidId, buffer, data.filename)
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
  }
}
