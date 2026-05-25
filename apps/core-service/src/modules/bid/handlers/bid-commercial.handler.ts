// apps/core-service/src/modules/bid/handlers/bid-commercial.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { bidService } from '../services/bid.service.js'
import { UpdateCommercialSchema } from '../schemas/bid.schema.js'

export function createCommercialHandlers() {
  return {
    async get(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const data = await bidService.getCommercial(req.params.bidId)
      return reply.send({ success: true, data })
    },

    async update(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const body = UpdateCommercialSchema.parse(req.body)
      const data = await bidService.updateCommercial(
        req.params.bidId,
        body as Record<string, unknown>,
      )
      return reply.send({ success: true, data })
    },
  }
}
