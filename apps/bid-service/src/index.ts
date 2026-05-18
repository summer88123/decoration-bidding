import 'dotenv/config'
import { buildApp } from './app.js'
import { config } from './config.js'
import { createLogger } from '@decoration-bidding/shared-utils'

const logger = createLogger('bid-service')

async function main() {
  const app = await buildApp()
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' })
    logger.info(`listening on port ${config.PORT}`)
  } catch (err) {
    logger.error({ err }, '启动失败')
    process.exit(1)
  }
}

main()
