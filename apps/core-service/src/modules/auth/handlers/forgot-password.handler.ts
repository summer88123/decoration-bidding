// apps/core-service/src/modules/auth/handlers/forgot-password.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as authSvc from '../services/auth.service.js'

const schema = z.object({ email: z.string().email() })

export async function forgotPasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const { email } = schema.parse(request.body)
  await authSvc.forgotPassword(email)
  return reply.send({ success: true, data: { message: '如果邮箱存在，重置链接已发送' } })
}
