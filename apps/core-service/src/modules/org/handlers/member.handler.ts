import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as svc from '../services/org.service.js'

const listMembersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
})

const inviteMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'BIDDER']),
})

const updateMemberSchema = z.object({
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'BIDDER']).optional(),
  status: z.enum(['active', 'pending', 'disabled']).optional(),
})

export async function listMembersHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.authUser
  const query = listMembersQuerySchema.parse(req.query)
  const { items, total } = await svc.listMembers(user.companyId, query)
  const totalPages = Math.ceil(total / query.pageSize)
  return reply.send({
    success: true,
    data: items.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role.name,
      status: u.status,
    })),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages },
  })
}

export async function inviteMemberHandler(req: FastifyRequest, reply: FastifyReply) {
  const user = req.authUser
  const body = inviteMemberSchema.parse(req.body)
  const member = await svc.inviteMember(user.companyId, body)
  return reply.status(201).send({
    success: true,
    data: { id: member.id, email: member.email, status: member.status },
  })
}

export async function updateMemberHandler(
  req: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  const body = updateMemberSchema.parse(req.body)
  const updated = await svc.updateMemberRole(user.companyId, req.params.userId, body)
  return reply.send({
    success: true,
    data: { id: updated.id, role: updated.role.name, status: updated.status },
  })
}

export async function deleteMemberHandler(
  req: FastifyRequest<{ Params: { userId: string } }>,
  reply: FastifyReply,
) {
  const user = req.authUser
  await svc.removeMember(user.companyId, req.params.userId)
  return reply.send({ success: true })
}
