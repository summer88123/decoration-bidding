// apps/web/src/app/api/bids/[bidId]/documents/[docId]/stream/route.ts
// Next.js API Route：直连 core-service，管道转发 SSE 流
// 绕过 gateway（@fastify/http-proxy 使用 undici，会缓冲 SSE 响应）

import type { NextRequest } from 'next/server'
import { Agent, fetch as undiciFetch } from 'undici'

// 直连 core-service（服务器端，无 CORS 问题）
const CORE_SERVICE_URL = process.env.CORE_SERVICE_URL || 'http://localhost:8080'
// bodyTimeout:0 防止长时间 AI 处理时 undici body timeout 中断连接
const longRunningAgent = new Agent({ bodyTimeout: 0, headersTimeout: 60_000 })

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ bidId: string; docId: string }> },
) {
  const { bidId, docId } = await params
  const upstream = `${CORE_SERVICE_URL}/api/bids/${bidId}/documents/${docId}/stream`

  let upstreamRes: Awaited<ReturnType<typeof undiciFetch>>
  try {
    upstreamRes = await undiciFetch(upstream, { dispatcher: longRunningAgent })
  } catch (e) {
    return new Response(`data: ${JSON.stringify({ type: 'error', message: 'upstream unavailable' })}\n\n`, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }

  // 将 undici Response body（ReadableStream）直接管道给浏览器
  return new Response(upstreamRes.body as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
