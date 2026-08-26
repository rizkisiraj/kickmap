import { redis } from '@/lib/redis';
import { createLogger } from '@/lib/logger';

const log = createLogger('cache');

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
//
// Bounded LRU (Map-based): Map iteration order is insertion order, so on
// `get` we delete+re-insert the key to move it to the "most recently used"
// end, and on `set` — once we're over MAX_STALE_MEMORY_ENTRIES — we evict
// the first key from `.keys()`, which is the least-recently-used entry.
// Without this, every distinct cache key (including every unique
// `model=`/autocomplete search token) would add a permanent entry and never
// get evicted, leaking memory for the lifetime of the process.
const MAX_STALE_MEMORY_ENTRIES = 500;
const staleMemory = new Map<string, unknown>();

function staleMemoryGet(key: string): unknown {
  if (!staleMemory.has(key)) return undefined;
  const value = staleMemory.get(key);
  staleMemory.delete(key);
  staleMemory.set(key, value);
  return value;
}

function staleMemorySet(key: string, value: unknown): void {
  if (staleMemory.has(key)) staleMemory.delete(key);
  staleMemory.set(key, value);
  if (staleMemory.size > MAX_STALE_MEMORY_ENTRIES) {
    const oldestKey = staleMemory.keys().next().value;
    if (oldestKey !== undefined) staleMemory.delete(oldestKey);
  }
}

export const withCache = async <T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> => {
  // 1. Try Redis first
  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      log.debug({ key: getKeyPattern(key), hit: true }, 'Cache hit');
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    log.error({ err: (err as Error).message, key: getKeyPattern(key) }, 'Redis cache read error');
  }

  // 2. Redis expired — serve stale from memory immediately if available
  const memoryStale = staleMemoryGet(key);
  if (memoryStale !== undefined) {
    log.debug({ key: getKeyPattern(key), stale: true }, 'Serving stale from memory');
    // Trigger background revalidation (fire-and-forget)
    void revalidate(key, ttlSeconds, fetchFn);
    return memoryStale as T;
  }

  // 3. No stale data — need to fetch. Use distributed lock to ensure only
  // one process globally hits the DB; others wait via inFlight map.
  const existing = inFlight.get(key);
  if (existing) {
    log.debug({ key: getKeyPattern(key), waiting: true }, 'Waiting for in-flight request');
    return existing as Promise<T>;
  }

  log.debug({ key: getKeyPattern(key), hit: false }, 'Cache miss');
  return revalidate(key, ttlSeconds, fetchFn);
};

async function revalidate<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const lockKey = `lock:${key}`;
  let lockAcquired = false;

  try {
    const result = await redis.set(lockKey, '1', 'EX', 30, 'NX');
    lockAcquired = result === 'OK';
  } catch (err) {
    log.error({ err: (err as Error).message, key: getKeyPattern(key) }, 'Redis lock acquisition error');
  }

  if (!lockAcquired) {
    // Another process is fetching — wait via inFlight for this process
    const existing = inFlight.get(key);
    if (existing) {
      log.debug({ key: getKeyPattern(key), lockContention: true }, 'Lock contention — waiting for in-flight');
      return existing as Promise<T>;
    }
    // Lock held by another process but we have no inFlight promise.
    // Poll Redis briefly until the key appears (they'll set it soon).
    // Exponential backoff, capped at ~775ms worst case total (25+50+100+200+400ms)
    // — well under the old fixed 1000ms (10x100ms) so a request never holds
    // its resources for a full second waiting on another process's lock.
    const backoffDelaysMs = [25, 50, 100, 200, 400];
    for (const delay of backoffDelaysMs) {
      await new Promise((r) => setTimeout(r, delay));
      try {
        const cached = await redis.get(key);
        if (cached !== null) {
          return JSON.parse(cached) as T;
        }
      } catch {
        // Continue polling
      }
    }
    // Timeout — fallback to fetch ourselves (lock may have expired)
    log.warn({ key: getKeyPattern(key) }, 'Lock timeout — fetching ourselves');
  }

  const promise = fetchFn()
    .then((fresh) => {
      staleMemorySet(key, fresh);
      void redis.setex(key, ttlSeconds, JSON.stringify(fresh));
      return fresh;
    })
    .catch((err) => {
      log.error({ err: (err as Error).message, key: getKeyPattern(key) }, 'Cache revalidation failed');
      throw err;
    })
    .finally(() => {
      inFlight.delete(key);
      void redis.del(lockKey).catch(() => {});
    });

  inFlight.set(key, promise);
  return promise;
}

function getKeyPattern(key: string): string {
  // Strip specific IDs to group logs by pattern (e.g., products:filtered:region:MY -> products:filtered)
  return key.split(':').slice(0, 2).join(':');
}
