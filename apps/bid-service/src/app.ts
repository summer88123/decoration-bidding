import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { routes } from './routes/index.js'
import { documentsRoute } from './routes/documents.route.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
              translateTime: 'SYS:HH:MM:ss',
              ignore: 'pid,hostname',
            },
          },
        },
  })

  await app.register(cors)
  await app.register(jwt, { secret: config.JWT_SECRET })
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } }) // 50 MB

  const uploadDir = path.resolve(__dirname, '..', config.UPLOAD_DIR)
  await app.register(staticFiles, {
    root: uploadDir,
    prefix: '/uploads/',
  })

  // 注册路由（documentsRoute 已内含 /bids 前缀，与 gateway rewritePrefix 对齐）
  await app.register(routes, { prefix: '/bid-service' })
  await app.register(documentsRoute)

  // 健康检查
  app.get('/health', async () => ({ status: 'ok', service: 'bid-service' }))

  return app
}
