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
    // Unbounded retry with capped backoff. Returning `null` (the previous
    // behaviour after 3 attempts) tells ioredis to STOP reconnecting
    // forever — a single Redis blip would then permanently disable the
    // cache until the container restarts, with every request falling
    // through to MongoDB. Keep retrying indefinitely, capping the delay
    // at 5s so reconnect attempts don't hammer Redis during an outage.
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
  });

redis.on('connect', () => log.info('Redis connected'));
redis.on('reconnecting', () => log.warn('Redis reconnecting...'));
redis.on('error', (err) => log.error({ err: err.message }, 'Redis error'));
redis.on('end', () => log.warn('Redis connection closed'));

if (process.env.NODE_ENV !== 'production') {
  globalWithRedis.redis = redis;
}
