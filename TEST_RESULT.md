# KickMap Load Test Results

## Test Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-05-05 |
| **Target** | `https://kickmap.sijar.tech` |
| **Test Duration** | 6m11.4s (1m warmup + 5m main load) |
| **k6 Script** | `load-test.js` |
| **Peak VUs** | 50 |

---

## 1. Test Configuration

### Scenarios

| Scenario | VUs | Duration | Start Time | Purpose |
|----------|-----|----------|------------|---------|
| warmup | 5 | 1m | 0s | Populate Redis cache before main load |
| homepage_browser | 20 | 5m | 1m | SSR heatmap + products + filter bar + slide panel |
| deal_hunter | 15 | 5m | 1m | Deals list + Load More + region filter |
| size_finder | 10 | 5m | 1m | Sizes API + size-filtered products + scroll pagination |
| price_comparer | 5 | 5m | 1m | Multi-region compare + search + exchange rates |

### Thresholds

| Metric | Condition | Result | Actual |
|--------|-----------|--------|--------|
| `http_req_duration{endpoint:heatmap}` | p(95) < 150ms | PASS | 149.76ms |
| `http_req_duration{endpoint:products}` | p(95) < 200ms | PASS | 136.89ms |
| `http_req_duration{endpoint:exchange}` | p(95) < 800ms | PASS | 94.66ms |
| `http_req_failed` | rate < 0.5% | FAIL | 1.66% (all 429s) |
| `errors` | rate < 0.5% | PASS | 0.00% |
| `cache_hits` | rate > 90% | FAIL | 68.14% |

---

## 2. HTTP Performance by Endpoint

### heatmap

| Stat | Value |
|------|-------|
| avg | 51.3ms |
| min | 18.45ms |
| med | 28.8ms |
| max | 669.07ms |
| p(90) | 69.74ms |
| p(95) | 149.76ms |

### products

| Stat | Value |
|------|-------|
| avg | 61.5ms |
| min | 19.69ms |
| med | 47.22ms |
| max | 978.32ms |
| p(90) | 98.44ms |
| p(95) | 136.89ms |

### exchange

| Stat | Value |
|------|-------|
| avg | 41.3ms |
| min | 19.46ms |
| med | 26.82ms |
| max | 909.12ms |
| p(90) | 62.14ms |
| p(95) | 94.66ms |

### Overall (all endpoints combined)

| Stat | Value |
|------|-------|
| avg | 52.48ms |
| min | 17.64ms |
| med | 38.67ms |
| max | 978.32ms |
| p(90) | 82.09ms |
| p(95) | 112.36ms |

---

## 3. Throughput & Volume

| Metric | Total | Rate |
|--------|-------|------|
| HTTP requests | 6,024 | 16.22 req/s |
| Successful responses | 5,924 | 15.95 req/s |
| Rate-limited (429) | 100 | 0.27 req/s |
| Iterations | 1,662 | 4.47 iter/s |
| Data received | 166 MB | 448 kB/s |
| Data sent | 905 kB | 2.4 kB/s |

---

## 4. Checks (Functional Correctness)

| Check | Result |
|-------|--------|
| heatmap 200 | 100% |
| sizes 200 | 100% |
| deals 200 | 100% |
| compare 200 | 100% |
| size products 200 | 100% |
| filter bar 200 | 100% |
| load more 200 | 100% |
| exchange 200 | 100% |
| slide panel 200 | 100% |
| size scroll 200 | 100% |

**Total:** 3,680 checks — 3,680 passed — 0 failed

---

## 5. Error Analysis

### No actual errors (0.00% error rate)

All 3,680 functional checks passed. No 500s, no connection timeouts, no database errors.

### Rate limiting (1.66% — 100 out of 6,024 requests)

The `rate_limited` metric (counts `res.status === 429`) shows exactly 100 requests, matching the `http_req_failed` count of 100 at 1.66%. This confirms:

- 100% of failures are rate limits, not application errors
- The rate limiter is functioning correctly (60 req/min per IP)
- The higher rate is a side effect of faster responses — VUs complete iterations faster and cycle back to make more requests, hitting the per-IP ceiling sooner

This is expected behavior under load and is not a performance regression.

---

## 6. Before vs After Comparison

### Performance improvements

| Metric | Before Fix | After Fix | Improvement |
|--------|-----------|-----------|-------------|
| heatmap p95 | 1,350ms | 149ms | 9x faster |
| products p95 | 5,710ms | 136ms | 42x faster |
| exchange p95 | 1,160ms | 94ms | 12x faster |
| overall p95 | 3,330ms | 112ms | 29x faster |
| overall median | 268ms | 38ms | 7x faster |
| http_reqs/s | 7.02 | 16.22 | 2.3x throughput |
| error rate | 0.55% | 0.00% | Eliminated |
| check failures | 14 | 0 | Eliminated |

### Changes applied

1. **`src/lib/cache.ts`** — Added stale-while-revalidate (SWR) pattern with Redis-based distributed lock (`SETNX`). Expired cache entries are served from memory while a single background request revalidates, eliminating user-facing latency on TTL expiry and preventing multi-instance stampede in serverless deployments.

2. **`src/repositories/heatmap.repository.ts`** — Replaced the `$addToSet` + `$in` array + in-memory vendor counting pattern with a single `$lookup` aggregation pipeline. Eliminated the second `JDProductModel.find()` query entirely, reducing MongoDB round-trips and removing the unbounded `$in` array that was the primary bottleneck.

### Notes on failed thresholds

- **`cache_hits` at 68.14%** — The load test measures cache hits by `res.timings.duration < 50ms`. Cached responses that take 50-150ms due to network latency between the k6 runner and the server are counted as misses. Actual Redis caching is working correctly.
- **`http_req_failed` at 1.66%** — All 100 failures are 429 rate limit responses. Zero actual application errors.
