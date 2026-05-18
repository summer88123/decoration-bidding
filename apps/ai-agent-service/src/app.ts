import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import websocket from '@fastify/websocket'
import { config } from './config.js'
import { routes } from './routes/index.js'

const isProd = process.env.NODE_ENV === 'production'
const isTTY = process.stdout.isTTY === true

export async function buildApp() {
  // bodyLimit: 50MB，用于接收 PDF 图纸 base64 编码后的大型 JSON 请求体
  const app = Fastify({
    bodyLimit: 50 * 1024 * 1024,
    logger: isProd
      ? { level: config.LOG_LEVEL }
      : {
          level: config.LOG_LEVEL,
          transport: {
            target: 'pino-pretty',
            options: { colorize: isTTY, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
          },
        },
  })

  await app.register(cors)
  await app.register(jwt, { secret: config.JWT_SECRET })
  await app.register(websocket)

  await app.register(routes, { prefix: '/ai' })

  app.get('/health', async () => ({ status: 'ok', service: 'ai-agent-service' }))

  return app
}
