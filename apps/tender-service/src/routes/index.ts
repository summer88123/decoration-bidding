import type { FastifyPluginAsync } from 'fastify'

export const routes: FastifyPluginAsync = async (app) => {
  // TODO: 注册具体路由
  app.get('/', async () => ({ message: '招标项目 服务运行中' }))
}
