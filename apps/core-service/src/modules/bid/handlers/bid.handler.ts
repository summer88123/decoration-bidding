// apps/core-service/src/modules/bid/handlers/bid.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { bidService } from '../services/bid.service.js'
import {
  CreateBidSchema,
  UpdateBidSchema,
  BidStatusSchema,
  ProfitMarginSchema,
} from '../schemas/bid.schema.js'

export function createBidHandlers() {
  return {
    async create(req: FastifyRequest, reply: FastifyReply) {
      const user = req.authUser
      const body = CreateBidSchema.parse(req.body)
      const bid = await bidService.createBid(user.companyId, body)
      return reply.code(201).send({ success: true, data: bid })
    },

    async getById(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      const bid = await bidService.getBid(req.params.bidId, user.companyId)
      return reply.send({ success: true, data: bid })
    },

    async getByTender(
      req: FastifyRequest<{ Params: { tenderId: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      const bids = await bidService.getBidsByTender(req.params.tenderId, user.companyId)
      return reply.send({ success: true, data: bids })
    },

    async update(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      const body = UpdateBidSchema.parse(req.body)
      const bid = await bidService.updateBid(req.params.bidId, user.companyId, body)
      return reply.send({ success: true, data: bid })
    },

    async changeStatus(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      const body = BidStatusSchema.parse(req.body)
      const bid = await bidService.changeBidStatus(
        req.params.bidId,
        user.companyId,
        user.userId,
        body,
      )
      return reply.send({ success: true, data: bid })
    },

    async applyProfitMargin(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      const { profitMarginPct } = ProfitMarginSchema.parse(req.body)
      const bid = await bidService.applyProfitMargin(
        req.params.bidId,
        user.companyId,
        profitMarginPct,
      )
      return reply.send({ success: true, data: bid })
    },

    async delete(
      req: FastifyRequest<{ Params: { bidId: string } }>,
      reply: FastifyReply,
    ) {
      const user = req.authUser
      await bidService.deleteBid(req.params.bidId, user.companyId)
      return reply.code(204).send()
    },
  }
}

