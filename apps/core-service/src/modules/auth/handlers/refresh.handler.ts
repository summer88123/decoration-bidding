// apps/core-service/src/modules/auth/handlers/refresh.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as authSvc from '../services/auth.service.js'
import { config } from '../../../config.js'

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  // 从原始 Cookie 头解析 refresh_token，取最后一个值
  // 浏览器可能因历史遗留问题携带多个同名 cookie，@fastify/cookie 默认取第一个
  // 而最后一个才是最新的有效 token
  const rawCookie = request.headers['cookie'] ?? ''
  let refreshToken: string | undefined
  for (const part of rawCookie.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key.trim() === 'refresh_token') {
      refreshToken = rest.join('=').trim()
    }
  }
  if (!refreshToken) {
    const cookies = request.cookies as Record<string, string | undefined>
    refreshToken = cookies['refresh_token']
  }
  if (!refreshToken) {
    return reply.status(401).send({
      success: false,
      error: { code: 'NO_REFRESH_TOKEN', message: '未找到 RefreshToken' },
    })
  }

  const result = await authSvc.refreshTokens(refreshToken)

  // 将 refresh_token cookie 的 path 设置为 '/'，确保在通过 Next.js proxy 时
  // 浏览器会在所有同源请求中携带该 cookie（server-side middleware 可读取 httpOnly cookie），
  // 避免 proxy 无法检测到登录状态导致重定向循环。
  reply.setCookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: config.REFRESH_TOKEN_TTL,
  })

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
