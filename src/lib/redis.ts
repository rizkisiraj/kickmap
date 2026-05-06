import Redis from 'ioredis';
import { env } from '@/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('redis');

const globalWithRedis = globalThis as typeof globalThis & {
  redis?: Redis;
};

export const redis: Redis =
  globalWithRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    commandTimeout: 3000,
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });

redis.on('connect', () => log.info('Redis connected'));
redis.on('reconnecting', () => log.warn('Redis reconnecting...'));
redis.on('error', (err) => log.error({ err: err.message }, 'Redis error'));
redis.on('end', () => log.warn('Redis connection closed'));

if (process.env.NODE_ENV !== 'production') {
  globalWithRedis.redis = redis;
}
