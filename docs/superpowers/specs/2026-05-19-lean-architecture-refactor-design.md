# 精简架构重构设计

| 属性 | 值 |
|------|-----|
| 日期 | 2026-05-19 |
| 状态 | 已实施 |
| 决策 | 方案 B：保守精简（4 进程） |

---

## 背景与动机

当前项目为 10 个微服务的 Monorepo，大多数服务（user/tender/scraper/notify/voice）尚未实现业务逻辑，仅为空架子。完整启动本地开发环境需要 14+ 个进程，基础设施噪音过高，不利于 MVP 阶段快速验证业务价值。

## 目标

在保留核心技术边界（AI 隔离、Python/BIM 隔离）的前提下，将 6 个空壳 Node.js 微服务合并为一个 `core-service`，删除 RabbitMQ，降低本地开发启动成本。

## 服务边界

### 保留的服务

| 服务 | 端口 | 语言 | 说明 |
|------|------|------|------|
| `web` | 3000 | Next.js | 前端，不变 |
| `core-service` | 8080 | Node.js/Fastify | 合并 gateway + user + tender + bid + scraper + notify + voice |
| `ai-agent-service` | 3005 | Node.js/Fastify | AI 服务，不变（资源特性与 CRUD 不同，保持独立） |
| `bim-service` | 3008 | Python/FastAPI | BIM 服务，不变（Python 生态边界） |

### 删除的独立服务

- `apps/gateway/`
- `apps/user-service/`
- `apps/tender-service/`
- `apps/scraper-service/`
- `apps/notify-service/`
- `apps/voice-service/`

### 基础设施变更

- **删除 RabbitMQ**：改用 BullMQ（基于 Redis，已有依赖，无需新增进程）
- **保留**：PostgreSQL + pgvector、Redis、MinIO

本地开发进程从 14+ 降至 **7 个**（web + core + ai-agent + bim + postgres + redis + minio）。

---

## core-service 内部结构

```
apps/core-service/src/
├── index.ts
├── app.ts              # 注册所有插件和路由
├── config.ts
├── modules/
│   ├── auth/           # JWT 认证
│   │   ├── handlers/
│   │   ├── services/
│   │   └── routes.ts
│   ├── user/           # 用户管理（原 user-service）
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── routes.ts
│   ├── tender/         # 招标项目（原 tender-service）
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── routes.ts
│   ├── bid/            # 标书（迁移原 bid-service 代码）
│   │   ├── handlers/
│   │   ├── services/
│   │   ├── repositories/
│   │   └── routes.ts
│   ├── scraper/        # 爬虫触发（原 scraper-service）
│   │   ├── handlers/
│   │   ├── services/
│   │   └── routes.ts
│   ├── notify/         # 通知（原 notify-service）
│   │   ├── handlers/
│   │   ├── services/
│   │   └── routes.ts
│   └── voice/          # 语音（原 voice-service）
│       ├── handlers/
│       ├── services/
│       └── routes.ts
├── queues/
│   ├── index.ts        # BullMQ 队列定义
│   ├── scraper.queue.ts
│   ├── notify.queue.ts
│   └── workers/        # BullMQ Worker 定义
│       ├── scraper.worker.ts
│       └── notify.worker.ts
└── shared/
    ├── middleware/
    │   ├── auth.ts     # JWT 验证中间件
    │   └── error.ts    # 统一错误处理
    └── plugins/        # Fastify 插件注册
```

每个 module 内部遵循 `handlers → services → repositories` 分层，与原微服务约定一致。未来若需拆分，module 目录直接提取为独立服务。

---

## 数据流

### 同步路径（HTTP）

```
web (3000)
  → core-service (8080)       # 所有 CRUD 操作
  → ai-agent-service (3005)   # AI 任务触发
  → bim-service (3008)        # BIM 文件处理
```

### 异步路径（BullMQ via Redis）

```
core-service (生产者)
  → scraper.queue    → scraper worker (core-service 内部)
  → notify.queue     → notify worker (core-service 内部)
  → bid.generate.queue → ai-agent-service (HTTP webhook 回调)
```

### AI 流式响应（WebSocket）

`web` 直连 `ai-agent-service` 的 `/ws/ai` 端点，绕过 `core-service`，避免代理大量流式数据。

---

## 需要变更的文件

| 变更类型 | 路径 | 说明 |
|----------|------|------|
| 删除 | `apps/gateway/` | 合并进 core-service |
| 删除 | `apps/user-service/` | 合并进 core-service |
| 删除 | `apps/tender-service/` | 合并进 core-service |
| 删除 | `apps/scraper-service/` | 合并进 core-service |
| 删除 | `apps/notify-service/` | 合并进 core-service |
| 删除 | `apps/voice-service/` | 合并进 core-service |
| 新增 | `apps/core-service/` | 合并后的核心服务 |
| 迁移 | `apps/bid-service/` → `apps/core-service/src/modules/bid/` | 现有代码迁移 |
| 修改 | `docker-compose.yml` | 删除 6 个服务，新增 core-service |
| 修改 | `docker-compose.infra.yml` | 删除 RabbitMQ，确认 Redis 配置 |
| 修改 | `apps/web/src/lib/api-client.ts` | 指向 core-service:8080 |
| 修改 | `AGENTS.md` | 更新架构描述 |
| 修改 | `pnpm-workspace.yaml` | 更新 apps 路径 |

---

## 未来拆分路径

当某个业务模块需要独立扩容时，将 `core-service/src/modules/<module>` 提取为独立服务的步骤：

1. 复制 module 目录到新的 `apps/<module>-service/src/`
2. 添加独立的 `app.ts`、`config.ts`、`Dockerfile`
3. 在 `docker-compose.yml` 新增服务
4. 将 `core-service` 中对该 module 的本地调用改为 HTTP 请求

每次只需拆一个 module，风险可控。

---

## 成功标准

- 本地开发 `pnpm dev` 可以正常启动全部 4 个应用服务
- `apps/bid-service/` 的现有代码在 `core-service` 中功能不退步
- `docker-compose.infra.yml` 不再包含 RabbitMQ
- `ai-agent-service` 和 `bim-service` 无需修改即可运行
