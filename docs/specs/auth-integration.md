# 认证集成规范

> 适用项目：香港建筑及室内设计投标辅助系统  
> 版本：v1.0  
> 日期：2026-05-22

---

## 1. 概述

本文档描述前后端认证集成的完整规范，涵盖 Token 存储、路由保护、自动刷新、权限验证及密钥管理。

### 技术选型

| 项目 | 方案 |
|------|------|
| 签名算法 | RS256（非对称，私钥签发，公钥验证） |
| AccessToken 有效期 | 15 分钟 |
| RefreshToken 有效期 | 7 天 |
| RefreshToken 策略 | Rotation（每次刷新换新 Token） |
| 登录失败锁定 | 5 次失败 → 锁定 30 分钟 |
| 登出处理 | RefreshToken 加入 Redis 黑名单 |

---

## 2. Token 存储策略

### 2.1 设计原则

- **防 XSS**：RefreshToken 绝对不能存放在 `localStorage` 或 JS 可访问的 `sessionStorage`
- **防 CSRF**：Cookie 使用 `SameSite=Strict`，限制跨站请求携带
- **最小暴露**：AccessToken 仅存内存，进程/标签页关闭即销毁

### 2.2 AccessToken

| 属性 | 值 |
|------|----|
| 存储位置 | Zustand store（内存） |
| 持久化 | 否 |
| 传输方式 | `Authorization: Bearer <token>` |
| 刷新来源 | 页面加载或 401 响应时通过 RefreshToken 换取 |

### 2.3 RefreshToken

| 属性 | 值 |
|------|----|
| 存储位置 | `httpOnly` Cookie |
| Cookie 名称 | `refresh_token` |
| Secure | 是（生产必须 HTTPS） |
| SameSite | `Strict` |
| Path | `/api/auth/refresh`（限制只在刷新端点发送） |
| HttpOnly | 是（JS 无法读取） |
| 有效期 | 7 天 |

**理由说明**

```
XSS 攻击者即使注入恶意脚本，也无法通过 document.cookie 读取
httpOnly Cookie，因此无法窃取 RefreshToken 来伪造长期会话。
AccessToken 存内存而非 localStorage，同样防止 XSS 直接读取。
SameSite=Strict + Path 限制进一步防止 CSRF 和 Cookie 泄漏范围。
```

### 2.4 Cookie 设置示例（core-service 登录响应）

```typescript
// apps/core-service/src/modules/auth/handlers/login.handler.ts
reply.setCookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth/refresh',
  maxAge: 7 * 24 * 60 * 60, // 7 天（秒）
})
```

---

## 3. Next.js 路由保护（middleware.ts）

### 3.1 路由分类

| 类别 | 路径 | 行为 |
|------|------|------|
| 公开路由 | `/login` | 无需认证，已登录则跳转 `/dashboard` |
| 公开路由 | `/register` | 无需认证 |
| 公开路由 | `/forgot-password` | 无需认证 |
| 公开路由 | `/reset-password` | 无需认证 |
| 需认证路由 | 其余所有路由 | 无 Cookie 则跳转 `/login` |

### 3.2 检查逻辑说明

> **重要**：Next.js middleware 运行在 Edge Runtime，不能使用 Node.js 专属模块，
> 也不能直接调用 `api-client`（axios）。因此只检查 `refresh_token` Cookie
> 是否存在作为"已登录"的快速判断。真正的 Token 有效性由 API 请求时后端验证。

### 3.3 middleware.ts 实现

```typescript
// apps/web/src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** 无需认证的公开路径前缀 */
const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
]

/** 完全跳过 middleware 的路径（静态资源、API 内部路由等） */
const SKIP_PATHS = [
  '/_next',
  '/favicon.ico',
  '/api/auth', // 认证相关 API 不拦截
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

function shouldSkip(pathname: string): boolean {
  return SKIP_PATHS.some((p) => pathname.startsWith(p))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 静态资源 / 认证 API 直接放行
  if (shouldSkip(pathname)) {
    return NextResponse.next()
  }

  const hasRefreshToken = request.cookies.has('refresh_token')

  // 已登录用户访问公开路由 → 跳转 dashboard
  if (isPublicPath(pathname) && hasRefreshToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 未登录用户访问需认证路由 → 跳转 login
  if (!isPublicPath(pathname) && !hasRefreshToken) {
    const loginUrl = new URL('/login', request.url)
    // 保留原始路径，登录后可跳回
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // 匹配所有路由，排除 _next 内部路由
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## 4. API Client Token 刷新拦截器

文件：`apps/web/src/lib/api-client.ts`

### 4.1 设计要点

- 请求拦截器：从 Zustand store 读取 `accessToken`，注入 `Authorization` 头
- 响应拦截器：捕获 `401`，调用刷新端点，成功后重试原请求
- **并发防抖**：多个请求同时 401 时，只发一次刷新请求，其余请求排队等待

### 4.2 完整实现

```typescript
// apps/web/src/lib/api-client.ts
import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth-store'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  withCredentials: true, // 自动携带 httpOnly Cookie
})

// ---- 并发刷新控制 ----
let isRefreshing = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token!)
  })
  pendingQueue = []
}

// ---- 请求拦截器：注入 AccessToken ----
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ---- 响应拦截器：处理 401 ----
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean }

    // 非 401 或已重试过，直接抛出
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // 刷新端点本身 401，说明 RefreshToken 已失效
    if (originalRequest.url?.includes('/api/auth/refresh')) {
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    // 已有刷新请求在进行中，排队等待
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest._retry = true
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${token}`,
        }
        return apiClient(originalRequest)
      })
    }

    // 发起刷新请求
    originalRequest._retry = true
    isRefreshing = true

    try {
      const { data } = await apiClient.post<{ accessToken: string }>('/api/auth/refresh')
      const newToken = data.accessToken

      useAuthStore.getState().setAccessToken(newToken)
      processQueue(null, newToken)

      originalRequest.headers = {
        ...originalRequest.headers,
        Authorization: `Bearer ${newToken}`,
      }
      return apiClient(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      useAuthStore.getState().clearAuth()
      window.location.href = '/login'
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default apiClient
```

---

## 5. Auth Store（Zustand）

文件：`apps/web/src/stores/auth-store.ts`

```typescript
// apps/web/src/stores/auth-store.ts
import { create } from 'zustand'
import type { User } from '@decoration-bidding/shared-types'

interface AuthState {
  accessToken: string | null
  user: User | null
  isAuthenticated: boolean
  // Actions
  setAuth: (token: string, user: User) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token, user) =>
    set({ accessToken: token, user, isAuthenticated: true }),

  setAccessToken: (token) =>
    set({ accessToken: token }),

  clearAuth: () =>
    set({ accessToken: null, user: null, isAuthenticated: false }),
}))
```

> **注意**：不使用 `persist` 中间件。RefreshToken 在 httpOnly Cookie 中自动持久化，
> AccessToken 只存内存，页面刷新后通过静默刷新（`/api/auth/refresh`）重新获取。

### 5.1 页面初始化静默刷新

```typescript
// apps/web/src/app/layout.tsx（或 AuthProvider 组件）
'use client'
import { useEffect } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import apiClient from '@/lib/api-client'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  useEffect(() => {
    // 页面加载时尝试静默刷新
    apiClient
      .post<{ accessToken: string; user: User }>('/api/auth/refresh')
      .then(({ data }) => setAuth(data.accessToken, data.user))
      .catch(() => clearAuth())
  }, [])

  return <>{children}</>
}
```

---

## 6. 服务端认证中间件（Fastify）

文件：`apps/core-service/src/shared/middleware/auth.ts`

```typescript
// apps/core-service/src/shared/middleware/auth.ts
import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import { UserRole } from '@decoration-bidding/shared-types'

interface JwtPayload {
  sub: string       // userId
  companyId: string
  role: UserRole
  jti: string       // JWT ID，用于黑名单
}

declare module 'fastify' {
  interface FastifyRequest {
    user: { userId: string; companyId: string; role: UserRole }
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null)

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ success: false, error: 'Missing token' })
    }

    const token = authHeader.slice(7)
    const publicKey = process.env.RS256_PUBLIC_KEY!

    try {
      const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] }) as JwtPayload
      request.user = {
        userId: payload.sub,
        companyId: payload.companyId,
        role: payload.role,
      }
    } catch {
      return reply.status(401).send({ success: false, error: 'Invalid or expired token' })
    }
  })
}

export default fp(authPlugin)

/** 权限检查辅助函数，用于路由处理器前置校验 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
  }
}
```

---

## 7. RS256 密钥管理

### 7.1 密钥分配原则

| 环境变量 | 持有服务 | 用途 |
|----------|----------|------|
| `RS256_PRIVATE_KEY` | `core-service` 独有 | 签发 JWT |
| `RS256_PUBLIC_KEY` | `core-service`、`ai-agent-service` | 验证 JWT |

> 私钥只在 `core-service` 中存在，其他服务持有公钥即可验证 Token，无法伪造。

### 7.2 开发环境生成命令

```bash
# 生成 2048-bit RSA 私钥
openssl genrsa -out private.pem 2048

# 从私钥导出公钥
openssl rsa -in private.pem -pubout -out public.pem

# 转换为单行环境变量格式（换行符替换为 \n）
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private.pem
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' public.pem
```

将输出结果填入 `.env`：

```env
RS256_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
RS256_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"
```

> **安全提示**：`.env` 文件已在 `.gitignore` 中，切勿将私钥提交到版本控制。

---

## 8. 完整登录流程时序

```
用户                前端 (Next.js)           core-service            Redis
 │                       │                        │                    │
 │── 提交登录表单 ────────>│                        │                    │
 │                       │── POST /api/auth/login ─>│                    │
 │                       │                        │── 查询用户 DB        │
 │                       │                        │── 校验密码           │
 │                       │                        │── 检查失败次数 ──────>│
 │                       │                        │<─ 未被锁定 ──────────│
 │                       │                        │── 生成 AccessToken   │
 │                       │                        │── 生成 RefreshToken  │
 │                       │                        │── 存 RefreshToken ──>│
 │                       │                        │   (key: refresh:{jti}, TTL: 7d)
 │                       │<── 200 { accessToken } │                    │
 │                       │    Set-Cookie: refresh_token (httpOnly)     │
 │                       │── setAuth(token, user)  │                    │
 │                       │   (写入 Zustand store)  │                    │
 │<── 跳转 /dashboard ───│                        │                    │
```

**失败锁定逻辑**：

```
失败次数 key：login:fail:{email}，TTL 30 分钟
每次失败：INCR，≥ 5 次返回 429 + 剩余锁定时间
登录成功：DEL login:fail:{email}
```

---

## 9. RefreshToken 黑名单（Redis）

### 9.1 Key 格式与 TTL

```
Key：blacklist:refresh:{jti}
Value：1（占位）
TTL：= RefreshToken 剩余有效期（秒）
```

### 9.2 黑名单检查时机

1. **登出**：将当前 RefreshToken 的 `jti` 加入黑名单
2. **刷新时**：验证 Token 签名后，先查 Redis 黑名单，命中则拒绝并返回 401

### 9.3 实现示例

```typescript
// apps/core-service/src/modules/auth/services/token.service.ts
import { redis } from '@/shared/redis.js'

const BLACKLIST_PREFIX = 'blacklist:refresh:'

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

### 9.4 RefreshToken Rotation 流程

```
客户端发送旧 RefreshToken（httpOnly Cookie）
  → 验证签名 & 有效期
  → 检查黑名单（命中 → 401，可能被盗用，触发告警）
  → 将旧 jti 加入黑名单
  → 生成新 AccessToken + 新 RefreshToken
  → 新 RefreshToken 写入 Redis & 设置新 Cookie
  → 返回新 AccessToken
```

---

## 附录：相关文件索引

| 文件 | 说明 |
|------|------|
| `apps/web/src/middleware.ts` | Next.js 路由保护 |
| `apps/web/src/lib/api-client.ts` | Axios 封装 + 刷新拦截器 |
| `apps/web/src/stores/auth-store.ts` | Zustand 认证状态 |
| `apps/core-service/src/modules/auth/` | 登录/登出/刷新路由与服务 |
| `apps/core-service/src/shared/middleware/auth.ts` | JWT 验证中间件 |
| `packages/shared-types/src/auth.ts` | 认证相关共享类型 |
| `packages/database/prisma/schema.prisma` | User 表结构 |
