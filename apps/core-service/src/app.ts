// apps/core-service/src/app.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import { config } from './config.js'
import { errorHandler } from './shared/middleware/error.js'
import { bidRoutes } from './modules/bid/routes.js'
import { authRoutes } from './modules/auth/routes.js'
import { userRoutes } from './modules/user/routes.js'
import { tenderRoutes } from './modules/tender/routes.js'
import { scraperRoutes } from './modules/scraper/routes.js'
import { notifyRoutes } from './modules/notify/routes.js'
import { voiceRoutes } from './modules/voice/routes.js'

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
  await app.register(jwt, {
    secret: {
      private: config.RS256_PRIVATE_KEY || 'dev-secret',
      public: config.RS256_PUBLIC_KEY || 'dev-secret',
    },
    sign: { algorithm: config.RS256_PRIVATE_KEY ? 'RS256' : 'HS256' },
  })
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } })

  app.setErrorHandler(errorHandler)

  // 健康检查
  app.get('/health', async () => ({ status: 'ok', service: 'core-service' }))

  await app.register(bidRoutes, { prefix: '/api' })
  await app.register(authRoutes, { prefix: '/api' })
  await app.register(userRoutes, { prefix: '/api' })
  await app.register(tenderRoutes, { prefix: '/api' })
  await app.register(scraperRoutes, { prefix: '/api' })
  await app.register(notifyRoutes, { prefix: '/api' })
  await app.register(voiceRoutes, { prefix: '/api' })

  return app
}
