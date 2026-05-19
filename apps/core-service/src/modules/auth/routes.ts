import type { FastifyPluginAsync } from 'fastify'

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/auth/health', async () => ({ module: 'auth', status: 'stub' }))
  // TODO: POST /auth/login, POST /auth/register
}
