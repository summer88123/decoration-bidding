// apps/ai-agent-service/src/skills/parse-drawing.skill.ts
/**
 * Skill: parse-drawing
 * 分析施工图纸，提取物料清单（BOQ）条目及图纸坐标。
 * 支持 execute（完整返回）和 streamItems（流式逐条返回）两种模式。
 * 已接入 Langfuse 追踪，可在 Langfuse UI 查看完整输入/输出。
 */
import { generateObject } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import type { BidItemFromAI } from '@decoration-bidding/shared-types'
import { createLogger } from '@decoration-bidding/shared-utils'
import { config } from '../config.js'
import { langfuse } from '../langfuse.js'

const logger = createLogger('parse-drawing')

interface ParsedPage {
  pageNum: number
  text: string
  imageBase64: string
  width: number
  height: number
}

const BidItemSchema = z.object({
  itemName: z.string().describe('物料或工程项目名称，如"地砖铺贴"'),
  quantity: z.number().describe('数量'),
  unit: z.string().describe('单位，如 m²、m、套、个'),
  description: z.string().optional().describe('规格说明'),
  region: z.object({
    page: z.number().describe('所在页码（1-indexed）'),
    x: z.number().min(0).max(1).describe('左上角 x 坐标，0-1 比例'),
    y: z.number().min(0).max(1).describe('左上角 y 坐标，0-1 比例'),
    w: z.number().min(0).max(1).describe('宽度比例，0-1'),
    h: z.number().min(0).max(1).describe('高度比例，0-1'),
  }),
})

const ResponseSchema = z.object({ items: z.array(BidItemSchema) })

const SYSTEM_PROMPT = `你是一名专业的香港建筑及室内装修工程量清单（BOQ）工程师。
请分析提供的施工图纸，提取所有可识别的工程量清单条目。
对于每个条目，请提供：
1. 项目名称（中文）
2. 数量和单位
3. 规格说明（如有）
4. 在图纸中的位置（用 0-1 比例坐标表示：x/y 为左上角，w/h 为宽高）

坐标系：原点在页面左上角，x 向右，y 向下。`

function buildLlm() {
  if (!config.LLM_API_KEY) throw new Error('LLM_API_KEY 未配置')
  const opts: { apiKey: string; baseURL?: string } = { apiKey: config.LLM_API_KEY }
  if (config.LLM_BASE_URL) opts.baseURL = config.LLM_BASE_URL
  return createOpenAI(opts)(config.DEFAULT_LLM_MODEL)
}

function buildMessages(pages: ParsedPage[]) {
  const content = pages.flatMap((page) => {
    const textPart = {
      type: 'text' as const,
      text: `--- 第 ${page.pageNum} 页（${page.width.toFixed(0)}×${page.height.toFixed(0)} pts）---\n${page.text || '（无可识别文字）'}`,
    }
    if (!config.LLM_SUPPORTS_VISION || !page.imageBase64) return [textPart]
    return [
      textPart,
      { type: 'image' as const, image: Buffer.from(page.imageBase64, 'base64'), mimeType: 'image/png' as const },
    ]
  })
  return [{ role: 'user' as const, content: [{ type: 'text' as const, text: '请分析以下施工图纸，提取物料清单：' }, ...content] }]
}

/** 构建 Langfuse 的文本摘要输入（不包含 base64 图片，避免体积过大） */
function buildTraceInput(pages: ParsedPage[]) {
  return pages.map((p) => ({
    pageNum: p.pageNum,
    size: `${p.width.toFixed(0)}×${p.height.toFixed(0)}`,
    textPreview: p.text?.slice(0, 300) ?? '',
    hasImage: !!p.imageBase64,
  }))
}

// ─── execute（非流式） ────────────────────────────────────────────────────────

export async function execute(pages: ParsedPage[], traceId?: string): Promise<BidItemFromAI[]> {
  logger.info({ pages: pages.length, traceId }, '开始非流式解析')

  const trace = langfuse?.trace({ id: traceId, name: 'parse-drawing', input: buildTraceInput(pages) })
  const generation = trace?.generation({
    name: 'generateObject',
    model: config.DEFAULT_LLM_MODEL,
    modelParameters: { temperature: 1, mode: 'json' },
    input: { system: SYSTEM_PROMPT, pageCount: pages.length },
  })

  try {
    const { object, usage } = await generateObject({
      model: buildLlm(), schema: ResponseSchema, mode: 'json', temperature: 1,
      system: SYSTEM_PROMPT, messages: buildMessages(pages),
    })

    logger.info({ count: object.items.length, traceId }, '非流式解析完成')
    generation?.end({
      output: object,
      usage: { input: usage?.promptTokens, output: usage?.completionTokens },
    })
    trace?.update({ output: { itemCount: object.items.length } })
    await langfuse?.flushAsync()

    return object.items
  } catch (err) {
    logger.error({ err, traceId }, '非流式解析失败')
    generation?.end({ level: 'ERROR', statusMessage: String(err) })
    await langfuse?.flushAsync()
    throw err
  }
}

// ─── streamItems（伪流式：generateObject 完成后逐条 yield） ──────────────────────
/**
 * kimi-k2.6 等 thinking 模型先输出 <think>...</think> 再输出 JSON，
 * streamObject 的增量 JSON 解析与之不兼容。
 * 改用 generateObject（能正确提取最终 JSON），完成后逐条 yield 保持接口一致。
 */
export async function* streamItems(pages: ParsedPage[], traceId?: string): AsyncGenerator<BidItemFromAI> {
  logger.info({ pages: pages.length, traceId }, '开始流式解析（generateObject 模式）')

  const trace = langfuse?.trace({ id: traceId, name: 'parse-drawing-stream', input: buildTraceInput(pages) })
  const generation = trace?.generation({
    name: 'generateObject',
    model: config.DEFAULT_LLM_MODEL,
    modelParameters: { temperature: 1, mode: 'json' },
    input: { system: SYSTEM_PROMPT, pageCount: pages.length },
  })

  try {
    const { object, usage } = await generateObject({
      model: buildLlm(), schema: ResponseSchema, mode: 'json', temperature: 1,
      system: SYSTEM_PROMPT, messages: buildMessages(pages),
    })

    logger.info({ count: object.items.length, traceId }, '流式解析完成，逐条 yield')

    generation?.end({
      output: { items: object.items },
      usage: { input: usage?.promptTokens, output: usage?.completionTokens },
    })
    trace?.update({ output: { itemCount: object.items.length } })
    await langfuse?.flushAsync()

    // 逐条 yield，让 bid-service SSE 端点可以分批转发给前端
    for (const item of object.items) {
      yield item
    }
  } catch (err) {
    logger.error({ err, traceId }, '流式解析失败')
    generation?.end({ level: 'ERROR', statusMessage: String(err) })
    await langfuse?.flushAsync()
    throw err
  }
}
