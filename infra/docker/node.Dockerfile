# Node.js 通用 Dockerfile（用于所有 Node.js 服务）
# 构建时通过 --build-arg SERVICE=<service-name> 指定服务
FROM node:20-alpine AS base
RUN npm install -g pnpm@9

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
COPY packages/database/package.json ./packages/database/

ARG SERVICE
COPY apps/${SERVICE}/package.json ./apps/${SERVICE}/

RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

ARG SERVICE
RUN pnpm --filter @decoration-bidding/${SERVICE} build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

ARG SERVICE
COPY --from=builder /app/apps/${SERVICE}/dist ./dist
COPY --from=builder /app/apps/${SERVICE}/package.json ./

RUN npm install --omit=dev

EXPOSE 3000
CMD ["node", "dist/index.js"]
