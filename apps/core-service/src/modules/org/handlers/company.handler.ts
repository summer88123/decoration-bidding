import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as svc from '../services/org.service.js'

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  licenses: z.array(z.string()).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
})

export async function getCompanyHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.authUser  // 注意：middleware 用的是 req.authUser，不是 req.user
  const company = await svc.getCompany(user.companyId)
  return reply.send({ success: true, data: company })
}

export async function updateCompanyHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.authUser
  const body = updateCompanySchema.parse(req.body)
  const company = await svc.updateCompany(user.companyId, body)
  return reply.send({ success: true, data: company })
}
