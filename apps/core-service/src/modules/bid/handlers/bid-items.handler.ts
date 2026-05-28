// apps/core-service/src/modules/bid/handlers/bid-items.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { bidService } from '../services/bid.service.js'
import { BidItemRepository } from '../repositories/bid-item.repository.js'
import {
  CreateBidItemSchema,
  UpdateBidItemSchema,
  ReorderItemsSchema,
} from '../schemas/bid.schema.js'

export function createBidItemsHandlers() {
  return {
    async list(
      req: FastifyRequest<{ Params: { bidId: string }; Querystring: { documentId?: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      // 权限校验：确认该 bid 属于当前公司
      await bidService.getBid(req.params.bidId, user.companyId)
      const items = await BidItemRepository.findByBidId(req.params.bidId, req.query.documentId)
      return reply.send({ success: true, data: items })
    },

    async create(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      const body = CreateBidItemSchema.parse(req.body)
      const item = await bidService.createItem(
        req.params.bidId,
        user.companyId,
        body as Record<string, unknown>,
      )
      return reply.code(201).send({ success: true, data: item })
    },

    async update(
      req: FastifyRequest<{ Params: { bidId: string; itemId: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      const body = UpdateBidItemSchema.parse(req.body)
      const item = await bidService.updateItem(
        req.params.bidId,
        req.params.itemId,
        user.companyId,
        body as Record<string, unknown>,
      )
      return reply.send({ success: true, data: item })
    },

    async delete(
      req: FastifyRequest<{ Params: { bidId: string; itemId: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      await bidService.deleteItem(req.params.bidId, req.params.itemId, user.companyId)
      return reply.send({ success: true })
    },

    async reorder(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      const body = ReorderItemsSchema.parse(req.body)
      await bidService.reorderItems(req.params.bidId, user.companyId, body.orderedIds)
      return reply.send({ success: true })
    },
  }
}

