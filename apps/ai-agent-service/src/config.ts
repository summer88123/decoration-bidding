export const config = {
  PORT: Number(process.env.PORT) || 3005,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/decoration_bidding',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  RABBITMQ_URL: process.env.RABBITMQ_URL || 'amqp://localhost:5672',

  // LLM Provider（支持任意 OpenAI 兼容接口，如 Kimi、DeepSeek 等）
  // 去掉首尾空格及非 ASCII 字符（防止中文逗号等误输入污染 HTTP 头）
  LLM_API_KEY: (process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || '').trim().replace(/[^\x20-\x7E]/g, ''),
  LLM_BASE_URL: process.env.LLM_BASE_URL || '',  // 留空则使用 OpenAI 官方接口
  LLM_SUPPORTS_VISION: process.env.LLM_SUPPORTS_VISION !== 'false',  // 默认 true，纯文本模型设为 false
  DEFAULT_LLM_MODEL: process.env.DEFAULT_LLM_MODEL || 'moonshot-v1-8k',

  // 兼容旧变量名
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER || 'openai',

  // Embedding
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || 'text-embedding-3-large',

  // Langfuse 可观测性
  LANGFUSE_HOST: process.env.LANGFUSE_HOST || '',
  LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY || '',
  LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY || '',
} as const
