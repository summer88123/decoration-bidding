# 认证模块（阶段 1）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的认证模块，包括后端 JWT 登录/注册/刷新/登出流程、前端认证页面与 Token 自动刷新，使整个应用可以安全地保护路由。

**Architecture:** 后端使用 Fastify + RS256 JWT，RefreshToken 存 Redis 黑名单，登录失败计数存 Redis。前端 AccessToken 存 Zustand 内存，RefreshToken 存 httpOnly Cookie，页面加载时静默刷新。

**Tech Stack:** Fastify 4, @fastify/jwt, jsonwebtoken (RS256), ioredis, bcrypt, Nodemailer, Next.js 14 App Router, Zustand, Axios, React Hook Form, shadcn/ui

---

## 文件结构

### 后端新建文件
- `apps/core-service/src/shared/redis.ts` — Redis 连接单例
- `apps/core-service/src/modules/auth/repositories/auth.repository.ts` — 用户 CRUD + RefreshToken 黑名单
- `apps/core-service/src/modules/auth/services/token.service.ts` — JWT 签发/验证/黑名单
- `apps/core-service/src/modules/auth/services/auth.service.ts` — 业务逻辑（注册/登录/刷新/登出/密码重置）
- `apps/core-service/src/modules/auth/services/mail.service.ts` — 邮件发送
- `apps/core-service/src/modules/auth/handlers/register.handler.ts`
- `apps/core-service/src/modules/auth/handlers/login.handler.ts`
- `apps/core-service/src/modules/auth/handlers/refresh.handler.ts`
- `apps/core-service/src/modules/auth/handlers/logout.handler.ts`
- `apps/core-service/src/modules/auth/handlers/forgot-password.handler.ts`
- `apps/core-service/src/modules/auth/handlers/reset-password.handler.ts`

### 后端修改文件
- `apps/core-service/src/modules/auth/routes.ts` — 补全所有 auth 路由
- `apps/core-service/src/shared/middleware/auth.ts` — 改为 RS256 + 黑名单检查
- `apps/core-service/src/config.ts` — 添加 RS256_PRIVATE_KEY、RS256_PUBLIC_KEY、SMTP 等
- `packages/database/prisma/schema.prisma` — 添加 RefreshToken、PasswordResetToken 模型

### 前端新建文件
- `apps/web/src/stores/auth-store.ts` — Zustand 认证状态
- `apps/web/src/middleware.ts` — Next.js 路由保护
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(auth)/forgot-password/page.tsx`
- `apps/web/src/app/(auth)/layout.tsx` — auth 路由布局

### 前端修改文件
- `apps/web/src/lib/api-client.ts` — 补全 Token 刷新拦截器
- `apps/web/src/app/layout.tsx` — 添加 AuthProvider 静默刷新

---

## Task 1: Prisma Schema — 添加认证相关模型

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: 在 schema.prisma 末尾追加两个新模型**

在 `packages/database/prisma/schema.prisma` 中找到 `User` 模型，添加关联字段：

```prisma
// 在 User 模型内添加（notifications 之后）
  refreshTokens       RefreshToken[]
  passwordResetTokens PasswordResetToken[]
```

然后在文件末尾追加：

```prisma
model RefreshToken {
  id        String   @id @default(cuid())
  jti       String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model PasswordResetToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: 运行迁移与生成客户端**

```bash
cd packages/database && pnpm db:migrate && pnpm db:generate
```

Expected: 无报错，生成新的 Prisma Client

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/
git commit -m "feat(db): add RefreshToken and PasswordResetToken models"
```

---

## Task 2: config.ts 扩展 + Redis 连接单例

**Files:**
- Modify: `apps/core-service/src/config.ts`
- Create: `apps/core-service/src/shared/redis.ts`

- [ ] **Step 1: 扩展 config.ts，添加 RS256/SMTP/登录锁定配置**

将 `apps/core-service/src/config.ts` 内容替换为：

```typescript
export const config = {
  PORT: Number(process.env.PORT) || 8080,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/decoration_bidding',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  BASE_URL: process.env.BASE_URL || 'http://localhost:8080',
  BIM_SERVICE_URL: process.env.BIM_SERVICE_URL || 'http://localhost:3008',
  AI_AGENT_SERVICE_URL: process.env.AI_AGENT_SERVICE_URL || 'http://localhost:3005',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  RS256_PRIVATE_KEY: process.env.RS256_PRIVATE_KEY || '',
  RS256_PUBLIC_KEY: process.env.RS256_PUBLIC_KEY || '',
  ACCESS_TOKEN_TTL: 15 * 60,
  REFRESH_TOKEN_TTL: 7 * 24 * 3600,
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'noreply@decoration-bidding.com',
  LOGIN_MAX_FAILURES: 5,
  LOGIN_LOCK_TTL: 30 * 60,
} as const
```

- [ ] **Step 2: 创建 Redis 单例 `apps/core-service/src/shared/redis.ts`**

```typescript
import Redis from 'ioredis'
import { config } from '../config.js'

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
})

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err)
})
```

- [ ] **Step 3: 安装 ioredis**

```bash
cd apps/core-service && pnpm add ioredis
```

- [ ] **Step 4: Commit**

```bash
git add apps/core-service/src/config.ts apps/core-service/src/shared/redis.ts
git commit -m "feat(core): extend config and add Redis singleton"
```

---

## Task 3: token.service.ts + auth.repository.ts

**Files:**
- Create: `apps/core-service/src/modules/auth/services/token.service.ts`
- Create: `apps/core-service/src/modules/auth/repositories/auth.repository.ts`

- [ ] **Step 1: 创建 `token.service.ts`**

```typescript
// apps/core-service/src/modules/auth/services/token.service.ts
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
}

const BLACKLIST_PREFIX = 'blacklist:refresh:'

export function signAccessToken(payload: Omit<JwtPayload, 'jti'>): string {
  const jti = randomUUID()
  return jwt.sign({ ...payload, jti }, config.RS256_PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: config.ACCESS_TOKEN_TTL,
  })
}

export function signRefreshToken(payload: Omit<JwtPayload, 'jti'>): { token: string; jti: string } {
  const jti = randomUUID()
  const token = jwt.sign({ ...payload, jti }, config.RS256_PRIVATE_KEY, {
    algorithm: 'RS256',
    expiresIn: config.REFRESH_TOKEN_TTL,
  })
  return { token, jti }
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.RS256_PUBLIC_KEY, {
    algorithms: ['RS256'],
  }) as JwtPayload
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
```

- [ ] **Step 2: 创建 `auth.repository.ts`**

```typescript
// apps/core-service/src/modules/auth/repositories/auth.repository.ts
import { prisma } from '@decoration-bidding/database'

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { role: true },
  })
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { role: true },
  })
}

export async function createUser(data: {
  email: string
  passwordHash: string
  companyId: string
  roleId: string
}) {
  return prisma.user.create({ data, include: { role: true } })
}

export async function saveRefreshToken(data: {
  jti: string
  userId: string
  expiresAt: Date
}) {
  return prisma.refreshToken.create({ data })
}

export async function findRefreshToken(jti: string) {
  return prisma.refreshToken.findUnique({ where: { jti } })
}

export async function deleteRefreshToken(jti: string) {
  return prisma.refreshToken.delete({ where: { jti } })
}

export async function savePasswordResetToken(data: {
  token: string
  userId: string
  expiresAt: Date
}) {
  return prisma.passwordResetToken.create({ data })
}

export async function findPasswordResetToken(token: string) {
  return prisma.passwordResetToken.findUnique({ where: { token } })
}

export async function markPasswordResetTokenUsed(id: string) {
  return prisma.passwordResetToken.update({ where: { id }, data: { used: true } })
}

export async function updateUserPassword(id: string, passwordHash: string) {
  return prisma.user.update({ where: { id }, data: { passwordHash } })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/core-service/src/modules/auth/
git commit -m "feat(auth): add token service and auth repository"
```

---

## Task 4: auth.service.ts — 业务逻辑

**Files:**
- Create: `apps/core-service/src/modules/auth/services/auth.service.ts`
- Create: `apps/core-service/src/modules/auth/services/mail.service.ts`

- [ ] **Step 1: 创建 `mail.service.ts`**

```typescript
// apps/core-service/src/modules/auth/services/mail.service.ts
import nodemailer from 'nodemailer'
import { config } from '../../../config.js'

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
})

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await transporter.sendMail({
    from: config.SMTP_FROM,
    to,
    subject: '重置您的密码',
    html: `<p>请点击以下链接重置密码（30分钟内有效）：</p>
           <a href="${resetUrl}">${resetUrl}</a>`,
  })
}
```

- [ ] **Step 2: 安装 nodemailer**

```bash
cd apps/core-service && pnpm add nodemailer && pnpm add -D @types/nodemailer
```

- [ ] **Step 3: 创建 `auth.service.ts`（前半部分：register + login）**

```typescript
// apps/core-service/src/modules/auth/services/auth.service.ts
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
  }
}

export async function register(data: {
  email: string
  password: string
  companyId: string
  roleId: string
}) {
  const existing = await repo.findUserByEmail(data.email)
  if (existing) throw new AuthError('EMAIL_TAKEN', '邮箱已被注册', 409)

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)
  const user = await repo.createUser({ ...data, passwordHash })
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
```

- [ ] **Step 4: 继续 `auth.service.ts`（后半部分：refresh + logout + password）**

在同一文件末尾追加：

```typescript
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
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 分钟
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
```

- [ ] **Step 5: 安装 bcrypt**

```bash
cd apps/core-service && pnpm add bcrypt && pnpm add -D @types/bcrypt
```

- [ ] **Step 6: Commit**

```bash
git add apps/core-service/src/modules/auth/
git commit -m "feat(auth): implement auth service with login/register/refresh/logout/password-reset"
```

---

## Task 5: Auth Handlers + routes.ts

**Files:**
- Create: `apps/core-service/src/modules/auth/handlers/register.handler.ts`
- Create: `apps/core-service/src/modules/auth/handlers/login.handler.ts`
- Create: `apps/core-service/src/modules/auth/handlers/refresh.handler.ts`
- Create: `apps/core-service/src/modules/auth/handlers/logout.handler.ts`
- Create: `apps/core-service/src/modules/auth/handlers/forgot-password.handler.ts`
- Create: `apps/core-service/src/modules/auth/handlers/reset-password.handler.ts`
- Modify: `apps/core-service/src/modules/auth/routes.ts`

- [ ] **Step 1: 创建 `register.handler.ts`**

```typescript
// apps/core-service/src/modules/auth/handlers/register.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import * as authSvc from '../services/auth.service.js'
import { prisma } from '@decoration-bidding/database'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(1),
})

export async function registerHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = schema.parse(request.body)

  // 创建公司（简化：每次注册都创建新公司）
  const company = await prisma.company.create({
    data: { name: body.companyName, regions: [] },
  })
  // 获取默认 role
  let role = await prisma.role.findFirst({ where: { name: 'bid-owner' } })
  if (!role) {
    role = await prisma.role.create({ data: { name: 'bid-owner', permissions: [] } })
  }

  const user = await authSvc.register({
    email: body.email,
    password: body.password,
    companyId: company.id,
    roleId: role.id,
  })

  return reply.status(201).send({
    success: true,
    data: { id: user.id, email: user.email },
  })
}
```

- [ ] **Step 2: 创建 `login.handler.ts`**

```typescript
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
```

- [ ] **Step 3: 创建 `refresh.handler.ts`**

```typescript
// apps/core-service/src/modules/auth/handlers/refresh.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as authSvc from '../services/auth.service.js'
import { config } from '../../../config.js'

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply) {
  const refreshToken = (request.cookies as Record<string, string>)['refresh_token']
  if (!refreshToken) {
    return reply.status(401).send({ success: false, error: { code: 'NO_REFRESH_TOKEN', message: '未找到 RefreshToken' } })
  }

  const result = await authSvc.refreshTokens(refreshToken)

  reply.setCookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/refresh',
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
```

- [ ] **Step 4: 创建 `logout.handler.ts`**

```typescript
// apps/core-service/src/modules/auth/handlers/logout.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as authSvc from '../services/auth.service.js'

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const refreshToken = (request.cookies as Record<string, string>)['refresh_token']
  if (refreshToken) {
    await authSvc.logout(refreshToken)
  }
  reply.clearCookie('refresh_token', { path: '/api/auth/refresh' })
  return reply.send({ success: true })
}
```

- [ ] **Step 5: 创建 `forgot-password.handler.ts` 和 `reset-password.handler.ts`**

```typescript
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
```

```typescript
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
```

- [ ] **Step 6: 更新 `routes.ts`**

将 `apps/core-service/src/modules/auth/routes.ts` 替换为：

```typescript
import type { FastifyPluginAsync } from 'fastify'
import cookie from '@fastify/cookie'
import { registerHandler } from './handlers/register.handler.js'
import { loginHandler } from './handlers/login.handler.js'
import { refreshHandler } from './handlers/refresh.handler.js'
import { logoutHandler } from './handlers/logout.handler.js'
import { forgotPasswordHandler } from './handlers/forgot-password.handler.js'
import { resetPasswordHandler } from './handlers/reset-password.handler.js'
import { AuthError } from './services/auth.service.js'
import { ZodError } from 'zod'

export const authRoutes: FastifyPluginAsync = async (app) => {
  await app.register(cookie)

  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
      })
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0].message },
      })
    }
    reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: '服务器错误' } })
  })

  app.get('/auth/health', async () => ({ module: 'auth', status: 'ok' }))
  app.post('/auth/register', registerHandler)
  app.post('/auth/login', loginHandler)
  app.post('/auth/refresh', refreshHandler)
  app.post('/auth/logout', logoutHandler)
  app.post('/auth/forgot-password', forgotPasswordHandler)
  app.post('/auth/reset-password', resetPasswordHandler)
}
```

- [ ] **Step 7: 安装 @fastify/cookie（如未安装）**

```bash
cd apps/core-service && pnpm add @fastify/cookie
```

- [ ] **Step 8: Commit**

```bash
git add apps/core-service/src/modules/auth/
git commit -m "feat(auth): implement all auth handlers and routes"
```

---

## Task 6: 完善 auth 中间件（RS256 + 黑名单）

**Files:**
- Modify: `apps/core-service/src/shared/middleware/auth.ts`

- [ ] **Step 1: 替换 auth.ts 内容**

将 `apps/core-service/src/shared/middleware/auth.ts` 替换为：

```typescript
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
    user: { userId: string; companyId: string; role: UserRole }
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, error: { code: 'MISSING_TOKEN', message: '缺少认证令牌' } })
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, config.RS256_PUBLIC_KEY || config.RS256_PRIVATE_KEY, {
      algorithms: ['RS256'],
    }) as JwtPayload
    request.user = { userId: payload.sub, companyId: payload.companyId, role: payload.role }
  } catch {
    return reply.status(401).send({ success: false, error: { code: 'INVALID_TOKEN', message: '令牌无效或已过期' } })
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: '权限不足' } })
    }
  }
}
```

> **注意**：开发环境若 RS256_PUBLIC_KEY 未设置，回退到 RS256_PRIVATE_KEY（对称 HS256 不适用此场景，
> 实际应确保 .env 配置正确）。生产环境必须配置 RS256_PUBLIC_KEY。

- [ ] **Step 2: Commit**

```bash
git add apps/core-service/src/shared/middleware/auth.ts
git commit -m "feat(auth): upgrade auth middleware to RS256 with proper error codes"
```

---

## Task 7: 前端 auth-store + middleware.ts + api-client

**Files:**
- Create: `apps/web/src/stores/auth-store.ts`
- Create: `apps/web/src/middleware.ts`
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: 创建 `auth-store.ts`**

```typescript
// apps/web/src/stores/auth-store.ts
import { create } from 'zustand'
import type { User } from '@decoration-bidding/shared-types'

interface AuthState {
  accessToken: string | null
  user: User | null
  isAuthenticated: boolean
  setAuth: (token: string, user: User) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  setAuth: (token, user) => set({ accessToken: token, user, isAuthenticated: true }),
  setAccessToken: (token) => set({ accessToken: token }),
  clearAuth: () => set({ accessToken: null, user: null, isAuthenticated: false }),
}))
```

- [ ] **Step 2: 创建 `middleware.ts`**

```typescript
// apps/web/src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password']
const SKIP_PATHS = ['/_next', '/favicon.ico', '/api/auth']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}
function shouldSkip(pathname: string) {
  return SKIP_PATHS.some((p) => pathname.startsWith(p))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (shouldSkip(pathname)) return NextResponse.next()

  const hasRefreshToken = request.cookies.has('refresh_token')

  if (isPublicPath(pathname) && hasRefreshToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  if (!isPublicPath(pathname) && !hasRefreshToken) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 3: 更新 `api-client.ts`（完整替换）**

```typescript
// apps/web/src/lib/api-client.ts
import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth-store'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  withCredentials: true,
})

let isRefreshing = false
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)))
  pendingQueue = []
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error)
    if (original.url?.includes('/api/auth/refresh')) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((token) => {
        original._retry = true
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` }
        return apiClient(original)
      })
    }
    original._retry = true
    isRefreshing = true
    try {
      const { data } = await apiClient.post<{ data: { accessToken: string } }>('/api/auth/refresh')
      const newToken = data.data.accessToken
      useAuthStore.getState().setAccessToken(newToken)
      processQueue(null, newToken)
      original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` }
      return apiClient(original)
    } catch (refreshError) {
      processQueue(refreshError, null)
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)

export default apiClient
```

- [ ] **Step 4: 在 `app/layout.tsx` 添加 AuthProvider**

在 `apps/web/src/app/layout.tsx` 中添加 AuthProvider 组件并包裹 children：

```typescript
// 在文件顶部添加 'use client' 指令的 AuthProvider 子组件
// 方案：创建单独的 AuthProvider 组件，在 layout.tsx 中 import

// 先创建 apps/web/src/components/auth-provider.tsx
'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/lib/api-client'
import type { User } from '@decoration-bidding/shared-types'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  useEffect(() => {
    apiClient
      .post<{ data: { accessToken: string; user: User } }>('/api/auth/refresh')
      .then(({ data }) => setAuth(data.data.accessToken, data.data.user))
      .catch(() => clearAuth())
  }, [])
  return <>{children}</>
}
```

然后在 `apps/web/src/app/layout.tsx` 中 import 并使用 `<AuthProvider>`。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add auth store, middleware, api-client interceptor, AuthProvider"
```

---

## Task 8: 前端登录 / 注册 / 忘记密码页面

**Files:**
- Create: `apps/web/src/app/(auth)/layout.tsx`
- Create: `apps/web/src/app/(auth)/login/page.tsx`
- Create: `apps/web/src/app/(auth)/register/page.tsx`
- Create: `apps/web/src/app/(auth)/forgot-password/page.tsx`

- [ ] **Step 1: 创建 `(auth)/layout.tsx`**

```typescript
// apps/web/src/app/(auth)/layout.tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `login/page.tsx`**

```typescript
// apps/web/src/app/(auth)/login/page.tsx
'use client'
import { useForm } from 'react-hook-form'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/lib/api-client'
import type { User } from '@decoration-bidding/shared-types'
import { useState } from 'react'

interface LoginForm { email: string; password: string }

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setError('')
    try {
      const res = await apiClient.post<{ data: { accessToken: string; user: User } }>(
        '/api/auth/login', data
      )
      setAuth(res.data.data.accessToken, res.data.data.user)
      const redirect = searchParams.get('redirect') || '/dashboard'
      router.push(redirect)
    } catch (e: any) {
      setError(e.response?.data?.error?.message || '登录失败')
    }
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-center">登录</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">邮箱</label>
          <input
            type="email"
            {...register('email', { required: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">密码</label>
          <input
            type="password"
            {...register('password', { required: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? '登录中...' : '登录'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm space-y-1">
        <a href="/forgot-password" className="text-blue-600 hover:underline block">忘记密码？</a>
        <a href="/register" className="text-blue-600 hover:underline block">没有账号？注册</a>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 `register/page.tsx`**

```typescript
// apps/web/src/app/(auth)/register/page.tsx
'use client'
import { useForm } from 'react-hook-form'
import { useRouter } from 'next/navigation'
import apiClient from '@/lib/api-client'
import { useState } from 'react'

interface RegisterForm {
  email: string
  password: string
  companyName: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<RegisterForm>()

  const onSubmit = async (data: RegisterForm) => {
    setError('')
    try {
      await apiClient.post('/api/auth/register', data)
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (e: any) {
      setError(e.response?.data?.error?.message || '注册失败')
    }
  }

  if (success) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <p className="text-green-600 font-medium">注册成功！正在跳转到登录页...</p>
      </div>
    )
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-center">注册</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">公司名称</label>
          <input {...register('companyName', { required: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">邮箱</label>
          <input type="email" {...register('email', { required: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">密码（至少 8 位）</label>
          <input type="password" {...register('password', { required: true, minLength: 8 })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {isSubmitting ? '注册中...' : '注册'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        <a href="/login" className="text-blue-600 hover:underline">已有账号？登录</a>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 创建 `forgot-password/page.tsx`**

```typescript
// apps/web/src/app/(auth)/forgot-password/page.tsx
'use client'
import { useForm } from 'react-hook-form'
import apiClient from '@/lib/api-client'
import { useState } from 'react'

interface ForgotForm { email: string }

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ForgotForm>()

  const onSubmit = async (data: ForgotForm) => {
    setError('')
    try {
      await apiClient.post('/api/auth/forgot-password', data)
      setSent(true)
    } catch {
      setError('发送失败，请稍后重试')
    }
  }

  if (sent) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <p className="text-green-600">如果该邮箱已注册，重置链接已发送，请查收邮件。</p>
        <a href="/login" className="mt-4 block text-blue-600 hover:underline text-sm">返回登录</a>
      </div>
    )
  }

  return (
    <div className="bg-white p-8 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-center">找回密码</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">注册邮箱</label>
          <input type="email" {...register('email', { required: true })}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
          {isSubmitting ? '发送中...' : '发送重置链接'}
        </button>
      </form>
      <div className="mt-4 text-center text-sm">
        <a href="/login" className="text-blue-600 hover:underline">返回登录</a>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 确认依赖已安装**

```bash
cd apps/web && pnpm add react-hook-form zustand axios
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/\(auth\)/
git commit -m "feat(web): add login, register, forgot-password pages"
```

---

## 完成验证

- [ ] 启动服务：`pnpm dev`
- [ ] 访问 `http://localhost:3000/login` → 应显示登录表单
- [ ] 注册新用户，跳转登录，登录成功后跳转 `/dashboard`
- [ ] 登出后访问 `/dashboard` 应重定向到 `/login`
- [ ] 调用 `POST http://localhost:8080/api/auth/refresh` 应返回新 accessToken

