import type { FastifyPluginAsync } from 'fastify'

export const userRoutes: FastifyPluginAsync = async (app) => {
  app.get('/users/health', async () => ({ module: 'user', status: 'stub' }))
  // TODO: 实现用户 CRUD 路由
}
