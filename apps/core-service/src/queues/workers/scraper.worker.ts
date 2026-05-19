// apps/core-service/src/queues/workers/scraper.worker.ts
import { Worker } from 'bullmq'
import { config } from '../../config.js'
import { createLogger } from '@decoration-bidding/shared-utils'

const logger = createLogger('scraper-worker')
const connection = { url: config.REDIS_URL }

export const scraperWorker = new Worker(
  'scraper',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'scraper job received')
    // TODO: 实现爬虫逻辑
  },
  { connection },
)
