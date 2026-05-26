// apps/ai-agent-service/src/instrumentation.ts
/**
 * OpenTelemetry + Langfuse 集成初始化。
 * 通过 LangfuseSpanProcessor 自动捕获 Vercel AI SDK 的 telemetry spans，
 * 并上报至 Langfuse 进行可视化分析。
 *
 * 注意：此文件必须在所有其他模块之前导入（在 index.ts 顶部）。
 */
import { LangfuseSpanProcessor } from '@langfuse/otel'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { createLogger } from '@decoration-bidding/shared-utils'
import { config } from './config.js'

const logger = createLogger('instrumentation')

let _spanProcessor: LangfuseSpanProcessor | null = null

function initOtel() {
  if (!config.LANGFUSE_BASE_URL || !config.LANGFUSE_PUBLIC_KEY || !config.LANGFUSE_SECRET_KEY) {
    logger.info('Langfuse 未配置，OTel 集成已跳过')
    return
  }
  if (
    config.LANGFUSE_PUBLIC_KEY.includes('your-public-key') ||
    config.LANGFUSE_SECRET_KEY.includes('your-secret-key')
  ) {
    logger.info('Langfuse 使用占位符密钥，OTel 集成已跳过')
    return
  }

  _spanProcessor = new LangfuseSpanProcessor({
    publicKey: config.LANGFUSE_PUBLIC_KEY,
    secretKey: config.LANGFUSE_SECRET_KEY,
    baseUrl: config.LANGFUSE_BASE_URL,
  })

  const tracerProvider = new NodeTracerProvider({
    spanProcessors: [_spanProcessor],
  })

  tracerProvider.register()
  logger.info(`OTel + Langfuse 已初始化，上报至 ${config.LANGFUSE_BASE_URL}`)
}

initOtel()

/** 在 serverless / 流式结束时调用，确保 spans 全部发送 */
export async function flushOtel() {
  if (_spanProcessor) {
    await _spanProcessor.forceFlush()
  }
}

export { _spanProcessor as langfuseSpanProcessor }
