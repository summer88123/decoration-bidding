// apps/core-service/src/modules/bid/routes.ts
import type { FastifyPluginAsync } from 'fastify'
import { DocumentService } from './services/document.service.js'
import { createDocumentHandlers } from './handlers/document.handler.js'
import { createStorageService } from './storage/storage.factory.js'
import { config } from '../../config.js'
import { onDocEvent } from './services/document-events.js'
import { BidDocumentRepository } from './repositories/bid-document.repository.js'

export const bidRoutes: FastifyPluginAsync = async (app) => {
  const storage = createStorageService(config.STORAGE_DRIVER, config.UPLOAD_DIR, config.BASE_URL)
  const svc = new DocumentService(storage, config.BIM_SERVICE_URL, config.AI_AGENT_SERVICE_URL)
  const handlers = createDocumentHandlers(svc)

  app.post('/bids/:bidId/documents', handlers.upload)
  app.get('/bids/:bidId/documents/:docId/status', handlers.getStatus)
  app.get('/bids/:bidId/items', handlers.getItems)

  app.get<{ Params: { bidId: string; docId: string } }>(
    '/bids/:bidId/documents/:docId/stream',
    (req, reply) => {
      reply.hijack()
      const raw = reply.raw
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      })
      raw.write(': connected\n\n')

      const send = (data: unknown) => {
        if (!raw.destroyed) raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      void BidDocumentRepository.findById(req.params.docId).then((doc) => {
        if (doc?.status === 'completed') {
          send({ type: 'done', count: 0 })
          raw.end()
          return
        }
        if (doc?.status === 'failed') {
          send({ type: 'error', message: doc.errorMsg ?? '未知错误' })
          raw.end()
          return
        }

        const off = onDocEvent(req.params.docId, (event) => {
          send(event)
          if (event.type === 'done' || event.type === 'error') {
            raw.end()
            off()
            clearInterval(keepAlive)
          }
        })

        const keepAlive = setInterval(() => { if (!raw.destroyed) raw.write(': ping\n\n') }, 15000)
        req.raw.on('close', () => { off(); clearInterval(keepAlive) })
      })
    },
  )
}
