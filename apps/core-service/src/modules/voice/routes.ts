import type { FastifyPluginAsync } from 'fastify'

export const voiceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/voice/health', async () => ({ module: 'voice', status: 'stub' }))
  // TODO: 实现语音路由
}
