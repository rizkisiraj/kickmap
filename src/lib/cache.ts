import { redis } from '@/lib/redis';

export const CACHE_TTL = {
  PRODUCTS: 6 * 3600,       // 6h — full product lists
  PRODUCT_DETAIL: 12 * 3600, // 12h — individual products rarely change
  DEALS: 6 * 3600,           // 6h — invalidated by scraper
  HEATMAP: 30 * 60,          // 30min — sidebar counts should stay fresh
  EXCHANGE: 3600,             // 1h — exchange rate API limit
  AUTOCOMPLETE: 5 * 60,      // 5min — partial model queries, prevent key pollution
} as const;

// Single-flight registry: prevents cache stampede within a single process
const inFlight = new Map<string, Promise<unknown>>();

// Stale-while-revalidate: hold last-known values in memory so we can serve
// them immediately when Redis expires, while one request revalidates.
const staleMemory = new Map<string, unknown>();

export const withCache = async <T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> => {
  // 1. Try Redis first
  const cached = await redis.get(key);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }

  // 2. Redis expired — serve stale from memory immediately if available
  const memoryStale = staleMemory.get(key);
  if (memoryStale !== undefined) {
    // Trigger background revalidation (fire-and-forget)
    void revalidate(key, ttlSeconds, fetchFn);
    return memoryStale as T;
  }

  // 3. No stale data — need to fetch. Use distributed lock to ensure only
  // one process globally hits the DB; others wait via inFlight map.
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  return revalidate(key, ttlSeconds, fetchFn);
};

async function revalidate<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const lockKey = `lock:${key}`;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');

  if (!lockAcquired) {
    // Another process is fetching — wait via inFlight for this process
    const existing = inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    // Lock held by another process but we have no inFlight promise.
    // Poll Redis briefly until the key appears (they'll set it soon).
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const cached = await redis.get(key);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    }
    // Timeout — fallback to fetch ourselves (lock may have expired)
  }

  const promise = fetchFn()
    .then((fresh) => {
      staleMemory.set(key, fresh);
      void redis.setex(key, ttlSeconds, JSON.stringify(fresh));
      return fresh;
    })
    .finally(() => {
      inFlight.delete(key);
      void redis.del(lockKey);
    });

  inFlight.set(key, promise);
  return promise;
}
