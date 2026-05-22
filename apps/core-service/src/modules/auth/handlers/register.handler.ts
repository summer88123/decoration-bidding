// apps/core-service/src/modules/auth/handlers/register.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as authSvc from '../services/auth.service.js'
import { prisma } from '@decoration-bidding/database'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(1),
})

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = schema.parse(request.body)

  const company = await prisma.company.create({
    data: { name: body.companyName, regions: [] },
  })
  const role = await prisma.role.findFirst({ where: { name: 'COMPANY_ADMIN' } })
  if (!role) {
    throw new Error('COMPANY_ADMIN 角色未初始化，请先运行数据库 seed')
  }

  const user = await authSvc.register({
    email: body.email,
    password: body.password,
    companyId: company.id,
    roleId: role.id,
  })

  return reply.status(201).send({
    success: true,
    data: { id: user.id, email: user.email },
  })
}
