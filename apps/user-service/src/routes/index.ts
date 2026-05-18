import type { FastifyPluginAsync } from 'fastify'

export const routes: FastifyPluginAsync = async (app) => {
  // TODO: 注册具体路由
  app.get('/', async () => ({ message: '用户管理 服务运行中' }))
}
