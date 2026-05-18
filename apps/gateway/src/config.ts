export const config = {
  PORT: Number(process.env.PORT) || 8080,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // 下游服务地址
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || 'http://localhost:3001',
  TENDER_SERVICE_URL: process.env.TENDER_SERVICE_URL || 'http://localhost:3002',
  BID_SERVICE_URL: process.env.BID_SERVICE_URL || 'http://localhost:3003',
  SCRAPER_SERVICE_URL: process.env.SCRAPER_SERVICE_URL || 'http://localhost:3004',
  AI_AGENT_SERVICE_URL: process.env.AI_AGENT_SERVICE_URL || 'http://localhost:3005',
  NOTIFY_SERVICE_URL: process.env.NOTIFY_SERVICE_URL || 'http://localhost:3006',
  VOICE_SERVICE_URL: process.env.VOICE_SERVICE_URL || 'http://localhost:3007',
  BIM_SERVICE_URL: process.env.BIM_SERVICE_URL || 'http://localhost:3008',
} as const
