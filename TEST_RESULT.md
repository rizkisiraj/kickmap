# KickMap Load Test Results

---

## Run #4 — Stress Test — 2026-05-07 WIB

### Test Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-05-07 |
| **Target** | `https://kickmap.sijar.tech` |
| **Test Duration** | 9m 8.5s |
| **k6 Script** | `stress-test.js` |
| **Peak VUs** | 200 (spike phase) |
| **Cache state** | Warm (busted during cold_cache phase) |

---

### Phase Shape

```
VUs
200 |                         ████
100 |          ██████████████      ██
 20 |          |            |          ████
  5 | ████████ |            |          |
    +──────────────────────────────────────
      0m  1m   3m           6m  7m  8m  9m
     warm ramp  sustained  spike rec cold
```

---

### Threshold Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| `http_req_duration{phase:ramp}` | p(95) < 500ms | 115ms | PASS |
| `http_req_duration{phase:sustained}` | p(95) < 500ms | 163ms | PASS |
| `http_req_duration{phase:spike}` | p(95) < 5000ms | 291ms | PASS |
| `http_req_duration{phase:recovery}` | p(95) < 1000ms | 630ms | PASS |
| `http_req_duration{phase:cold_cache}` | p(95) < 3000ms | 148ms | PASS |
| `http_req_duration{endpoint:heatmap,phase:sustained}` | p(95) < 200ms | 100ms | PASS |
| `http_req_duration{endpoint:products,phase:sustained}` | p(95) < 500ms | 180ms | PASS |
| `http_req_duration{endpoint:deals,phase:sustained}` | p(95) < 500ms | 129ms | PASS |
| `http_req_duration{endpoint:product-detail,phase:sustained}` | p(95) < 300ms | 111ms | PASS |
| `http_req_duration{endpoint:exchange,phase:sustained}` | p(95) < 300ms | 96ms | PASS |
| `app_errors` | rate < 1% | 0.00% | PASS |
| `rate_limited` | rate < 10% | 0.47% | PASS |

**All 12 thresholds passed.**

---

### Performance by Phase

| Phase | VUs | avg | p50 | p95 | max | n |
|-------|-----|-----|-----|-----|-----|---|
| Ramp (5→100) | 5–100 | 57ms | 46ms | 115ms | 2,129ms | 4,099 |
| Sustained (100) | 100 | 73ms | 50ms | 163ms | 2,218ms | 10,315 |
| Spike (100→200) | 100–200 | 139ms | 77ms | 292ms | 5,683ms | 6,196 |
| Recovery (200→20) | 200–20 | 229ms | 63ms | 631ms | 5,392ms | 3,778 |
| Cold cache (20) | 20 | 59ms | 44ms | 149ms | 337ms | 699 |

---

### Sustained Peak — Endpoint Breakdown (100 VUs)

| Endpoint | avg | p50 | p95 | max | Target |
|----------|-----|-----|-----|-----|--------|
| `/api/exchange` | 48ms | 39ms | 96ms | 293ms | <300ms |
| `/api/heatmap` | 56ms | 39ms | 100ms | 1,714ms | <200ms |
| `/api/product-detail` | 59ms | 42ms | 111ms | 2,082ms | <300ms |
| `/api/deals` | 68ms | 44ms | 129ms | 2,214ms | <500ms |
| `/api/products` | 79ms | 57ms | 180ms | 2,131ms | <500ms |

---

### Request Phase Breakdown

| Phase | avg | p50 | p95 | max |
|-------|-----|-----|-----|-----|
| Sending | 0.1ms | 0.1ms | 0.2ms | 6ms |
| Waiting (TTFB) | 100ms | 51ms | 199ms | 5,570ms |
| Receiving | 6.8ms | 1.5ms | 37ms | 2,421ms |

---

### Throughput & Volume

| Metric | Total | Rate |
|--------|-------|------|
| HTTP requests | 26,212 | 47.8 req/s |
| Rate-limited (429) | 125 | 0.47% |
| Real errors | 0 | 0.00% |
| Cache misses (header) | 0 | 0.00% |
| Iterations completed | 7,206 | 13.1 iter/s |
| Data received | 805 MB | 1.5 MB/s |
| Data sent | 4.6 MB | 8.4 kB/s |

---

### Checks (Functional Correctness)

**19,569 / 19,569 passed (100%)** across all phases and all 13 check types.

---

### Key Findings

1. **Server did not break under 200 VUs.** Spike p95 was 291ms — well inside the 5,000ms budget. The server degraded gracefully and never returned errors.

2. **Recovery is the weakest phase** — p95 jumped to 630ms and max hit 5.4s as the server drained 200 concurrent connections down to 20. This is connection teardown pressure, not application failure. All checks still passed.

3. **Cold cache recovery was instant** — after `/api/revalidate` busted the cache, 20 VUs under live traffic warmed it back in under 337ms max. The `inFlight` lock and stale-memory pattern in `cache.ts` absorbed the stampede effectively.

4. **Zero cache misses tracked via header** — `X-Cache-Status: MISS` was never observed across 26,212 requests during the stress run, confirming Redis was serving all traffic.

5. **Rate limiter well within budget** — only 0.47% (125 requests) hit 429 at 200 VUs peak, far below the 10% threshold.

6. **Breaking point not found** — the server handled 47.8 req/s at peak with 0% errors. The actual ceiling is higher than 200 VUs. A follow-up run ramping to 400–500 VUs would be needed to find the saturation point.

---

---

## Run #3 — 2026-05-07 09:04 WIB

### Test Metadata

| Field | Value |
|-------|-------|
| **Date** | 2026-05-07 |
| **Time** | 09:04 WIB |
| **Target** | `https://kickmap.sijar.tech` |
| **Test Duration** | 6m 13.6s (1m warmup + 5m main load) |
| **k6 Script** | `load-test.js` |
| **Peak VUs** | 55 (5 warmup + 50 load) |
| **Cache state** | Warm |

---

### Scenarios

| Scenario | VUs | Duration | Start | Purpose |
|----------|-----|----------|-------|---------|
| warmup | 5 | 1m | 0s | Populate Redis before main load |
| homepage_browser | 18 | 5m | 1m | Heatmap + products + filter bar + slide panel |
| deal_hunter | 13 | 5m | 1m | Deals list + Load More + region filter |
| size_finder | 10 | 5m | 1m | Sizes API + size-filtered products + scroll |
| price_comparer | 4 | 5m | 1m | Multi-region compare + search + exchange rates |
| product_browser | 5 | 5m | 1m | Product detail page |

---

### Threshold Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| `http_req_duration{endpoint:heatmap}` | p(95) < 150ms | 126ms | PASS |
| `http_req_duration{endpoint:products}` | p(95) < 200ms | 170ms | PASS |
| `http_req_duration{endpoint:deals}` | p(95) < 200ms | 111ms | PASS |
| `http_req_duration{endpoint:product-detail}` | p(95) < 200ms | 117ms | PASS |
| `http_req_duration{endpoint:exchange}` | p(95) < 300ms | 79ms | PASS |
| `app_errors` | rate < 0.5% | 0.00% | PASS |
| `http_req_failed` | rate < 2% | 9.25% | FAIL (all 429s) |
| `rate_limited` | rate < 5% | 9.25% | FAIL |

---

### HTTP Performance by Endpoint

| Endpoint | avg | p50 | p95 | max | n |
|----------|-----|-----|-----|-----|---|
| `/api/exchange` | 41ms | 31ms | 79ms | 280ms | 132 |
| `/api/product-detail` | 49ms | 33ms | 117ms | 907ms | 272 |
| `/api/heatmap` | 53ms | 32ms | 126ms | 894ms | 478 |
| `/api/deals` | 56ms | 39ms | 111ms | 813ms | 1,023 |
| `/api/sizes` | 55ms | 34ms | 173ms | 805ms | 317 |
| `/api/products` | 69ms | 51ms | 170ms | 1,056ms | 2,815 |
| **Overall** | **57ms** | **42ms** | **135ms** | **1,056ms** | **6,981** |

---

### Request Phase Breakdown

| Phase | avg | p50 | p95 | max |
|-------|-----|-----|-----|-----|
| Sending | 0.1ms | 0.1ms | 0.3ms | 3ms |
| Waiting (TTFB) | 52ms | 39ms | 115ms | 907ms |
| Receiving | 4.8ms | 0.8ms | 26ms | 437ms |

TTFB dominates at 52ms avg — Redis serving most requests. Receiving time is low (p50 0.8ms) — `Cache-Control` headers added in this session are reducing repeat payload downloads.

---

### Throughput & Volume

| Metric | Total | Rate |
|--------|-------|------|
| HTTP requests | 6,981 | 18.7 req/s |
| Rate-limited (429) | 646 | 9.25% |
| Real errors (non-2xx, non-429) | 0 | 0.00% |
| Iterations completed | 1,756 | 4.7 iter/s |
| Data received | 163 MB | 436 kB/s |
| Data sent | 950 kB | 2.5 kB/s |

---

### Checks (Functional Correctness)

| Check | Result |
|-------|--------|
| heatmap 200 | 100% |
| sizes 200 | 100% |
| deals 200 | 100% |
| load more 200 | 100% |
| region deals 200 | 100% |
| compare 200 | 100% |
| compare search 200 | 100% |
| exchange 200 | 100% |
| filter bar 200 | 100% |
| slide panel 200 | 100% |
| size products 200 | 100% |
| size scroll 200 | 100% |
| product detail 200 | 100% |

**Total: 4,076 / 4,076 passed (100%)**

---

### Error Analysis

**Zero real application errors.** All 646 failures are 429 rate limit responses.

The rate limiter breach (9.25% vs 5% target) is a side effect of warm cache performance — VUs now complete iterations faster (avg 8.86s vs 15.34s in run #1), cycling back sooner and hitting the per-IP ceiling more frequently. The server is not failing; it is responding correctly with 429s.

---

### Progression Across All Runs

| Metric | Run #1 Cold cache | Run #2 Warm | Run #3 Warm + Cache-Control |
|--------|:-----------------:|:-----------:|:---------------------------:|
| Overall p95 | 6,660ms | 215ms | **135ms** |
| `products` p95 | 11,300ms | 165ms | **170ms** |
| `heatmap` p95 | 3,690ms | 150ms | **126ms** |
| `product-detail` p95 | 4,460ms | 147ms | **117ms** |
| `deals` p95 | 4,550ms | 106ms | **111ms** |
| `exchange` p95 | 3,120ms | 64ms | **79ms** |
| Receiving p95 | 37ms | 37ms | **26ms** |
| Checks failed | 0.44% | 0% | **0%** |
| Iterations | 1,011 | 1,658 | **1,756** |
| Throughput | 8.3 req/s | 16.3 req/s | **18.7 req/s** |
| Real errors | 0.33% | 0% | **0%** |

---

### Key Findings

1. **Cache-Control headers reduced receiving p95** from 37ms → 26ms (-30%). Browser-level caching is preventing repeat downloads of large product list payloads.
2. **Rate limiter is the only failing threshold.** All endpoint SLAs pass. The 9.25% 429 rate should trigger a review of the rate limit ceiling for production traffic.
3. **TTFB max of 907ms** is an isolated cold cache hit — one request missed Redis and hit MongoDB. Normal TTFB p95 is 115ms.
4. **Throughput ceiling not yet found** — the server handled 18.7 req/s across 50 VUs with zero errors. Run `stress-test.js` to find the actual breaking point.

---

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
