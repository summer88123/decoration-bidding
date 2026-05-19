// apps/core-service/src/queues/index.ts
import { Queue } from 'bullmq'
import { config } from '../config.js'

const connection = { url: config.REDIS_URL }

export const scraperQueue = new Queue('scraper', { connection })
export const notifyQueue = new Queue('notify', { connection })
export const bidGenerateQueue = new Queue('bid.generate', { connection })
