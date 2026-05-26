// apps/ai-agent-service/src/routes/index.ts
import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import { ok, fail } from '@decoration-bidding/shared-utils'
import { execute as parseDrawing, streamItems } from '../skills/parse-drawing.skill.js'

interface ParsedPage {
  pageNum: number
  text: string
  imageBase64: string
  width: number
  height: number
}

export const routes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => ({ message: 'AI 智能体服务运行中' }))

  // POST /ai/skills/parse-drawing — 非流式（完整等待后返回）
  app.post<{ Body: { pages: ParsedPage[]; userEmail?: string } }>(
    '/skills/parse-drawing',
    async (req, reply) => {
      const { pages, userEmail } = req.body
      if (!pages?.length) return reply.status(400).send(fail('NO_PAGES', '请提供图纸页面数据'))
      try {
        const items = await parseDrawing(pages, randomUUID(), userEmail)
        return reply.send(ok({ items }))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const detail = (err as Record<string, unknown>)?.responseBody ?? ''
        req.log.error({ err, detail }, `parse-drawing error: ${msg}`)
        return reply.status(500).send(fail('AI_ERROR', msg))
      }
    },
  )

  // POST /ai/skills/parse-drawing/stream — 流式 SSE，逐条返回 BOQ 条目
  app.post<{ Body: { pages: ParsedPage[]; userEmail?: string } }>(
    '/skills/parse-drawing/stream',
    (req, reply) => {
      const { pages, userEmail } = req.body as { pages: ParsedPage[]; userEmail?: string }
      if (!pages?.length) {
        reply.status(400).send(fail('NO_PAGES', '请提供图纸页面数据'))
        return
      }

      reply.hijack()
      const raw = reply.raw
      raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      const send = (data: unknown) => {
        if (!raw.destroyed) raw.write(`data: ${JSON.stringify(data)}\n\n`)
      }

      req.log.info(`[parse-drawing/stream] 开始流式分析，共 ${pages.length} 页`)
      const traceId = randomUUID()

      void (async () => {
        try {
          let count = 0
          for await (const ev of streamItems(pages, traceId, userEmail)) {
            if (ev.kind === 'progress') {
              send({ type: 'page_progress', page: ev.page, total: ev.total })
              req.log.info(`[parse-drawing/stream] 开始第 ${ev.page}/${ev.total} 页`)
            } else {
              send(ev.data)
              count++
              req.log.info(`[parse-drawing/stream] 已提取第 ${count} 个条目: ${ev.data.itemName}`)
            }
          }
          send('[DONE]')
          req.log.info(`[parse-drawing/stream] 完成，共 ${count} 条目`)
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          req.log.error(`[parse-drawing/stream] 错误: ${msg}`)
          send({ error: msg })
        } finally {
          if (!raw.destroyed) raw.end()
        }
      })()
    },
  )
}
