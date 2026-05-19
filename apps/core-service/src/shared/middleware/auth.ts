// apps/core-service/src/shared/middleware/auth.ts
import type { FastifyRequest, FastifyReply } from 'fastify'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ success: false, error: 'Unauthorized' })
  }
}
