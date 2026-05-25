// apps/core-service/src/modules/bid/handlers/bid-technical.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { bidService } from '../services/bid.service.js'
import { UpdateTechnicalSchema } from '../schemas/bid.schema.js'

export function createTechnicalHandlers() {
  return {
    async get(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const data = await bidService.getTechnical(req.params.bidId)
      return reply.send({ success: true, data })
    },

    async update(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const body = UpdateTechnicalSchema.parse(req.body)
      const data = await bidService.updateTechnical(
        req.params.bidId,
        body as Record<string, unknown>,
      )
      return reply.send({ success: true, data })
    },
  }
}
