// apps/ai-agent-service/src/langfuse.ts
/**
 * Langfuse 单例。
 * 仅当 LANGFUSE_BASE_URL / PUBLIC_KEY / SECRET_KEY 均已配置时才初始化。
 * 否则所有方法均为 noop，不影响主业务流程。
 */
import { Langfuse } from 'langfuse'
import { createLogger } from '@decoration-bidding/shared-utils'
import { config } from './config.js'

const logger = createLogger('langfuse')

function createClient(): Langfuse | null {
  if (!config.LANGFUSE_BASE_URL || !config.LANGFUSE_PUBLIC_KEY || !config.LANGFUSE_SECRET_KEY) {
    return null
  }
  if (
    config.LANGFUSE_PUBLIC_KEY.includes('your-public-key') ||
    config.LANGFUSE_SECRET_KEY.includes('your-secret-key')
  ) {
    return null
  }
  return new Langfuse({
    publicKey: config.LANGFUSE_PUBLIC_KEY,
    secretKey: config.LANGFUSE_SECRET_KEY,
    baseUrl: config.LANGFUSE_BASE_URL,
    flushAt: 1, // 每条立即发送，便于调试
    flushInterval: 0,
  })
}

export const langfuse = createClient()

/** 是否已启用 Langfuse 追踪 */
export const langfuseEnabled = langfuse !== null

if (langfuseEnabled) {
  logger.info(`Langfuse SDK 追踪已启用，上报至 ${config.LANGFUSE_BASE_URL}`)
} else {
  logger.info('未配置，Langfuse SDK 追踪已跳过')
}
