// apps/core-service/src/modules/auth/handlers/login.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as authSvc from '../services/auth.service.js'
import { config } from '../../../config.js'

const schema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function loginHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = schema.parse(request.body)
  const result = await authSvc.login(body.email, body.password)

  reply.setCookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: config.REFRESH_TOKEN_TTL,
  })

  // 设置无 path 限制的标记 cookie，供 proxy.ts 路由保护使用
  // 不含敏感信息，仅作为"已登录"标志
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
