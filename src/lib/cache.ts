import { redis } from '@/lib/redis';

export const CACHE_TTL = {
  PRODUCTS: 6 * 3600,       // 6h — full product lists
  PRODUCT_DETAIL: 12 * 3600, // 12h — individual products rarely change
  DEALS: 6 * 3600,           // 6h — invalidated by scraper
  HEATMAP: 30 * 60,          // 30min — sidebar counts should stay fresh
  EXCHANGE: 3600,             // 1h — exchange rate API limit
  AUTOCOMPLETE: 5 * 60,      // 5min — partial model queries, prevent key pollution
} as const;

// Single-flight registry: prevents cache stampede by coalescing concurrent
// requests for the same key into one MongoDB fetch instead of N identical ones.
const inFlight = new Map<string, Promise<unknown>>();

export const withCache = async <T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> => {
  const cached = await redis.get(key);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }

  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetchFn()
    .then((fresh) => {
      void redis.setex(key, ttlSeconds, JSON.stringify(fresh));
      return fresh;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
};
