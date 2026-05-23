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

  // 先清除旧的 refresh_token（防止浏览器积累多个同名 cookie 导致 @fastify/cookie 取到旧值）
  reply.clearCookie('refresh_token', { path: '/' })

  // 将 refresh_token cookie 的 path 设置为 '/'，以便浏览器在通过 Next.js 的 /api 代理时携带该 cookie。
  // 这保证了 /api/auth/refresh 能拿到 refresh_token，从而返回新的 access token。
  reply.setCookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: config.REFRESH_TOKEN_TTL,
  })

  // 设置无 path 限制的标记 cookie，供 proxy.ts 路由保护使用
  // 不含敏感信息，仅作为"已登录"标志
  // 使用 sameSite='lax' 以便在页面导航（top-level GET）时浏览器也会携带该标记 cookie，
  // 这使得 proxy 能可靠判断已登录状态，避免登录/仪表盘间的跳转循环。
  reply.setCookie('logged_in', '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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
