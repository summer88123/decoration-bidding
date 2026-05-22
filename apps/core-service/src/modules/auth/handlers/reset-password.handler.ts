// apps/core-service/src/modules/auth/handlers/reset-password.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as authSvc from '../services/auth.service.js'

const schema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
})

export async function resetPasswordHandler(request: FastifyRequest, reply: FastifyReply) {
  const { token, newPassword } = schema.parse(request.body)
  await authSvc.resetPassword(token, newPassword)
  return reply.send({ success: true, data: { message: '密码已重置，请重新登录' } })
}
