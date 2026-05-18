// packages/shared-utils/src/logger.ts
/**
 * 统一 Logger 工厂
 *
 * 用法：
 *   import { createLogger } from '@decoration-bidding/shared-utils'
 *   const logger = createLogger('my-service')
 *   logger.info('启动成功')
 *   logger.error({ err }, '发生错误')
 *
 * 环境变量：
 *   LOG_LEVEL  — 日志级别（默认 info）
 *   NODE_ENV   — production 时输出纯 JSON；否则根据 stdout 是否为 TTY 决定是否启用 pino-pretty
 */
import pino from 'pino'

export type Logger = pino.Logger

export function createLogger(service: string, opts?: pino.LoggerOptions): Logger {
  const level = process.env.LOG_LEVEL ?? 'info'
  const isProd = process.env.NODE_ENV === 'production'
  // 仅当 stdout 是真正的终端时才使用彩色 pretty，写入文件（nohup/重定向）时使用可读文本但不含 ANSI 码
  const isTTY = process.stdout.isTTY === true

  let transport: pino.TransportSingleOptions | undefined
  if (!isProd) {
    transport = {
      target: 'pino-pretty',
      options: {
        colorize: isTTY,        // TTY 时彩色，文件时纯文本
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: `[${service}] {msg}`,
      },
    }
  }

  return pino({
    level,
    ...opts,
    ...(transport ? { transport } : {}),
    base: { service },
  })
}
