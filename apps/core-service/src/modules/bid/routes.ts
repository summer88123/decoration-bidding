// apps/core-service/src/modules/bid/routes.ts
import type { FastifyPluginAsync, RouteHandlerMethod } from 'fastify'
import { DocumentService } from './services/document.service.js'
import { createDocumentHandlers } from './handlers/document.handler.js'
import { createBidHandlers } from './handlers/bid.handler.js'
import { createCommercialHandlers } from './handlers/bid-commercial.handler.js'
import { createTechnicalHandlers } from './handlers/bid-technical.handler.js'
import { createBidItemsHandlers } from './handlers/bid-items.handler.js'
import { createStorageService } from './storage/storage.factory.js'
import { config } from '../../config.js'
import { onDocEvent } from './services/document-events.js'
import { BidDocumentRepository } from './repositories/bid-document.repository.js'
import { requireAuth } from '../../shared/middleware/auth.js'

// 使用 as RouteHandlerMethod 绕过 Fastify 泛型参数不匹配的 TS 类型限制
type H = RouteHandlerMethod

export const bidRoutes: FastifyPluginAsync = async (app) => {
  const storage = createStorageService(config.STORAGE_DRIVER, config.UPLOAD_DIR, config.BASE_URL)
  const docSvc = new DocumentService(storage, config.BIM_SERVICE_URL, config.AI_AGENT_SERVICE_URL)
  const docHandlers = createDocumentHandlers(docSvc)
  const bidHandlers = createBidHandlers()
  const commercialHandlers = createCommercialHandlers()
  const technicalHandlers = createTechnicalHandlers()
  const itemsHandlers = createBidItemsHandlers()

  // ── 投标主体路由 ──────────────────────────────────────────────
  app.post('/bids', { preHandler: [requireAuth] }, bidHandlers.create as H)
  app.get('/bids/:bidId', { preHandler: [requireAuth] }, bidHandlers.getById as H)
  app.patch('/bids/:bidId', { preHandler: [requireAuth] }, bidHandlers.update as H)
  app.patch('/bids/:bidId/status', { preHandler: [requireAuth] }, bidHandlers.changeStatus as H)
  app.patch('/bids/:bidId/profit-margin', { preHandler: [requireAuth] }, bidHandlers.applyProfitMargin as H)
  app.delete('/bids/:bidId', { preHandler: [requireAuth] }, bidHandlers.delete as H)

  // 按招标查询投标列表
  app.get('/tenders/:tenderId/bids', { preHandler: [requireAuth] }, bidHandlers.getByTender as H)

  // ── 商务标路由 ────────────────────────────────────────────────
  app.get('/bids/:bidId/commercial', { preHandler: [requireAuth] }, commercialHandlers.get as H)
  app.patch('/bids/:bidId/commercial', { preHandler: [requireAuth] }, commercialHandlers.update as H)

  // ── 技术标路由 ────────────────────────────────────────────────
  app.get('/bids/:bidId/technical', { preHandler: [requireAuth] }, technicalHandlers.get as H)
  app.patch('/bids/:bidId/technical', { preHandler: [requireAuth] }, technicalHandlers.update as H)

  // ── 经济标条目路由 ─────────────────────────────────────────────
  app.get('/bids/:bidId/items', { preHandler: [requireAuth] }, itemsHandlers.list as H)
  app.post('/bids/:bidId/items', { preHandler: [requireAuth] }, itemsHandlers.create as H)
  app.patch('/bids/:bidId/items/:itemId', { preHandler: [requireAuth] }, itemsHandlers.update as H)
  app.delete('/bids/:bidId/items/:itemId', { preHandler: [requireAuth] }, itemsHandlers.delete as H)
  app.patch('/bids/:bidId/items/reorder', { preHandler: [requireAuth] }, itemsHandlers.reorder as H)

  // ── 文件路由（原有，保留）────────────────────────────────────────
  app.get('/bids/:bidId/documents', { preHandler: [requireAuth] }, docHandlers.listDocuments as H)
  app.post('/bids/:bidId/documents', { preHandler: [requireAuth] }, docHandlers.upload as H)
  app.delete('/bids/:bidId/documents/:docId', { preHandler: [requireAuth] }, docHandlers.deleteDocument as H)
  app.get('/bids/:bidId/documents/:docId/status', docHandlers.getStatus as H)

  // SSE 流（原有，保留）
  app.get<{ Params: { bidId: string; docId: string } }>(
    '/bids/:bidId/documents/:docId/stream',
    (req, reply) => {
      reply.hijack()
      const raw = reply.raw
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
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
        const keepAlive = setInterval(
          () => { if (!raw.destroyed) raw.write(': ping\n\n') },
          15000,
        )
        req.raw.on('close', () => { off(); clearInterval(keepAlive) })
      })
    },
  )
}
