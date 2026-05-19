# 精简架构重构实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 10 个微服务精简为 4 个（web + core-service + ai-agent-service + bim-service），删除 RabbitMQ，降低本地开发启动成本，加速 MVP 验证。

**Architecture:** `core-service` 合并原 gateway/user/tender/bid/scraper/notify/voice 七个服务，内部按 `modules/<domain>` 目录组织，每个 module 保持 handlers → services → repositories 分层。`ai-agent-service` 和 `bim-service` 因技术边界不同保持独立。异步任务用 BullMQ（基于已有 Redis）替代 RabbitMQ。

**Tech Stack:** Node.js 20, Fastify 4, TypeScript 5, BullMQ, Prisma, pnpm workspaces, Turborepo, Docker Compose

**Design Doc:** `docs/superpowers/specs/2026-05-19-lean-architecture-refactor-design.md`

---

## Chunk 1：删除废弃服务目录 & 更新基础设施配置

### Task 1: 删除空壳微服务目录

**Files:**
- Delete: `apps/gateway/`
- Delete: `apps/user-service/`
- Delete: `apps/tender-service/`
- Delete: `apps/scraper-service/`
- Delete: `apps/notify-service/`
- Delete: `apps/voice-service/`

- [ ] **Step 1: 删除六个空壳服务目录**

```bash
cd apps
rm -rf gateway user-service tender-service scraper-service notify-service voice-service
```

- [ ] **Step 2: 确认仅剩下保留的服务**

```bash
ls apps/
# 期望输出：ai-agent-service  bid-service  bim-service  web
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused microservice stubs"
```

---

### Task 2: 更新 docker-compose.infra.yml — 删除 RabbitMQ

**Files:**
- Modify: `docker-compose.infra.yml`

- [ ] **Step 1: 删除 rabbitmq service 和对应 volume**

将 `docker-compose.infra.yml` 中 `rabbitmq:` 服务块（第 36-51 行）整段删除，并删除 `volumes:` 下的 `rabbitmq_data:`。

最终 `docker-compose.infra.yml` 应为：

```yaml
# docker-compose.infra.yml
version: '3.9'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: db-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: decoration_bidding
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: db-redis
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: db-minio
    command: server /data --console-address ':9001'
    ports:
      - '9000:9000'
      - '9001:9001'
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.infra.yml
git commit -m "chore: remove RabbitMQ from infra, use BullMQ instead"
```

---

## Chunk 2：创建 core-service 骨架

### Task 3: 初始化 core-service 目录结构与 package.json

**Files:**
- Create: `apps/core-service/package.json`
- Create: `apps/core-service/tsconfig.json`
- Create: `apps/core-service/src/index.ts`
- Create: `apps/core-service/src/app.ts`
- Create: `apps/core-service/src/config.ts`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p apps/core-service/src/modules/{auth,user,tender,bid,scraper,notify,voice}
mkdir -p apps/core-service/src/queues/workers
mkdir -p apps/core-service/src/shared/{middleware,plugins}
```

- [ ] **Step 2: 创建 package.json**

```json
// apps/core-service/package.json
{
  "name": "@decoration-bidding/core-service",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "lint": "eslint src/",
    "test": "vitest",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@decoration-bidding/database": "workspace:*",
    "@decoration-bidding/shared-types": "workspace:*",
    "@decoration-bidding/shared-utils": "workspace:^",
    "@fastify/cors": "^9.0.0",
    "@fastify/helmet": "^11.0.0",
    "@fastify/jwt": "^8.0.0",
    "@fastify/multipart": "^8.3.1",
    "@fastify/rate-limit": "^9.0.0",
    "@fastify/static": "^7.0.4",
    "bullmq": "^5.0.0",
    "fastify": "^4.26.0",
    "pino": "^9.0.0",
    "undici": "^8.3.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20.12.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
// apps/core-service/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 创建 src/config.ts**

```ts
// apps/core-service/src/config.ts
export const config = {
  PORT: Number(process.env.PORT) || 8080,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/decoration_bidding',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  BASE_URL: process.env.BASE_URL || 'http://localhost:8080',
  BIM_SERVICE_URL: process.env.BIM_SERVICE_URL || 'http://localhost:3008',
  AI_AGENT_SERVICE_URL: process.env.AI_AGENT_SERVICE_URL || 'http://localhost:3005',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
} as const
```

- [ ] **Step 5: 创建 src/index.ts**

```ts
// apps/core-service/src/index.ts
import { buildApp } from './app.js'
import { config } from './config.js'

const app = await buildApp()
await app.listen({ port: config.PORT, host: '0.0.0.0' })
```

- [ ] **Step 6: Commit**

```bash
git add apps/core-service/
git commit -m "feat(core-service): scaffold package structure"
```

---

### Task 4: 创建 core-service src/app.ts 骨架

**Files:**
- Create: `apps/core-service/src/app.ts`
- Create: `apps/core-service/src/shared/middleware/auth.ts`
- Create: `apps/core-service/src/shared/middleware/error.ts`

- [ ] **Step 1: 创建 src/shared/middleware/auth.ts**

```ts
// apps/core-service/src/shared/middleware/auth.ts
import type { FastifyRequest, FastifyReply } from 'fastify'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ success: false, error: 'Unauthorized' })
  }
}
```

- [ ] **Step 2: 创建 src/shared/middleware/error.ts**

```ts
// apps/core-service/src/shared/middleware/error.ts
import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify'

export function errorHandler(error: FastifyError, _req: FastifyRequest, reply: FastifyReply) {
  const statusCode = error.statusCode ?? 500
  reply.code(statusCode).send({
    success: false,
    error: statusCode >= 500 ? 'Internal Server Error' : error.message,
  })
}
```

- [ ] **Step 3: 创建 src/app.ts 骨架（路由稍后逐步注册）**

```ts
// apps/core-service/src/app.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { config } from './config.js'
import { errorHandler } from './shared/middleware/error.js'

const isProd = process.env.NODE_ENV === 'production'
const isTTY = process.stdout.isTTY === true

export async function buildApp() {
  const app = Fastify({
    logger: isProd
      ? { level: config.LOG_LEVEL }
      : {
          level: config.LOG_LEVEL,
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: isTTY,
              translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        },
  })

  await app.register(helmet)
  await app.register(cors, { origin: config.CORS_ORIGIN })
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })
  await app.register(jwt, { secret: config.JWT_SECRET })
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })

  app.setErrorHandler(errorHandler)

  // 健康检查
  app.get('/health', async () => ({ status: 'ok', service: 'core-service' }))

  // TODO: 在后续 Task 中逐步注册各 module 路由

  return app
}
```

- [ ] **Step 4: 安装依赖并确认编译通过**

```bash
cd apps/core-service && pnpm install
pnpm build
# 期望：编译成功，无 TS 错误
```

- [ ] **Step 5: Commit**

```bash
git add apps/core-service/src/
git commit -m "feat(core-service): add app skeleton with middleware"
```

---

## Chunk 3：迁移 bid-service 代码到 core-service/modules/bid

### Task 5: 迁移 bid module

**Files:**
- Create: `apps/core-service/src/modules/bid/` （从 bid-service 复制并调整）
- Create: `apps/core-service/src/modules/bid/routes.ts`

bid-service 现有代码结构：
```
handlers/document.handler.ts
repositories/bid-document.repository.ts
repositories/bid-item.repository.ts
routes/documents.route.ts
services/document-events.ts
services/document.service.ts
storage/local-storage.service.ts
storage/storage.factory.ts
storage/storage.interface.ts
```

- [ ] **Step 1: 复制 bid-service 源码到 core-service modules**

```bash
cp -r apps/bid-service/src/handlers  apps/core-service/src/modules/bid/
cp -r apps/bid-service/src/repositories apps/core-service/src/modules/bid/
cp -r apps/bid-service/src/services apps/core-service/src/modules/bid/
cp -r apps/bid-service/src/storage apps/core-service/src/modules/bid/
```

- [ ] **Step 2: 创建 apps/core-service/src/modules/bid/routes.ts**

将原 `apps/bid-service/src/routes/documents.route.ts` 内容复制，修改导入路径（相对路径从 `../` 改为 `./`）：

```ts
// apps/core-service/src/modules/bid/routes.ts
import type { FastifyPluginAsync } from 'fastify'
import { DocumentService } from './services/document.service.js'
import { createDocumentHandlers } from './handlers/document.handler.js'
import { createStorageService } from './storage/storage.factory.js'
import { config } from '../../config.js'
import { onDocEvent } from './services/document-events.js'
import { BidDocumentRepository } from './repositories/bid-document.repository.js'

export const bidRoutes: FastifyPluginAsync = async (app) => {
  const storage = createStorageService(config.STORAGE_DRIVER, config.UPLOAD_DIR, config.BASE_URL)
  const svc = new DocumentService(storage, config.BIM_SERVICE_URL, config.AI_AGENT_SERVICE_URL)
  const handlers = createDocumentHandlers(svc)

  app.post('/bids/:bidId/documents', handlers.upload)
  app.get('/bids/:bidId/documents/:docId/status', handlers.getStatus)
  app.get('/bids/:bidId/items', handlers.getItems)

  app.get<{ Params: { bidId: string; docId: string } }>(
    '/bids/:bidId/documents/:docId/stream',
    (req, reply) => {
      reply.hijack()
      const raw = reply.raw
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })
      raw.write(': connected\n\n')

      const send = (data: unknown) => {
        if (!raw.destroyed) raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      void BidDocumentRepository.findById(req.params.docId).then((doc) => {
        if (doc?.status === 'completed') {
          send({ type: 'done', count: 0 })
          raw.end()
          return
        }
        if (doc?.status === 'failed') {
          send({ type: 'error', message: doc.errorMsg ?? '未知错误' })
          raw.end()
          return
        }

        const off = onDocEvent(req.params.docId, (event) => {
          send(event)
          if (event.type === 'done' || event.type === 'error') {
            raw.end()
            off()
            clearInterval(keepAlive)
          }
        })

        const keepAlive = setInterval(() => { if (!raw.destroyed) raw.write(': ping\n\n') }, 15000)
        req.raw.on('close', () => { off(); clearInterval(keepAlive) })
      })
    },
  )
}
```

- [ ] **Step 3: 在 app.ts 中注册 bidRoutes**

在 `apps/core-service/src/app.ts` 的 `// TODO` 位置添加：

```ts
import { bidRoutes } from './modules/bid/routes.js'
// ...
await app.register(bidRoutes)
```

- [ ] **Step 4: 验证编译通过**

```bash
cd apps/core-service && pnpm build
# 期望：无 TS 错误
```

- [ ] **Step 5: Commit**

```bash
git add apps/core-service/src/modules/bid/
git add apps/core-service/src/app.ts
git commit -m "feat(core-service): migrate bid module from bid-service"
```

---

## Chunk 4：创建空骨架 modules（auth/user/tender/scraper/notify/voice）

### Task 6: 为其余 module 创建最小骨架

每个 module 只需一个占位 `routes.ts`，日后按需填充业务逻辑。

**Files:**
- Create: `apps/core-service/src/modules/auth/routes.ts`
- Create: `apps/core-service/src/modules/user/routes.ts`
- Create: `apps/core-service/src/modules/tender/routes.ts`
- Create: `apps/core-service/src/modules/scraper/routes.ts`
- Create: `apps/core-service/src/modules/notify/routes.ts`
- Create: `apps/core-service/src/modules/voice/routes.ts`

- [ ] **Step 1: 创建各 module 骨架路由**

每个文件使用如下模板（以 user 为例，其余同理修改 prefix 和 service 名）：

```ts
// apps/core-service/src/modules/user/routes.ts
import type { FastifyPluginAsync } from 'fastify'

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get('/users/health', async () => ({ module: 'user', status: 'stub' }))
  // TODO: 实现用户 CRUD 路由
}
```

对应其他 module 的 export 名称和 prefix：

| Module | export 名 | 骨架路由 |
|--------|-----------|---------|
| auth | `authRoutes` | `POST /auth/login`, `POST /auth/register` |
| user | `userRoutes` | `GET /users/health` |
| tender | `tenderRoutes` | `GET /tenders/health` |
| scraper | `scraperRoutes` | `GET /scraper/health` |
| notify | `notifyRoutes` | `GET /notify/health` |
| voice | `voiceRoutes` | `GET /voice/health` |

- [ ] **Step 2: 在 app.ts 中注册所有 module 路由**

更新 `apps/core-service/src/app.ts`，在现有 `bidRoutes` 注册后补充：

```ts
import { authRoutes } from './modules/auth/routes.js'
import { userRoutes } from './modules/user/routes.js'
import { tenderRoutes } from './modules/tender/routes.js'
import { scraperRoutes } from './modules/scraper/routes.js'
import { notifyRoutes } from './modules/notify/routes.js'
import { voiceRoutes } from './modules/voice/routes.js'

// 在 buildApp 内：
await app.register(authRoutes)
await app.register(userRoutes)
await app.register(tenderRoutes)
await app.register(scraperRoutes)
await app.register(notifyRoutes)
await app.register(voiceRoutes)
```

- [ ] **Step 3: 验证编译**

```bash
cd apps/core-service && pnpm build
# 期望：无错误
```

- [ ] **Step 4: 本地手动验证健康检查**

```bash
cd apps/core-service && pnpm dev &
sleep 3
curl http://localhost:8080/health
# 期望：{"status":"ok","service":"core-service"}
curl http://localhost:8080/users/health
# 期望：{"module":"user","status":"stub"}
```

- [ ] **Step 5: Commit**

```bash
git add apps/core-service/src/modules/
git add apps/core-service/src/app.ts
git commit -m "feat(core-service): add stub routes for all modules"
```

---

## Chunk 5：BullMQ 队列定义 & 更新 docker-compose.yml

### Task 7: 创建 BullMQ 队列定义

**Files:**
- Create: `apps/core-service/src/queues/index.ts`
- Create: `apps/core-service/src/queues/workers/scraper.worker.ts`
- Create: `apps/core-service/src/queues/workers/notify.worker.ts`

- [ ] **Step 1: 创建 src/queues/index.ts**

```ts
// apps/core-service/src/queues/index.ts
import { Queue } from 'bullmq'
import { config } from '../config.js'

const connection = { url: config.REDIS_URL }

export const scraperQueue = new Queue('scraper', { connection })
export const notifyQueue = new Queue('notify', { connection })
export const bidGenerateQueue = new Queue('bid.generate', { connection })
```

- [ ] **Step 2: 创建 scraper worker 骨架**

```ts
// apps/core-service/src/queues/workers/scraper.worker.ts
import { Worker } from 'bullmq'
import { config } from '../../config.js'
import { createLogger } from '@decoration-bidding/shared-utils'

const logger = createLogger('scraper-worker')
const connection = { url: config.REDIS_URL }

export const scraperWorker = new Worker(
  'scraper',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'scraper job received')
    // TODO: 实现爬虫逻辑
  },
  { connection },
)
```

- [ ] **Step 3: 创建 notify worker 骨架**

```ts
// apps/core-service/src/queues/workers/notify.worker.ts
import { Worker } from 'bullmq'
import { config } from '../../config.js'
import { createLogger } from '@decoration-bidding/shared-utils'

const logger = createLogger('notify-worker')
const connection = { url: config.REDIS_URL }

export const notifyWorker = new Worker(
  'notify',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'notify job received')
    // TODO: 实现通知发送逻辑
  },
  { connection },
)
```

- [ ] **Step 4: 在 index.ts 中启动 workers**

更新 `apps/core-service/src/index.ts`：

```ts
// apps/core-service/src/index.ts
import { buildApp } from './app.js'
import { config } from './config.js'
import './queues/workers/scraper.worker.js'
import './queues/workers/notify.worker.js'

const app = await buildApp()
await app.listen({ port: config.PORT, host: '0.0.0.0' })
```

- [ ] **Step 5: Commit**

```bash
git add apps/core-service/src/queues/
git add apps/core-service/src/index.ts
git commit -m "feat(core-service): add BullMQ queue and worker stubs"
```

---

### Task 8: 更新 docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: 重写 docker-compose.yml**

删除已废弃的 6 个服务，新增 `core-service`：

```yaml
# docker-compose.yml
version: '3.9'

include:
  - docker-compose.infra.yml

x-node-service: &node-service
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/decoration_bidding
    REDIS_URL: redis://redis:6379
    JWT_SECRET: dev-secret-change-in-production
    NODE_ENV: development
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy

services:
  web:
    <<: *node-service
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    ports:
      - '3000:3000'
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8080

  core-service:
    <<: *node-service
    build:
      context: .
      dockerfile: apps/core-service/Dockerfile
    ports:
      - '8080:8080'
    environment:
      PORT: '8080'
      BIM_SERVICE_URL: http://bim-service:3008
      AI_AGENT_SERVICE_URL: http://ai-agent-service:3005
      STORAGE_DRIVER: local
      BASE_URL: http://localhost:8080

  ai-agent-service:
    <<: *node-service
    build:
      context: .
      dockerfile: apps/ai-agent-service/Dockerfile
    ports:
      - '3005:3005'
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}

  bim-service:
    build:
      context: .
      dockerfile: apps/bim-service/Dockerfile
    ports:
      - '3008:3008'
    environment:
      DATABASE_URL: postgresql+asyncpg://postgres:postgres@postgres:5432/decoration_bidding
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: minioadmin
      S3_SECRET_KEY: minioadmin
    depends_on:
      postgres:
        condition: service_healthy
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: update docker-compose to 4-service lean architecture"
```

---

## Chunk 6：创建 core-service Dockerfile & 更新文档

### Task 9: 创建 core-service Dockerfile

**Files:**
- Create: `apps/core-service/Dockerfile`

- [ ] **Step 1: 检查其他服务 Dockerfile 模板**

```bash
cat infra/docker/node.Dockerfile
# 参考现有模板格式
```

- [ ] **Step 2: 创建 Dockerfile（参考 bid-service 或 node.Dockerfile 模板）**

```dockerfile
# apps/core-service/Dockerfile
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/core-service/package.json apps/core-service/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY packages/ packages/
COPY apps/core-service/ apps/core-service/
RUN pnpm --filter @decoration-bidding/core-service build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/core-service/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

> **注意：** 若现有 node.Dockerfile 模板与上述格式不同，以实际模板为准，保持风格一致。

- [ ] **Step 3: Commit**

```bash
git add apps/core-service/Dockerfile
git commit -m "chore(core-service): add Dockerfile"
```

---

### Task 10: 更新 AGENTS.md 和设计文档

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/superpowers/specs/2026-05-19-lean-architecture-refactor-design.md`

- [ ] **Step 1: 更新 AGENTS.md 仓库结构部分**

将 AGENTS.md 中的 `apps/` 目录结构从原 10 个服务更新为：

```
apps/
├── web/               # Next.js 14 前端（port 3000）
├── core-service/      # 核心业务服务 Fastify（port 8080）
│   └── src/modules/   # auth / user / tender / bid / scraper / notify / voice
├── ai-agent-service/  # AI 智能体服务（port 3005）
└── bim-service/       # BIM/IFC Python 服务（port 3008）
```

- [ ] **Step 2: 更新 AGENTS.md 服务间通信表格**

将 gateway 相关描述改为 `core-service` 直接暴露 REST API，前端直连 `core-service:8080`。

- [ ] **Step 3: 更新 AGENTS.md 中的 Node.js 服务目录结构约定**

补充 `core-service` 的 `modules/` 分层说明：

```
src/
├── index.ts
├── app.ts
├── config.ts
├── modules/
│   └── <domain>/         # 每个业务域一个 module
│       ├── routes.ts     # Fastify 插件，注册该域的所有路由
│       ├── handlers/     # 路由处理函数
│       ├── services/     # 业务逻辑
│       └── repositories/ # 数据库访问
├── queues/
│   ├── index.ts          # BullMQ Queue 实例
│   └── workers/          # BullMQ Worker 实现
└── shared/
    └── middleware/       # 认证、错误处理中间件
```

- [ ] **Step 4: Commit 文档更新**

```bash
git add AGENTS.md docs/superpowers/specs/
git commit -m "docs: update AGENTS.md and spec to reflect lean architecture"
```

---

### Task 11: 删除 bid-service（完成迁移后）

**Files:**
- Delete: `apps/bid-service/`

- [ ] **Step 1: 确认 core-service 中的 bid module 已正常工作**

```bash
# 启动 core-service
cd apps/core-service && pnpm dev &
sleep 3
# 验证 bid 路由存在
curl -s http://localhost:8080/health | grep core-service
```

- [ ] **Step 2: 删除 bid-service 目录**

```bash
rm -rf apps/bid-service
```

- [ ] **Step 3: 确认 pnpm-workspace.yaml 无需修改**

`pnpm-workspace.yaml` 使用 `apps/*` 通配符，删除目录后自动生效，无需手动更新。

- [ ] **Step 4: 重新安装依赖确认无引用遗留**

```bash
pnpm install
pnpm build
# 期望：全部编译通过，无 missing package 错误
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove bid-service, fully migrated to core-service"
```

---

## 验收标准

完成以上所有 Task 后，执行以下验证：

```bash
# 1. 启动基础设施（无 RabbitMQ）
pnpm run infra:up
docker ps | grep -E "postgres|redis|minio"
# 期望：3 个容器，无 rabbitmq

# 2. 启动所有应用服务
pnpm dev

# 3. 验证核心端点
curl http://localhost:8080/health
# 期望：{"status":"ok","service":"core-service"}

curl http://localhost:3005/health
# 期望：{"status":"ok","service":"ai-agent-service"}

curl http://localhost:3008/health
# 期望：{"status":"ok"} 或类似 Python FastAPI 响应

# 4. 验证 bid 功能未退步（若有测试）
cd apps/core-service && pnpm test
```
