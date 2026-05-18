import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { config } from './config.js'
import { routes } from './routes/index.js'

export async function buildApp() {
  const app = Fastify({ logger: { level: config.LOG_LEVEL } })

  await app.register(cors)
  await app.register(jwt, { secret: config.JWT_SECRET })

  // 注册路由
  await app.register(routes, { prefix: '/voice-service' })

  // 健康检查
  app.get('/health', async () => ({ status: 'ok', service: 'voice-service' }))

  return app
}
