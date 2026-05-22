// apps/core-service/src/modules/auth/handlers/logout.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as authSvc from '../services/auth.service.js'

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const cookies = request.cookies as Record<string, string | undefined>
  const refreshToken = cookies['refresh_token']
  if (refreshToken) {
    await authSvc.logout(refreshToken)
  }
  reply.clearCookie('refresh_token', { path: '/api/auth/refresh' })
  return reply.send({ success: true })
}
