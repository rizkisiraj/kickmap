import { timingSafeEqual } from 'node:crypto';
import { redis } from '@/lib/redis';
import { env } from '@/env';

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

// `X-Real-IP` is set by nginx via `proxy_set_header X-Real-IP $remote_addr`,
// which overwrites any client-supplied value — trustworthy.
// `X-Forwarded-For` is *appended to* by nginx via `$proxy_add_x_forwarded_for`,
// so the LAST entry is the nginx-supplied one; the first entry can be forged
// by the client and must never be trusted for rate limiting.
export function getClientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    const last = parts[parts.length - 1];
    const trimmed = (last ?? '').trim();
    if (trimmed) return trimmed;
  }

  return 'unknown';
}

// nginx sets `X-Load-Test` from a `geo`/`map` allowlist keyed on the real
// source IP (see nginx-config.md), to a shared secret rather than a fixed
// value. That is what makes this trustworthy: nginx strips/overwrites the
// header AND the value must match LOAD_TEST_SECRET. Neither alone is
// sufficient — nginx forwards unrecognized client headers to the upstream by
// default, so a literal "1" (or any fixed value) is a straight rate-limit
// bypass for anyone, whether or not the nginx config in nginx-config.md has
// actually been applied to the live server (it is documentation only).
// When LOAD_TEST_SECRET is unset (the normal production default), this
// always returns false.
export function isLoadTest(request: Request): boolean {
  const secret = env.LOAD_TEST_SECRET;
  if (!secret) return false;

  const header = request.headers.get('x-load-test');
  if (!header) return false;

  const headerBuf = Buffer.from(header);
  const secretBuf = Buffer.from(secret);
  if (headerBuf.length !== secretBuf.length) return false;

  return timingSafeEqual(headerBuf, secretBuf);
}
