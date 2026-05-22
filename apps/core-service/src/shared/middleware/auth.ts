// apps/core-service/src/shared/middleware/auth.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import jwt from 'jsonwebtoken'
import { config } from '../../config.js'
import type { UserRole } from '@decoration-bidding/shared-types'

interface JwtPayload {
  sub: string
  companyId: string
  role: UserRole
  jti: string
  exp: number
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser: { userId: string; companyId: string; role: UserRole }
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: { code: 'MISSING_TOKEN', message: '缺少认证令牌' },
    })
  }

  const token = authHeader.slice(7)
  const secret = config.RS256_PUBLIC_KEY || config.RS256_PRIVATE_KEY || 'dev-secret'
  const algorithms: jwt.Algorithm[] = config.RS256_PUBLIC_KEY ? ['RS256'] : ['HS256']

  try {
    const payload = jwt.verify(token, secret, { algorithms }) as JwtPayload
    request.authUser = {
      userId: payload.sub,
      companyId: payload.companyId,
      role: payload.role,
    }
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'INVALID_TOKEN', message: '令牌无效或已过期' },
    })
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.authUser || !allowedRoles.includes(request.authUser.role)) {
      return reply.status(403).send({
        success: false,
        error: { code: 'FORBIDDEN', message: '权限不足' },
      })
    }
  }
}
