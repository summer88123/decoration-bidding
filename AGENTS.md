# AGENTS.md — 投标辅助系统开发约定

本文件供 AI 编码助手阅读，描述项目架构约定、开发规范和重要设计决策。

请使用中文回复。

---

## 项目概览

香港建筑及室内设计行业的 AI 驱动投标辅助系统。Monorepo，包含 4 个服务（精简架构）。

**规格书**：`系统设计规格书.md`（所有功能需求的权威来源）

---

## 仓库结构

```
decoration-bidding/
├── apps/
│   ├── web/               # Next.js 14 前端（port 3000）
│   ├── core-service/      # 核心业务服务 Fastify（port 8080）
│   │   └── src/modules/   # auth / user / tender / bid / scraper / notify / voice
│   ├── ai-agent-service/  # AI 智能体服务（port 3005）
│   └── bim-service/       # BIM/IFC Python 服务（port 3008）
├── packages/
│   ├── shared-types/      # 所有服务共用的 TypeScript 类型
│   ├── shared-utils/      # 通用工具函数
│   └── database/          # Prisma Schema + PrismaClient 单一来源
├── infra/
│   ├── docker/            # Dockerfile 模板
│   └── k8s/               # Kubernetes 配置（Kustomize）
└── .github/workflows/     # CI/CD pipeline
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 App Router, React 18, TypeScript, TailwindCSS, shadcn/ui |
| 后端 API | Node.js, Fastify 4, TypeScript, Prisma ORM |
| AI 服务 | LangGraph JS, Vercel AI SDK, pgvector RAG |
| BIM/IFC | Python 3.11, FastAPI, IfcOpenShell |
| 数据库 | PostgreSQL 16 + pgvector, Redis 7 |
| 消息队列 | BullMQ（基于 Redis） |
| 文件存储 | S3-compatible（开发用 MinIO） |
| 构建 | pnpm workspaces + Turborepo |

---

## 开发约定

### TypeScript

- 严格模式（`strict: true`）
- 导入使用 `.js` 扩展名（ESM）
- 类型优先从 `@decoration-bidding/shared-types` 导入
- 避免 `any`；使用 `unknown` + 类型守卫

### Node.js 服务（Fastify）

每个服务结构：
```
src/
├── index.ts          # 启动入口，仅调用 buildApp()
├── app.ts            # Fastify 实例创建、插件注册
├── config.ts         # 环境变量，使用 const config = {...} as const
├── routes/index.ts   # 路由注册，用 prefix 分组
├── handlers/         # 路由处理函数（纯函数，从 services 调用）
├── services/         # 业务逻辑
└── repositories/     # 数据库访问（通过 @decoration-bidding/database）
```

# core-service 额外结构（模块化单体）：
```
src/
├── modules/
│   └── <domain>/         # 每个业务域一个 module
│       ├── routes.ts     # Fastify 插件，注册该域的所有路由
│       ├── handlers/     # 路由处理函数
│       ├── services/     # 业务逻辑
│       └── repositories/ # 数据库访问
├── queues/
│   ├── index.ts          # BullMQ Queue 实例（替代 RabbitMQ）
│   └── workers/          # BullMQ Worker 实现
└── shared/
    └── middleware/       # 认证、错误处理中间件
```

- 所有路由返回 `ApiResponse<T>`（来自 shared-types）
- 用 `ok()` / `fail()` 工具函数（来自 shared-utils）包装响应
- 用 Zod 验证请求 Body/Query/Params

### Python 服务（BIM/IFC）

- FastAPI + Pydantic v2
- Schemas 在 `src/models/schemas.py`
- 业务逻辑在 `src/services/`
- 路由在 `src/api/routes.py`

### 前端（Next.js）

- App Router（`src/app/`）
- 服务端组件优先，必要时加 `'use client'`
- API 调用通过 `src/lib/api-client.ts`（axios 封装）
- 状态管理：Zustand（全局），React Hook Form（表单）
- 样式：TailwindCSS + shadcn/ui，工具函数用 `cn()` from `src/lib/utils.ts`

---

## 数据库

### Schema 修改

只在 `packages/database/prisma/schema.prisma` 修改，**不要**在各服务中重复定义。

```bash
cd packages/database
pnpm db:migrate   # 开发迁移
pnpm db:generate  # 重新生成 Prisma Client
```

### 使用 Prisma Client

```ts
import { prisma } from '@decoration-bidding/database'
```

---

## 服务间通信

| 模式 | 用途 | 实现 |
|------|------|------|
| REST | 前端直连 core-service:8080 | HTTP → core-service |
| HTTP | core-service 调用 ai-agent-service / bim-service | 内部服务间直接 HTTP |
| BullMQ | 异步任务（爬虫→AI→通知） | BullMQ（基于 Redis） |
| WebSocket | AI 进度流、语音流 | Socket.io + @fastify/websocket |

**BullMQ 队列命名约定**：`<source>.<event>`，如 `tender.raw`、`bid.generated`

---

## AI 智能体服务约定

- Skill 定义在 `apps/ai-agent-service/src/skills/`
- 每个 Skill 是一个独立模块，导出 `execute(input, context)` 函数
- RAG 检索通过统一的 `RagService` 调用 pgvector
- LLM 调用统一通过 Vercel AI SDK（`ai` 包）
- 8 个 Skill 清单见 `src/skills/registry.ts`

---

## 环境变量

复制 `.env.example` 为 `.env`，填入实际值。各服务的端口和服务地址已有默认值，本地开发无需修改。

---

## 启动开发环境

```bash
# 1. 启动基础设施
pnpm run infra:up

# 2. 安装依赖
pnpm install

# 3. 数据库迁移
cd packages/database && pnpm db:migrate

# 4. 启动所有服务
pnpm dev
```

---

## 命名规范

| 对象 | 规范 | 示例 |
|------|------|------|
| 文件名 | kebab-case | `bid-item.ts` |
| 类 | PascalCase | `BidItemService` |
| 函数/变量 | camelCase | `getBidItems()` |
| 常量 | UPPER_SNAKE | `MAX_FILE_SIZE` |
| 数据库表 | snake_case | `bid_items` |
| API 路径 | kebab-case | `/api/bid-items` |
| RabbitMQ 队列 | dot.notation | `tender.raw` |

---

## 不要做的事

- 不要在各服务中重复定义已在 `shared-types` 存在的类型
- 不要绕过 core-service 直接调用 ai-agent-service / bim-service（前端侧）
- 不要在 `bim-service` 以外使用 Python
- 不要在 `ai-agent-service` 以外直接调用 LLM API
- 不要修改 Prisma Schema 后忘记运行 `db:generate`
