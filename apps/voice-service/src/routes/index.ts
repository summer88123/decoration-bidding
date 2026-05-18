import type { FastifyPluginAsync } from 'fastify'

export const routes: FastifyPluginAsync = async (app) => {
  // TODO: 注册具体路由
  app.get('/', async () => ({ message: '语音 服务运行中' }))
}
