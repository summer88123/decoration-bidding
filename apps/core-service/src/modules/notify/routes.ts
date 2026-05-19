import type { FastifyPluginAsync } from 'fastify'

export const notifyRoutes: FastifyPluginAsync = async (app) => {
  app.get('/notify/health', async () => ({ module: 'notify', status: 'stub' }))
  // TODO: 实现通知路由
}
