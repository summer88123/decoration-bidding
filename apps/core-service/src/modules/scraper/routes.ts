import type { FastifyPluginAsync } from 'fastify'

export const scraperRoutes: FastifyPluginAsync = async (app) => {
  app.get('/scraper/health', async () => ({ module: 'scraper', status: 'stub' }))
  // TODO: 实现爬虫触发路由
}
