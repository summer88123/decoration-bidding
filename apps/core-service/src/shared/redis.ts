// apps/core-service/src/shared/redis.ts
import { Redis } from 'ioredis'
import { createLogger } from '@decoration-bidding/shared-utils'
import { config } from '../config.js'

const logger = createLogger('redis')

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
})

redis.on('error', (err: Error) => {
  logger.error({ err }, 'Redis 连接错误')
})
