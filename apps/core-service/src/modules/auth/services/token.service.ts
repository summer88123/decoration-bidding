import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { redis } from '../../../shared/redis.js'
import { config } from '../../../config.js'
import type { UserRole } from '@decoration-bidding/shared-types'

export interface JwtPayload {
  sub: string
  companyId: string
  role: UserRole
  jti: string
  exp?: number
}

const BLACKLIST_PREFIX = 'blacklist:refresh:'

export function signAccessToken(payload: Omit<JwtPayload, 'jti' | 'exp'>): string {
  const jti = randomUUID()
  // 开发环境：若无 RS256 私钥则回退到 HS256
  const secret = config.RS256_PRIVATE_KEY || 'dev-secret'
  const algorithm = config.RS256_PRIVATE_KEY ? 'RS256' : 'HS256'
  return jwt.sign({ ...payload, jti }, secret, {
    algorithm,
    expiresIn: config.ACCESS_TOKEN_TTL,
  } as jwt.SignOptions)
}

export function signRefreshToken(payload: Omit<JwtPayload, 'jti' | 'exp'>): { token: string; jti: string } {
  const jti = randomUUID()
  const secret = config.RS256_PRIVATE_KEY || 'dev-secret'
  const algorithm = config.RS256_PRIVATE_KEY ? 'RS256' : 'HS256'
  const token = jwt.sign({ ...payload, jti }, secret, {
    algorithm,
    expiresIn: config.REFRESH_TOKEN_TTL,
  } as jwt.SignOptions)
  return { token, jti }
}

export function verifyToken(token: string): JwtPayload {
  const secret = config.RS256_PUBLIC_KEY || config.RS256_PRIVATE_KEY || 'dev-secret'
  const algorithms = config.RS256_PUBLIC_KEY ? ['RS256'] : ['HS256']
  return jwt.verify(token, secret, { algorithms } as jwt.VerifyOptions) as JwtPayload
}

export async function blacklistRefreshToken(jti: string, expiresAt: number): Promise<void> {
  const ttl = Math.max(0, expiresAt - Math.floor(Date.now() / 1000))
  if (ttl > 0) {
    await redis.set(`${BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttl)
  }
}

export async function isRefreshTokenBlacklisted(jti: string): Promise<boolean> {
  const result = await redis.get(`${BLACKLIST_PREFIX}${jti}`)
  return result !== null
}
