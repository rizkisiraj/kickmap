import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    MONGODB_URI: z.string().url(),
    REDIS_URL: z.string().url(),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(100),
    EXCHANGE_API_BASE_URL: z.string().url().default('https://open.er-api.com/v6/latest'),
    SCRAPER_SECRET: z.string().min(16),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    MONGODB_URI: process.env.MONGODB_URI,
    REDIS_URL: process.env.REDIS_URL,
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    EXCHANGE_API_BASE_URL: process.env.EXCHANGE_API_BASE_URL,
    SCRAPER_SECRET: process.env.SCRAPER_SECRET,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: process.env.NODE_ENV === 'test' || !!process.env.SKIP_ENV_VALIDATION,
});
