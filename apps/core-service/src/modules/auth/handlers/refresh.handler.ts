// apps/core-service/src/modules/auth/handlers/refresh.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as authSvc from '../services/auth.service.js'
import { config } from '../../../config.js'

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  const cookies = request.cookies as Record<string, string | undefined>
  const refreshToken = cookies['refresh_token']
  if (!refreshToken) {
    return reply.status(401).send({
      success: false,
      error: { code: 'NO_REFRESH_TOKEN', message: '未找到 RefreshToken' },
    })
  }

  const result = await authSvc.refreshTokens(refreshToken)

  reply.setCookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: config.REFRESH_TOKEN_TTL,
  })

  reply.setCookie('logged_in', '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: config.REFRESH_TOKEN_TTL,
  })

  return reply.send({
    success: true,
    data: {
      accessToken: result.accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role.name,
        companyId: result.user.companyId,
      },
    },
  })
}
