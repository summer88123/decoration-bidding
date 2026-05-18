import 'dotenv/config'
import { buildApp } from './app.js'
import { createLogger } from '@decoration-bidding/shared-utils'

const PORT = Number(process.env.PORT) || 8080
const logger = createLogger('gateway')

async function main() {
  const app = await buildApp()
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' })
    logger.info(`listening on port ${PORT}`)
  } catch (err) {
    logger.error({ err }, '启动失败')
    process.exit(1)
  }
}

main()
