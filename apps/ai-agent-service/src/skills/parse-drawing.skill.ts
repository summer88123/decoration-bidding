// apps/ai-agent-service/src/skills/parse-drawing.skill.ts
/**
 * Skill: parse-drawing
 * 分析施工图纸，提取物料清单（BOQ）条目及图纸坐标。
 * 逐页 + 逐条流式：每页使用 streamObject，LLM 每生成一个完整条目立即 yield。
 * 已接入 Langfuse 追踪，每页对应一个 generation。
 */
import { createOpenAI } from '@ai-sdk/openai'
import type { BidItemFromAI } from '@decoration-bidding/shared-types'
import { createLogger } from '@decoration-bidding/shared-utils'
import { generateObject, streamObject } from 'ai'
import { z } from 'zod'
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

const SYSTEM_PROMPT = `你是一名专业的建筑及室内装修工程量清单（BOQ）工程师。
请分析提供的施工图纸页面，提取所有可识别的工程量清单条目。
对于每个条目，请提供：
1. 项目名称
2. 数量和单位
3. 规格说明（如有）
4. 在图纸中的位置（用 0-1 比例坐标表示：x/y 为左上角，w/h 为宽高）

仅识别图纸上明确标注的条目，尽量避免推测。

不要识别非图纸内容（如标题页、目录等）。

坐标系：原点在页面左上角，x 向右，y 向下。
优先使用图纸中的语言。
`

function buildLlm() {
  if (!config.LLM_API_KEY) throw new Error('LLM_API_KEY 未配置')
  const opts: { apiKey: string; baseURL?: string } = { apiKey: config.LLM_API_KEY }
  if (config.LLM_BASE_URL) opts.baseURL = config.LLM_BASE_URL
  return createOpenAI(opts)(config.DEFAULT_LLM_MODEL)
}

/** 关闭 thinking 的 providerOptions（仅当 LLM_DISABLE_THINKING=true 时携带） */
function thinkingOpts() {
  if (!config.LLM_DISABLE_THINKING) return {}
  return { providerOptions: { openai: { thinking: { type: 'disabled' } } } }
}

/** 为单页构建消息 */
function buildPageMessages(page: ParsedPage) {
  const textPart = {
    type: 'text' as const,
    text: `第 ${page.pageNum} 页（${page.width.toFixed(0)}×${page.height.toFixed(0)} pts）\n${page.text || '（无可识别文字）'}`,
  }
  const content =
    config.LLM_SUPPORTS_VISION && page.imageBase64
      ? [
          textPart,
          {
            type: 'image' as const,
            image: Buffer.from(page.imageBase64, 'base64'),
            mimeType: 'image/png' as const,
          },
        ]
      : [textPart]

  return [
    {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: '请分析以下施工图纸页面，提取物料清单：' },
        ...content,
      ],
    },
  ]
}

// ─── 流式 yield 类型 ──────────────────────────────────────────────────────────

export type StreamYield =
  | { kind: 'progress'; page: number; total: number }
  | { kind: 'item'; data: BidItemFromAI }

// ─── 单页流式处理（streamObject，逐条 yield） ─────────────────────────────────
/**
 * 使用 streamObject 逐条 yield BOQ 条目。
 * 检测到数组新增完整条目（partialObjectStream 中 items.length 增加且前 N-1 条完整）时立即 yield。
 * 若 streamObject 失败（如 thinking 未关闭导致 JSON 破损），降级为 generateObject。
 */
async function* processPageStream(
  page: ParsedPage,
  traceId: string | undefined,
  pageIndex: number,
  totalPages: number,
): AsyncGenerator<BidItemFromAI> {
  const label = `第 ${page.pageNum}/${totalPages} 页`
  logger.info({ pageNum: page.pageNum, traceId }, `开始解析 ${label}`)

  const generation = langfuse?.trace({ id: traceId })?.generation({
    name: `stream-page${page.pageNum}`,
    model: config.DEFAULT_LLM_MODEL,
    modelParameters: { temperature: 1, mode: 'json' },
    input: {
      pageNum: page.pageNum,
      size: `${page.width.toFixed(0)}×${page.height.toFixed(0)}`,
      textPreview: page.text?.slice(0, 300) ?? '',
    },
  })

  try {
    // ── 优先尝试 streamObject（需 thinking 已关闭） ──
    const stream = await streamObject({
      model: buildLlm(),
      schema: ResponseSchema,
      // mode: 'json',
      temperature: 1,
      system: SYSTEM_PROMPT,
      messages: buildPageMessages(page),
      ...thinkingOpts(),
    })

    let lastYieldedCount = 0

    for await (const partial of stream.partialObjectStream) {
      const items = partial.items ?? []
      // 当数组长度增加时，前 length-1 条是已完整的条目，立即 yield
      while (lastYieldedCount < items.length - 1) {
        const item = items[lastYieldedCount]
        if (item?.itemName && item?.unit && item?.region) {
          logger.info(
            { pageNum: page.pageNum, itemName: item.itemName, idx: lastYieldedCount + 1 },
            `[stream-yield] ${page.pageNum}页第${lastYieldedCount + 1}条: ${item.itemName}`,
          )
          yield { ...item, region: { ...item.region, page: page.pageNum } } as BidItemFromAI
          lastYieldedCount++
        } else {
          break
        }
      }
    }

    // 流结束后，yield 最后一条（此时已完整）
    const finalObj = await stream.object
    const allItems = finalObj.items ?? []
    while (lastYieldedCount < allItems.length) {
      const item = allItems[lastYieldedCount]
      if (!item?.region) {
        lastYieldedCount++
        continue
      }
      logger.info(
        { pageNum: page.pageNum, itemName: item.itemName, idx: lastYieldedCount + 1 },
        `[yield] ${page.pageNum}页第${lastYieldedCount + 1}条: ${item.itemName}`,
      )
      yield { ...item, region: { ...item.region, page: page.pageNum } } as BidItemFromAI
      lastYieldedCount++
    }

    const usage = await stream.usage
    logger.info({ pageNum: page.pageNum, count: allItems.length, traceId }, `${label} 解析完成`)
    generation?.end({
      output: { items: allItems },
      usage: { input: usage?.promptTokens, output: usage?.completionTokens },
    })
    await langfuse?.flushAsync()
  } catch (err) {
    // ── 降级：streamObject 失败时用 generateObject ──
    logger.warn({ err, pageNum: page.pageNum }, `${label} streamObject 失败，降级为 generateObject`)
    try {
      const { object, usage } = await generateObject({
        model: buildLlm(),
        schema: ResponseSchema,
        mode: 'json',
        temperature: 1,
        system: SYSTEM_PROMPT,
        messages: buildPageMessages(page),
        ...thinkingOpts(),
      })
      const items = object.items.map((item) => ({
        ...item,
        region: { ...item.region, page: page.pageNum },
      }))
      for (const item of items) {
        logger.info(
          { pageNum: page.pageNum, itemName: item.itemName },
          `[fallback-yield] ${page.pageNum}页条目: ${item.itemName}`,
        )
        yield item
      }
      logger.info({ pageNum: page.pageNum, count: items.length, traceId }, `${label} 降级解析完成`)
      generation?.end({
        output: { items },
        usage: { input: usage?.promptTokens, output: usage?.completionTokens },
      })
      await langfuse?.flushAsync()
    } catch (fallbackErr) {
      logger.error({ err: fallbackErr, pageNum: page.pageNum, traceId }, `${label} 解析失败，跳过`)
      generation?.end({ level: 'ERROR', statusMessage: String(fallbackErr) })
      await langfuse?.flushAsync()
      // 不抛出，继续处理后续页
    }
  }
}

// ─── execute（非流式，逐页处理后汇总） ────────────────────────────────────────

export async function execute(pages: ParsedPage[], traceId?: string): Promise<BidItemFromAI[]> {
  logger.info({ pages: pages.length, traceId }, '开始非流式解析（逐页模式）')
  langfuse?.trace({ id: traceId, name: 'parse-drawing', input: { pageCount: pages.length } })

  const allItems: BidItemFromAI[] = []
  for (let i = 0; i < pages.length; i++) {
    for await (const item of processPageStream(pages[i], traceId, i, pages.length)) {
      allItems.push(item)
    }
  }

  logger.info({ total: allItems.length, traceId }, '非流式解析全部完成')
  langfuse?.trace({ id: traceId })?.update({ output: { itemCount: allItems.length } })
  await langfuse?.flushAsync()
  return allItems
}

// ─── streamItems（逐页 + 逐条流式） ──────────────────────────────────────────
/**
 * 逐页调用 LLM：
 * - 每页开始前 yield { kind: 'progress' }
 * - 每生成一个完整条目立即 yield { kind: 'item' }（真正流式）
 * - 单页失败不影响其他页
 */
export async function* streamItems(
  pages: ParsedPage[],
  traceId?: string,
): AsyncGenerator<StreamYield> {
  logger.info({ pages: pages.length, traceId }, '开始流式解析（逐页逐条模式）')
  langfuse?.trace({ id: traceId, name: 'parse-drawing-stream', input: { pageCount: pages.length } })

  let totalItems = 0
  for (let i = 0; i < pages.length; i++) {
    yield { kind: 'progress', page: pages[i].pageNum, total: pages.length }
    for await (const item of processPageStream(pages[i], traceId, i, pages.length)) {
      yield { kind: 'item', data: item }
      totalItems++
    }
  }

  logger.info({ total: totalItems, traceId }, '流式解析全部完成')
  langfuse?.trace({ id: traceId })?.update({ output: { itemCount: totalItems } })
  await langfuse?.flushAsync()
}
