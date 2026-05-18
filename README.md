# 投标辅助系统

建筑及室内设计行业的 AI 驱动投标辅助平台实验项目

---

## 快速开始

### 前置条件

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- Python 3.11+（bim-service 需要）

### 初始化

```bash
# 1. 复制环境变量配置
cp .env.example .env

# 2. 启动基础设施（PostgreSQL、Redis、RabbitMQ、MinIO）
pnpm run infra:up

# 3. 安装依赖
pnpm install

# 4. 数据库迁移
cd packages/database && pnpm db:migrate && cd ../..
```

### 服务管理（dev.sh）

```bash
./dev.sh start    # 启动所有服务（默认）
./dev.sh stop     # 停止所有服务
./dev.sh restart  # 重启所有服务
./dev.sh logs     # 实时查看所有服务日志
./dev.sh status   # 查看各服务健康状态
```

服务启动后访问：

- 前端：http://localhost:3000
- API 网关：http://localhost:8080

日志文件保存于 `logs/` 目录，各服务独立日志文件（如 `logs/web.log`）。

---

## 数据库管理

```bash
cd packages/database

pnpm db:migrate    # 执行开发迁移
pnpm db:generate   # 重新生成 Prisma Client
pnpm db:studio     # 打开 Prisma Studio
```

> Schema 统一维护于 `packages/database/prisma/schema.prisma`，不在各服务中重复定义。
