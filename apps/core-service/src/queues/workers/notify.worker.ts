// apps/core-service/src/queues/workers/notify.worker.ts
import { Worker } from 'bullmq'
import { config } from '../../config.js'
import { createLogger } from '@decoration-bidding/shared-utils'

const logger = createLogger('notify-worker')
const connection = { url: config.REDIS_URL }

export const notifyWorker = new Worker(
  'notify',
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, 'notify job received')
    // TODO: 实现通知发送逻辑
  },
  { connection },
)
