import bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { redis } from '../../../shared/redis.js'
import { config } from '../../../config.js'
import * as repo from '../repositories/auth.repository.js'
import * as tokenSvc from './token.service.js'
import { sendPasswordResetEmail } from './mail.service.js'

const SALT_ROUNDS = 10
const LOGIN_FAIL_PREFIX = 'login:fail:'

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export async function register(data: {
  email: string
  password: string
  companyId: string
  roleId: string
  name?: string
  phone?: string
}) {
  const existing = await repo.findUserByEmail(data.email)
  if (existing) throw new AuthError('EMAIL_TAKEN', '邮箱已被注册', 409)

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
  const user = await repo.createUser({
    email: data.email,
    companyId: data.companyId,
    roleId: data.roleId,
    passwordHash,
    name: data.name ?? '',
    phone: data.phone,
  })
  return user
}

export async function login(email: string, password: string) {
  const failKey = `${LOGIN_FAIL_PREFIX}${email}`
  const failures = await redis.get(failKey)
  if (Number(failures) >= config.LOGIN_MAX_FAILURES) {
    const ttl = await redis.ttl(failKey)
    throw new AuthError('ACCOUNT_LOCKED', `账号已锁定，请 ${Math.ceil(ttl / 60)} 分钟后再试`, 429)
  }

  const user = await repo.findUserByEmail(email)
  if (!user) {
    await redis.set(failKey, String(Number(failures || 0) + 1), 'EX', config.LOGIN_LOCK_TTL)
    throw new AuthError('INVALID_CREDENTIALS', '邮箱或密码错误', 401)
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    await redis.set(failKey, String(Number(failures || 0) + 1), 'EX', config.LOGIN_LOCK_TTL)
    throw new AuthError('INVALID_CREDENTIALS', '邮箱或密码错误', 401)
  }

  await redis.del(failKey)

  const payload = { sub: user.id, companyId: user.companyId, role: user.role.name as any }
  const accessToken = tokenSvc.signAccessToken(payload)
  const { token: refreshToken, jti } = tokenSvc.signRefreshToken(payload)

  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL * 1000)
  await repo.saveRefreshToken({ jti, userId: user.id, expiresAt })

  return { accessToken, refreshToken, jti, user }
}

export async function refreshTokens(refreshTokenStr: string) {
  let payload: tokenSvc.JwtPayload
  try {
    payload = tokenSvc.verifyToken(refreshTokenStr)
  } catch {
    throw new AuthError('INVALID_TOKEN', 'RefreshToken 无效或已过期', 401)
  }

  const isBlacklisted = await tokenSvc.isRefreshTokenBlacklisted(payload.jti)
  if (isBlacklisted) throw new AuthError('TOKEN_REVOKED', 'RefreshToken 已被吊销', 401)

  await tokenSvc.blacklistRefreshToken(payload.jti, payload.exp as number)
  await repo.deleteRefreshToken(payload.jti).catch(() => {})

  const user = await repo.findUserById(payload.sub)
  if (!user) throw new AuthError('USER_NOT_FOUND', '用户不存在', 401)

  const newPayload = { sub: user.id, companyId: user.companyId, role: user.role.name as any }
  const accessToken = tokenSvc.signAccessToken(newPayload)
  const { token: newRefreshToken, jti: newJti } = tokenSvc.signRefreshToken(newPayload)

  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL * 1000)
  await repo.saveRefreshToken({ jti: newJti, userId: user.id, expiresAt })

  return { accessToken, refreshToken: newRefreshToken, jti: newJti, user }
}

export async function logout(refreshTokenStr: string) {
  try {
    const payload = tokenSvc.verifyToken(refreshTokenStr)
    await tokenSvc.blacklistRefreshToken(payload.jti, payload.exp as number)
    await repo.deleteRefreshToken(payload.jti).catch(() => {})
  } catch {
    // 即使 token 无效也视为登出成功
  }
}

export async function forgotPassword(email: string) {
  const user = await repo.findUserByEmail(email)
  if (!user) return // 不暴露用户是否存在

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await repo.savePasswordResetToken({ token, userId: user.id, expiresAt })

  const resetUrl = `${config.BASE_URL}/reset-password?token=${token}`
  await sendPasswordResetEmail(email, resetUrl)
}

export async function resetPassword(token: string, newPassword: string) {
  const record = await repo.findPasswordResetToken(token)
  if (!record || record.used || record.expiresAt < new Date()) {
    throw new AuthError('INVALID_TOKEN', '重置链接无效或已过期', 400)
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  await repo.updateUserPassword(record.userId, passwordHash)
  await repo.markPasswordResetTokenUsed(record.id)
}
