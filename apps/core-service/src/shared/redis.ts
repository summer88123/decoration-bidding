// apps/core-service/src/shared/redis.ts
import { Redis } from 'ioredis'
import { config } from '../config.js'

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
})

redis.on('error', (err: Error) => {
  console.error('[Redis] Connection error:', err)
})
