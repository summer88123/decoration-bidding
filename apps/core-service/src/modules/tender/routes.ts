import type { FastifyPluginAsync } from 'fastify'

export const tenderRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tenders/health', async () => ({ module: 'tender', status: 'stub' }))
  // TODO: 实现招标项目路由
}
