import { redis } from '@/lib/redis';

interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfter?: number;
}

export const rateLimit = async (
  identifier: string,
  prefix: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> => {
  const key = `${prefix}:${identifier}`;

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.ttl(key);
    const results = await pipeline.exec();

    if (!results) return { success: true, remaining: maxRequests };

    const incrResult = results[0];
    const ttlResult = results[1];
    if (!incrResult || !ttlResult) return { success: true, remaining: maxRequests };

    const [incrErr, count] = incrResult;
    const [ttlErr, ttl] = ttlResult;
    if (incrErr || ttlErr) return { success: true, remaining: maxRequests };

    const currentCount = count as number;
    const currentTtl = ttl as number;

    if (currentCount === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (currentCount > maxRequests) {
      const retryAfter = currentTtl > 0 ? currentTtl : windowSeconds;
      return { success: false, remaining: 0, retryAfter };
    }

    return { success: true, remaining: maxRequests - currentCount };
  } catch {
    // Fail open — never block traffic due to Redis downtime
    return { success: true, remaining: maxRequests };
  }
};

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0];
    return (first ?? '').trim() || 'unknown';
  }
  return 'unknown';
}
