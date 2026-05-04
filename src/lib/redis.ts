import Redis from 'ioredis';
import { env } from '@/env';

const globalWithRedis = globalThis as typeof globalThis & {
  redis?: Redis;
};

export const redis: Redis =
  globalWithRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    connectTimeout: 5000,
    commandTimeout: 3000,
    // enableOfflineQueue: false,
    retryStrategy: (times: number) => {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
  });

if (process.env.NODE_ENV !== 'production') {
  globalWithRedis.redis = redis;
}
