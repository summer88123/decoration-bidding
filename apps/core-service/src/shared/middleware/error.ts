// apps/core-service/src/shared/middleware/error.ts
import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify'

export function errorHandler(error: FastifyError, req: FastifyRequest, reply: FastifyReply) {
  const statusCode = error.statusCode ?? 500
  if (statusCode >= 500) {
    req.log.error({ err: error, url: req.url, method: req.method }, '服务器内部错误')
  }
  reply.code(statusCode).send({
    success: false,
    error: statusCode >= 500 ? 'Internal Server Error' : error.message,
    ...(process.env.NODE_ENV !== 'production' && statusCode >= 500 ? { detail: error.message } : {}),
  })
}

