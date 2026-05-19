// apps/core-service/src/index.ts
import { buildApp } from './app.js'
import { config } from './config.js'
import './queues/workers/scraper.worker.js'
import './queues/workers/notify.worker.js'

const app = await buildApp()
await app.listen({ port: config.PORT, host: '0.0.0.0' })
