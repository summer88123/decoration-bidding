import type { FastifyPluginAsync } from 'fastify'
import { ZodError } from 'zod'
import { requireAuth, requireRole } from '../../shared/middleware/auth.js'
import {
  listTendersHandler,
  createTenderHandler,
  getTenderHandler,
  updateTenderHandler,
  deleteTenderHandler,
  decideTenderHandler,
  uploadDocumentHandler,
  listDocumentsHandler,
  deleteDocumentHandler,
} from './handlers/tender.handler.js'

export const tenderRoutes: FastifyPluginAsync = async (app) => {
  app.setErrorHandler((error, _req, reply) => {
    if ((error as NodeJS.ErrnoException & { statusCode?: number }).statusCode) {
      return reply.status((error as { statusCode: number }).statusCode).send({
        success: false,
        error: { message: error.message },
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

  // Tender CRUD
  app.get('/tenders', { preHandler: [requireAuth] }, listTendersHandler)
  app.post('/tenders', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN', 'MANAGER', 'BIDDER'])] }, createTenderHandler)
  app.get('/tenders/:id', { preHandler: [requireAuth] }, getTenderHandler as any)
  app.put('/tenders/:id', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN', 'MANAGER', 'BIDDER'])] }, updateTenderHandler as any)
  app.delete('/tenders/:id', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN'])] }, deleteTenderHandler as any)

  // Decision
  app.post('/tenders/:id/decide', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, decideTenderHandler as any)

  // Documents
  app.post('/tenders/:id/documents', { preHandler: [requireAuth] }, uploadDocumentHandler as any)
  app.get('/tenders/:id/documents', { preHandler: [requireAuth] }, listDocumentsHandler as any)
  app.delete('/tenders/:id/documents/:docId', { preHandler: [requireAuth, requireRole(['COMPANY_ADMIN', 'MANAGER'])] }, deleteDocumentHandler as any)
}
