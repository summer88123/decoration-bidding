// apps/bid-service/src/services/document-events.ts
/**
 * 文档处理进度事件总线（内存级，单进程）
 * bid-service 内部使用，通过 SSE 将解析进度推送到前端。
 */
import { EventEmitter } from 'events'

export type DocEvent =
  | { type: 'progress'; message: string }
  | { type: 'item'; item: Record<string, unknown> }
  | { type: 'done'; count: number }
  | { type: 'error'; message: string }

const bus = new EventEmitter()
bus.setMaxListeners(200)

export function emitDocEvent(docId: string, event: DocEvent): void {
  bus.emit(docId, event)
}

/** 订阅文档事件，返回取消订阅函数 */
export function onDocEvent(
  docId: string,
  handler: (e: DocEvent) => void,
): () => void {
  bus.on(docId, handler)
  return () => bus.off(docId, handler)
}
