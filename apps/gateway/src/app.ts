import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import httpProxy from '@fastify/http-proxy'
import { config } from './config.js'

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
            options: { colorize: isTTY, translateTime: 'SYS:yyyy-mm-dd HH:MM:ss', ignore: 'pid,hostname' },
          },
        },
  })

  // 安全中间件
  await app.register(helmet)
  await app.register(cors, { origin: config.CORS_ORIGIN })
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

  // JWT 认证
  await app.register(jwt, { secret: config.JWT_SECRET })

  // 服务路由代理
  await app.register(httpProxy, {
    upstream: config.USER_SERVICE_URL,
    prefix: '/api/users',
    rewritePrefix: '/users',
  })

  await app.register(httpProxy, {
    upstream: config.TENDER_SERVICE_URL,
    prefix: '/api/tenders',
    rewritePrefix: '/tenders',
  })

  await app.register(httpProxy, {
    upstream: config.BID_SERVICE_URL,
    prefix: '/api/bids',
    rewritePrefix: '/bids',
  })

  await app.register(httpProxy, {
    upstream: config.SCRAPER_SERVICE_URL,
    prefix: '/api/scraper',
    rewritePrefix: '/scraper',
  })

  await app.register(httpProxy, {
    upstream: config.AI_AGENT_SERVICE_URL,
    prefix: '/api/ai',
    rewritePrefix: '/ai',
  })

  await app.register(httpProxy, {
    upstream: config.NOTIFY_SERVICE_URL,
    prefix: '/api/notify',
    rewritePrefix: '/notify',
  })

  await app.register(httpProxy, {
    upstream: config.VOICE_SERVICE_URL,
    prefix: '/api/voice',
    rewritePrefix: '/voice',
  })

  await app.register(httpProxy, {
    upstream: config.BIM_SERVICE_URL,
    prefix: '/api/bim',
    rewritePrefix: '/bim',
  })

  // 健康检查
  app.get('/health', async () => ({ status: 'ok', service: 'gateway' }))

  return app
}
