export const config = {
  PORT: Number(process.env.PORT) || 3003,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/decoration_bidding',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  STORAGE_DRIVER: process.env.STORAGE_DRIVER || 'local',
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  BASE_URL: process.env.BASE_URL || 'http://localhost:3003',
  BIM_SERVICE_URL: process.env.BIM_SERVICE_URL || 'http://localhost:3008',
  AI_AGENT_SERVICE_URL: process.env.AI_AGENT_SERVICE_URL || 'http://localhost:3005',
} as const
