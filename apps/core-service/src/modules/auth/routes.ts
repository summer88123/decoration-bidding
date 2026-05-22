// apps/core-service/src/modules/auth/routes.ts
import type { FastifyPluginAsync } from 'fastify'
import { registerHandler } from './handlers/register.handler.js'
import { loginHandler } from './handlers/login.handler.js'
import { refreshHandler } from './handlers/refresh.handler.js'
import { logoutHandler } from './handlers/logout.handler.js'
import { forgotPasswordHandler } from './handlers/forgot-password.handler.js'
import { resetPasswordHandler } from './handlers/reset-password.handler.js'
import { AuthError } from './services/auth.service.js'
import { ZodError } from 'zod'

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, _req, reply) => {
    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: { code: error.code, message: error.message },
      })
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: error.errors[0]?.message ?? '输入验证失败' },
      })
    }
    app.log.error(error)
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
    })
  })

  app.get('/auth/health', async () => ({ module: 'auth', status: 'ok' }))
  app.post('/auth/register', registerHandler)
  app.post('/auth/login', loginHandler)
  app.post('/auth/refresh', refreshHandler)
  app.post('/auth/logout', logoutHandler)
  app.post('/auth/forgot-password', forgotPasswordHandler)
  app.post('/auth/reset-password', resetPasswordHandler)
}
