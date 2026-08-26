// ─────────────────────────────────────────────────────────────────────────────
// capacity-test.js — open-model capacity test. THIS is the script that answers
// "what is our ceiling?" — load-test.js and stress-test.js explicitly do not.
//
// Why open model: `ramping-vus`/`constant-vus` (used by the other two scripts)
// are CLOSED-MODEL executors — each VU waits for its current request/think()
// cycle to finish before starting the next one. When the server slows down,
// the load generator automatically slows down with it (coordinated omission),
// so a closed-model test reports a deceptively calm p95 exactly when the
// system is struggling. `ramping-arrival-rate` / `constant-arrival-rate` are
// OPEN-MODEL executors: k6 starts iterations at a fixed rate regardless of
// how long the previous ones take. When the app can't keep up, offered load
// stays constant and k6 either queues iterations against `maxVUs` or — once
// that's exhausted — drops them. That's what makes the results honest.
//
// ── How to read `dropped_iterations` (the PRIMARY output of this script) ──
// `dropped_iterations` is a built-in k6 Counter: an iteration that k6 could
// not start because every pre-allocated/max VU was already busy with a
// slower-than-expected prior iteration. It stays at ~0 while the app is
// keeping up with the offered rate, no matter how high that rate is. The
// moment it starts climbing, the app has fallen behind the requested
// arrival rate — that is the knee, and the arrival rate at the knee IS the
// ceiling. Don't look at p95 to find the ceiling; look at dropped_iterations.
//
// p95/p99 blowing past whatever number you'd normally consider healthy
// (e.g. >200ms) as you approach the knee is the EXPECTED finding, not a
// test failure — that's why there are no tight p95 thresholds on the
// breakpoint scenario below. A failing p95 threshold would just abort the
// run before it reached the interesting part.
//
// ── Generator saturation invalidates results ────────────────────────────
// If the k6 process itself can't generate load fast enough (CPU pegged,
// `http_req_blocked` spiking — time spent waiting for a free connection/TCP
// handshake on the CLIENT side), you are measuring the load generator's
// ceiling, not the app's. Watch generator CPU (`top`/`htop` on the VPS
// running k6) and the `http_req_blocked` metric in the summary — if CPU is
// >80% or http_req_blocked is a meaningful fraction of http_req_duration
// near the "knee", increase preAllocatedVUs/maxVUs, split the generator
// across multiple machines, or discount that portion of the run.
//
// ── Log level (see Part 3c of the plan) ─────────────────────────────────
// Run capacity tests with LOG_LEVEL=warn on the app:
//   LOG_LEVEL=warn docker compose up -d app
// At 1000 req/s, per-request `info` completion lines are pure cost — they
// flood Loki (~250 KB/s, ~900 MB/hour, see the plan's memory budget) and
// tell you nothing k6's own client-side percentiles don't already give you
// more cheaply. Dropping to `warn` silences those lines but keeps every
// signal this script needs to diagnose a knee: errors, slow-query warnings,
// cache lock timeouts, rate-limit warns, Mongo pool-checkout failures, and
// — critically — the 10s process tick (heap/rss/event-loop lag/pool gauges)
// from src/instrumentation.ts, because that telemetry logger is pinned to
// 'info' independent of LOG_LEVEL (src/lib/logger.ts createTelemetryLogger).
// So `warn` gives you the full Part 1 diagnostic set at a fraction of the
// log volume. Use `info` only for the realistic-journey run (load-test.js),
// where request rate is low enough that the volume doesn't matter and the
// per-request lines feed the server-side p50/p95 panels.
//
// ── Tiers ────────────────────────────────────────────────────────────────
// Same TIER contract as load-test.js/stress-test.js. Capacity tests are
// meant to run as TIER=A (default), on the VPS, direct to
// http://127.0.0.1:3002 — that's what makes this the TRUE Node/Mongo/Redis
// ceiling, with no nginx limit_req/limit_conn or WAN latency in the way.
// TIER=B is supported for symmetry (e.g. validating the edge doesn't add
// its own ceiling below the app's), but nginx's own limits will dominate
// the result long before the app's do — expect TIER=B numbers to plateau
// around nginx's limit_conn (200) and not reflect the app's real capacity.
//
// ── Scenarios (individually selectable — this does NOT default to a
//    25-minute run) ────────────────────────────────────────────────────────
// Select with __ENV.SCENARIO: 'breakpoint' (default), 'steady', 'cold_cache',
// 'miss', 'stampede', 'soak', or 'all' to run breakpoint/steady/cold_cache
// back-to-back (~30 min — opt in explicitly). 'miss', 'stampede', 'soak' are
// NOT included in 'all' — they're long/destructive/manual-follow-up enough
// that they should always be invoked explicitly.
//
//   breakpoint  ramping-arrival-rate, ~50 → 1500 req/s over ~10m, no
//               plateau. This is the discovery run — its job is to find
//               the knee. Run this FIRST.
//   steady      constant-arrival-rate at __ENV.STEADY_RATE req/s (default
//               500), held 15m. Run this at ~70% of the breakpoint you just
//               discovered (__ENV.STEADY_RATE=<0.7 * knee>) to surface
//               leaks and connection-pool drift that a short run misses.
//   cold_cache  busts Redis via POST /api/revalidate (Bearer
//               __ENV.SCRAPER_SECRET), then applies constant-arrival-rate
//               load at __ENV.COLD_CACHE_RATE req/s (default 200) for 3m,
//               so withCache's single-flight + distributed lock is measured
//               under constant OFFERED load rather than a closed-model test
//               that would self-throttle around the stampede.
//
//   miss        ramping-arrival-rate, ~10 → 300 req/s over ~8m. Forces a
//               cache miss BY CONSTRUCTION on (almost) every request instead
//               of flushing Redis, so it's repeatable and non-destructive —
//               this measures the real DB-bound ceiling, not the Redis-
//               bound one `breakpoint` finds at warm cache. See the
//               scenario definition below for exactly which params
//               guarantee a fresh cache key/bypass and why (this depends on
//               how `src/services/product.service.ts` builds cache keys —
//               read that comment before touching this scenario).
//   stampede    Correctness test, not a throughput test. Busts the cache for
//               one specific URL, then fires ~200 requests at that exact
//               same URL as close to simultaneously as possible. Verifies
//               withCache's single-flight + distributed lock in
//               `src/lib/cache.ts` collapse N concurrent misses into ~1
//               Mongo query.
//
//               PASS/FAIL is read server-side in Loki, not from k6's own
//               output (k6 only sees 200s, which is expected whether or not
//               single-flight is working — it's the Mongo query COUNT that
//               proves it). Run the app at LOG_LEVEL=debug for this
//               scenario specifically — repo:product's per-query completion
//               line ("Product query completed") is logged at debug, and at
//               the default warn/info level it's invisible except when the
//               query happens to be slow (>100ms), which is not reliable
//               enough to count against. After the run, in Grafana/Loki:
//               1. Narrow the time range to the burst's few-second window.
//               2. Run:
//                    sum(count_over_time(
//                      {container="kickmap", module="repo:product"}
//                      | json | filters="vendor,onSaleOnly" [$__interval]
//                    ))
//                  (STAMPEDE_URL_PATH below is
//                  `?vendor=StampedeTest&onSaleOnly=true` — filterSummary
//                  in product.repository.ts joins filter KEYS, not values,
//                  so "vendor,onSaleOnly" is what that specific combo logs
//                  as.)
//               3. PASS: count is 1 (or a small single-digit number if a
//                  lock timeout forced a fallback fetch — see "Lock
//                  timeout — fetching ourselves" in src/lib/cache.ts). FAIL:
//                  count is anywhere near 200 — single-flight/the
//                  distributed lock did not collapse the burst and every
//                  request independently hit Mongo.
//               Repeat several bursts by re-running the command below in a
//               shell loop (__ENV.REPEATS is informational — see why in the
//               setup()/scenario comments, not an internal loop).
//   soak        constant-arrival-rate at __ENV.SOAK_RATE req/s (default
//               100), held __ENV.SOAK_DURATION (default 60m). Purpose is
//               DRIFT detection, not finding a ceiling — pick SOAK_RATE
//               comfortably below whatever knee `breakpoint`/`miss` found,
//               so any degradation over the hour is drift, not saturation.
//               Watch, over the FULL window, in Grafana panels 11 ("Mongo
//               Pool") and 12 ("Node Process") — per OBSERVABILITY.md
//               these are NOT scoped by $test_run (periodic telemetry, no
//               testRun field), so select the run's time range instead:
//                 - rss / heapUsed trending up with no plateau = leak
//                 - poolInUse trending up with no plateau, or approaching
//                   ~3×poolSize with no recovery = connection leak/pool
//                   exhaustion building slowly
//                 - Redis memory (check via `redis-cli info memory` or a
//                   Grafana Redis panel if one exists — not currently
//                   covered by grafana.json) trending up = key/TTL
//                   mismanagement, e.g. keys outliving their intended TTL
//                 - eventLoopLag_mean drifting meaningfully above its ~20ms
//                   idle baseline (see OBSERVABILITY.md §6 on why 20ms
//                   itself is NOT a problem) = growing GC pressure or sync
//                   work creeping onto the main thread
//               A flat line on all four over the full duration is a pass.
//
// Example runs (from the VPS):
//   LOG_LEVEL=warn TIER=A TEST_RUN=$(uuidgen) k6 run capacity-test.js
//   TIER=A SCENARIO=steady STEADY_RATE=350 k6 run capacity-test.js
//   TIER=A SCENARIO=cold_cache k6 run capacity-test.js
//   TIER=A SCENARIO=miss k6 run capacity-test.js
//   TIER=A SCENARIO=stampede SCRAPER_SECRET=xxx k6 run capacity-test.js
//   TIER=A SCENARIO=soak SOAK_RATE=150 SOAK_DURATION=90m k6 run capacity-test.js
// ─────────────────────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';

const TIER = (__ENV.TIER || 'A').toUpperCase();
const LOAD_TEST_SECRET = __ENV.LOAD_TEST_SECRET || '';

if (TIER === 'B' && !LOAD_TEST_SECRET) {
  throw new Error(
    'TIER=B requires LOAD_TEST_SECRET (must match the app\'s LOAD_TEST_SECRET / ' +
    'nginx allowlist header). Without it this run just measures nginx\'s rate ' +
    'limiter, not the app. Set LOAD_TEST_SECRET or use TIER=A.',
  );
}

const BASE_URL = __ENV.BASE_URL || (TIER === 'B' ? 'https://kickmap.sijar.tech' : 'http://127.0.0.1:3002');
const TEST_RUN = __ENV.TEST_RUN || `run-${Date.now()}-${Math.floor(Math.random() * 1e9).toString(36)}`;
const SCENARIO = __ENV.SCENARIO || 'breakpoint';
const STEADY_RATE = Number(__ENV.STEADY_RATE || 500);
const COLD_CACHE_RATE = Number(__ENV.COLD_CACHE_RATE || 200);
const SOAK_RATE = Number(__ENV.SOAK_RATE || 100);
const SOAK_DURATION = __ENV.SOAK_DURATION || '60m';
const STAMPEDE_VUS = Number(__ENV.STAMPEDE_VUS || 200);
const REPEATS = Number(__ENV.REPEATS || 1);

const REGIONS = ['MY', 'ID', 'SG', 'TH'];
const SIZES   = ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'];
const VENDORS = ['Nike', 'Adidas', 'New Balance', 'Puma', 'Reebok', 'Asics', 'Vans', 'Converse'];
const GENDERS = ['men', 'women', 'unisex', 'kids'];

let knownProductCodes = [];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// One synthetic address per (pooled) VU. With arrival-rate executors a VU
// serves many iterations over the run rather than one "user", but spreading
// requests across distinct X-Real-IP values still keeps the app's per-IP
// rate limiter from throttling the offered rate before it's had a chance
// to find the app's real ceiling (100-request/60s windows would otherwise
// cap a single "IP" well below 1500 req/s).
// One synthetic address per REQUEST, not per VU. The per-VU version was
// wrong in a way that only shows up once the app is fast: arrival-rate
// executors size the VU pool to `rate x response_time`, so at 50 req/s with
// 30ms responses k6 needs ~1.5 VUs — meaning one or two synthetic IPs
// absorb the entire offered rate and blow straight through the app's
// 100-request/60s per-IP limit. The faster the app got, the harder the test
// throttled itself: an 8m miss run came back 44% 429s. ~65k addresses keeps
// every bucket far below the limit regardless of how few VUs are live.
function vuIp() {
  const n = Math.floor(Math.random() * 65536);
  return `10.${n >> 8}.${n & 0xff}.${Math.floor(Math.random() * 254) + 1}`;
}

function tierHeaders() {
  if (TIER === 'B') return { 'X-Load-Test': LOAD_TEST_SECRET };
  return { 'X-Real-IP': vuIp() };
}

// Non-2xx tracked by status code bucket so 429 (rate limited — expected at
// volume), 500 (app error), and 503 (dependency degraded, e.g. exchange
// rate fetch) are distinguishable from each other in the summary, instead
// of collapsing into one "error rate" number.
const status2xx  = new Rate('status_2xx');
const status429  = new Rate('status_429');
const status500  = new Rate('status_500');
const status503  = new Rate('status_503');
const statusOther = new Rate('status_other');

function get(url, tags) {
  const res = http.get(url, {
    headers: { ...tierHeaders(), 'X-Test-Run': TEST_RUN },
    // k6 tags every request with its full URL by default. Several scenarios
    // deliberately put a unique nonce in the query string, so each request
    // would mint its own metric time series — an 8m miss run produced
    // 400,022 of them, which costs real memory and CPU on a generator that
    // is already sharing cores with the app. `name` overrides the URL in
    // metrics, collapsing each endpoint back to a single series. The
    // `endpoint` tag every call site already passes is exactly the right
    // grouping key.
    tags: { ...tags, name: (tags && tags.endpoint) || url },
    timeout: '30s',
  });
  status2xx.add(res.status >= 200 && res.status < 300);
  status429.add(res.status === 429);
  status500.add(res.status === 500);
  status503.add(res.status === 503);
  statusOther.add(res.status >= 400 && res.status !== 429 && res.status !== 500 && res.status !== 503);
  return res;
}

// Weighted mix of the app's real endpoints, matching load-test.js's journey
// ratios but flattened to one representative request per iteration — open-
// model iterations are units of offered load, not multi-step user sessions.
function mixedRequest() {
  const roll = Math.random() * 100;

  if (roll < 36) {
    const res = get(`${BASE_URL}/api/heatmap`, { endpoint: 'heatmap' });
    check(res, { 'heatmap ok': (r) => r.status === 200 || r.status === 429 });
  } else if (roll < 62) {
    const res = get(
      `${BASE_URL}/api/deals?sort=discount_desc&limit=20`,
      { endpoint: 'deals' },
    );
    check(res, { 'deals ok': (r) => r.status === 200 || r.status === 429 });
  } else if (roll < 82) {
    const size = pick(SIZES);
    const res = get(
      `${BASE_URL}/api/products?size=${size}&inStock=true&limit=24`,
      { endpoint: 'products' },
    );
    check(res, { 'products ok': (r) => r.status === 200 || r.status === 429 });
  } else if (roll < 92) {
    const res = get(`${BASE_URL}/api/exchange`, { endpoint: 'exchange' });
    check(res, { 'exchange ok': (r) => r.status === 200 || r.status === 429 });
  } else {
    if (knownProductCodes.length > 0) {
      const code = pick(knownProductCodes);
      const res = get(
        `${BASE_URL}/api/products/${encodeURIComponent(code)}`,
        { endpoint: 'product-detail' },
      );
      check(res, { 'product detail ok': (r) => r.status === 200 || r.status === 429 || r.status === 404 });
    } else {
      const vendor = pick(VENDORS);
      const res = get(
        `${BASE_URL}/api/products?vendor=${encodeURIComponent(vendor)}&limit=24`,
        { endpoint: 'products' },
      );
      check(res, { 'products ok': (r) => r.status === 200 || r.status === 429 });
    }
  }
}

// ── miss scenario ─────────────────────────────────────────────────────────
// Cache-key contract this scenario depends on (confirmed by reading
// src/services/product.service.ts + src/lib/cache-keys.ts — read those
// before changing this):
//
//   buildCacheKey(filters) takes EVERY defined key in ProductFilters
//   (region, vendor, inStock, size, gender, onSaleOnly, model, q,
//   multiRegion), sorts the entries, and joins them into
//   `products:filtered:<k>:<v>|<k>:<v>|...`. So region/vendor/size/gender/
//   onSaleOnly/model ALL feed the key — varying any of them changes it.
//
//   BUT: `q` does NOT feed a cache key at all — product.service.ts's
//   getProducts() branches around withCache entirely when `filters.q` is
//   defined ("Skip cache for free-text q queries to prevent Redis key
//   explosion"), calling productRepository.findMany() directly. So a
//   request with `q=` is not a "miss" in the cache sense — there is no key,
//   ever, for it. It's an unconditional Mongo hit, which is exactly what
//   this scenario wants for the ~25% bucket that uses it below.
//
//   Naive high-cardinality combos of just vendor×size×region×gender×
//   onSaleOnly are NOT enough by themselves: those sets are small (4×10×
//   8×4×2 = 2560 combos) and this scenario runs at up to 300 req/s for ~8
//   minutes (~130K+ iterations) — every combo would repeat thousands of
//   times and mostly hit a WARM cache after the first pass, silently
//   turning "miss" into "breakpoint". So every filtered-combo request also
//   sets `model=<per-iteration nonce>`. `model` is a real ProductFilters
//   key that feeds buildCacheKey (and is used as a $regex on title/
//   colorway in product.repository.ts — matches nothing, which is fine,
//   this is a synthetic load shape, not a correctness test), so the nonce
//   guarantees a cache key never seen before on every single iteration.
function nonceToken() {
  return `n${__VU}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function missRequest() {
  const roll = Math.random() * 100;

  if (roll < 5) {
    // The brutal compare-page pattern (src/app/compare/page.tsx fetches
    // `multiRegion=true` + optional `q`). Deliberately capped at ~5% of
    // iterations — it's pathological (limit=10000, though the route clamps
    // to 500 server-side) and would dominate the result if weighted any
    // higher. `q` present ⇒ unconditional cache bypass, see comment above.
    const token = nonceToken();
    const res = get(
      `${BASE_URL}/api/products?multiRegion=true&q=${encodeURIComponent(token)}&limit=10000`,
      { endpoint: 'miss-multiregion' },
    );
    check(res, { 'miss multiregion ok': (r) => r.status === 200 || r.status === 429 });
  } else if (roll < 30) {
    // Free-text search — bypasses the cache layer entirely by construction
    // (see comment above), guaranteed Mongo hit via the $or regex search
    // path in product.repository.ts.
    const token = nonceToken();
    const res = get(
      `${BASE_URL}/api/products?q=${encodeURIComponent(token)}&limit=24`,
      { endpoint: 'miss-search' },
    );
    check(res, { 'miss search ok': (r) => r.status === 200 || r.status === 429 });
  } else {
    // High-cardinality filter combo (real vendor/size/region/gender/
    // onSaleOnly values, realistic query shape) + a `model` nonce to force
    // a cache key never seen before — see comment above for why the nonce
    // is required and why it's `model` specifically.
    // NOTE: k6 runs on goja, not Node or a browser — there is no
    // URLSearchParams, URL, fetch, or Buffer. Build query strings by hand.
    const token = nonceToken();
    const parts = [
      `vendor=${encodeURIComponent(pick(VENDORS))}`,
      `size=${encodeURIComponent(pick(SIZES))}`,
      `region=${encodeURIComponent(pick(REGIONS))}`,
      `gender=${encodeURIComponent(pick(GENDERS))}`,
    ];
    if (Math.random() < 0.5) parts.push('onSaleOnly=true');
    parts.push(`model=${encodeURIComponent(token)}`);
    parts.push('limit=24');
    const res = get(`${BASE_URL}/api/products?${parts.join('&')}`, { endpoint: 'miss-filtered' });
    check(res, { 'miss filtered ok': (r) => r.status === 200 || r.status === 429 });
  }
}

// ── stampede scenario ────────────────────────────────────────────────────
// Fixed target URL — every VU in the burst hits the exact same cache key
// (`products:filtered:onSaleOnly:true|vendor:StampedeTest`) so withCache's
// single-flight (`inFlight` Map) + distributed lock (`lock:<key>`, EX 30,
// NX) in src/lib/cache.ts have exactly one thing to collapse concurrent
// misses onto.
const STAMPEDE_URL_PATH = '/api/products?vendor=StampedeTest&onSaleOnly=true&limit=24';

function stampedeRequest() {
  const res = get(`${BASE_URL}${STAMPEDE_URL_PATH}`, { endpoint: 'stampede' });
  check(res, { 'stampede ok': (r) => r.status === 200 || r.status === 429 });
}

// ── Scenario definitions ─────────────────────────────────────────────────

const allScenarios = {
  breakpoint: {
    executor: 'ramping-arrival-rate',
    startRate: 50,
    timeUnit: '1s',
    preAllocatedVUs: 300,
    maxVUs: 3000,
    stages: [
      // No plateau — ramp continuously so the knee shows up as a rate, not
      // a duration. 10 minutes total.
      { target: 300, duration: '2m' },
      { target: 700, duration: '2m' },
      { target: 1100, duration: '3m' },
      { target: 1500, duration: '3m' },
    ],
    exec: 'mixedRequest',
    tags: { scenario: 'breakpoint' },
  },
  steady: {
    executor: 'constant-arrival-rate',
    // Run this at ~70% of the breakpoint discovered above
    // (STEADY_RATE=<0.7 * knee>). Held long (15m) specifically to surface
    // what a 5-minute run misses: slow leaks, connection-pool drift,
    // gradually growing GC pressure.
    rate: STEADY_RATE,
    timeUnit: '1s',
    duration: '15m',
    preAllocatedVUs: Math.max(200, Math.ceil(STEADY_RATE * 0.5)),
    maxVUs: Math.max(1000, STEADY_RATE * 3),
    exec: 'mixedRequest',
    tags: { scenario: 'steady' },
  },
  cold_cache: {
    executor: 'constant-arrival-rate',
    rate: COLD_CACHE_RATE,
    timeUnit: '1s',
    duration: '3m',
    preAllocatedVUs: Math.max(100, Math.ceil(COLD_CACHE_RATE * 0.5)),
    maxVUs: Math.max(500, COLD_CACHE_RATE * 3),
    exec: 'mixedRequest',
    tags: { scenario: 'cold_cache' },
  },
  miss: {
    executor: 'ramping-arrival-rate',
    startRate: 10,
    timeUnit: '1s',
    preAllocatedVUs: 300,
    maxVUs: 3000,
    stages: [
      // ~8 minutes total. Ceiling here is expected to be MUCH lower than
      // breakpoint's 1500 — every request is DB-bound by construction (see
      // missRequest() comment above), so the knee should show up well
      // before 300 req/s if Mongo is the bottleneck.
      { target: 50, duration: '1m30s' },
      { target: 120, duration: '2m' },
      { target: 200, duration: '2m' },
      { target: 300, duration: '2m30s' },
    ],
    exec: 'missRequest',
    tags: { scenario: 'miss' },
  },
  // Correctness test, not a throughput test — see header comment and the
  // stampedeRequest()/setup() comments for the full contract. shared-
  // iterations chosen over constant-arrival-rate deliberately: with
  // shared-iterations, all `STAMPEDE_VUS` VUs are allocated and started
  // together and each immediately fires its one iteration — there is no
  // scheduling spread across a timeUnit the way an arrival-rate executor
  // would impose (e.g. rate:200/timeUnit:1s still staggers arrivals across
  // that full second). shared-iterations is the tightest concurrent burst
  // k6's executors offer, which is exactly what's needed to hit
  // withCache's single-flight/lock window before the first response comes
  // back and repopulates the cache.
  stampede: {
    executor: 'shared-iterations',
    vus: STAMPEDE_VUS,
    iterations: STAMPEDE_VUS,
    maxDuration: '30s',
    exec: 'stampedeRequest',
    tags: { scenario: 'stampede' },
  },
  soak: {
    executor: 'constant-arrival-rate',
    rate: SOAK_RATE,
    timeUnit: '1s',
    duration: SOAK_DURATION,
    preAllocatedVUs: Math.max(200, Math.ceil(SOAK_RATE * 0.5)),
    maxVUs: Math.max(1000, SOAK_RATE * 3),
    // Realistic mixed traffic shape (same journey mix as breakpoint/steady)
    // — soak is about drift over time, not a novel request pattern.
    exec: 'mixedRequest',
    tags: { scenario: 'soak' },
  },
};

function selectedScenarios() {
  if (SCENARIO === 'all') {
    // 'all' stays scoped to the original three — miss/stampede/soak are
    // long-running, destructive-adjacent, or need manual Loki follow-up, so
    // they're opt-in only, never bundled into a default multi-scenario run.
    return { breakpoint: allScenarios.breakpoint, steady: allScenarios.steady, cold_cache: allScenarios.cold_cache };
  }
  if (!allScenarios[SCENARIO]) {
    throw new Error(
      `Unknown SCENARIO "${SCENARIO}" — expected one of: breakpoint, steady, cold_cache, miss, stampede, soak, all`,
    );
  }
  return { [SCENARIO]: allScenarios[SCENARIO] };
}

export const options = {
  scenarios: selectedScenarios(),
  thresholds: {
    // dropped_iterations is the PRIMARY output — see header comment. This is
    // a safety net, not a pass/fail gate for "does the app perform well": a
    // handful of drops right at the knee is the expected finding, not a
    // failure. abortOnFail exists to stop wasting the rest of the ramp once
    // saturation is severe and unambiguous (>200 dropped iterations) — by
    // then the ceiling is already established and continuing to climb
    // toward 1500 req/s just burns generator resources for no new signal.
    // Applies globally regardless of which SCENARIO is selected (only one
    // scenario runs per invocation, except 'all'), which is what keeps this
    // guard live on `miss` (a ceiling-finding scenario, same as
    // `breakpoint`) without having to duplicate it per-scenario. Never
    // remove this — ceiling-finding scenarios must abort at the knee, not
    // push toward OOM.
    dropped_iterations: [{ threshold: 'count<200', abortOnFail: true }],

    // Deliberately NOT setting a tight p95 threshold — see header comment.
    // p95 blowing past 200ms as the offered rate approaches the knee is the
    // expected finding, not a test failure, and a tight threshold here
    // would abort the run before it reached the interesting part.

    // Distinguish real errors from expected rate-limit backpressure.
    status_500: ['rate<0.05'],
    status_503: ['rate<0.05'],
  },
};

// ── setup(): runs exactly once, before any scenario's VUs start ──────────
// Meaningful for cold_cache (busts the whole products:*/heatmap:* space so
// the run measures withCache's single-flight + distributed lock recovering
// under constant offered load, not a warm cache) and for stampede (busts
// the same space so STAMPEDE_URL_PATH's specific key is guaranteed cold
// before the burst — without this, a prior run's TTL could still have it
// warm and the "stampede" would just be 200 cache hits, proving nothing).
// Using setup() (rather than "first iteration on VU 1", as stress-test.js
// does for its closed-model cold_cache scenario) guarantees exactly one
// bust, independent of how many VUs spin up concurrently at t=0.
//
// stampede + REPEATS: setup() only runs once per k6 process invocation, so
// REPEATS is NOT an internal loop here — a second in-process burst would
// hit a now-warm cache (the first burst's single winning request populates
// Redis) and "prove" single-flight is working even if it isn't, because
// there'd be nothing left to collapse. Each burst needs its own fresh
// setup()-driven bust, so REPEATS is consumed by re-invoking `k6 run`
// itself, once per burst (see the shell loop in OBSERVABILITY.md's
// runbook). __ENV.REPEATS is read here only to print it for the operator.
export function setup() {
  if (SCENARIO === 'cold_cache' || SCENARIO === 'all' || SCENARIO === 'stampede') {
    const res = http.post(`${BASE_URL}/api/revalidate`, null, {
      headers: {
        'X-Test-Run': TEST_RUN,
        Authorization: `Bearer ${__ENV.SCRAPER_SECRET ?? ''}`,
      },
    });
    console.log(`Cache bust for ${SCENARIO} scenario: HTTP ${res.status}`);
  }

  if (SCENARIO === 'stampede') {
    console.log(
      `Stampede burst: ${STAMPEDE_VUS} concurrent requests at ${BASE_URL}${STAMPEDE_URL_PATH}. ` +
      `This is burst 1 of REPEATS=${REPEATS} — re-run this exact command ${REPEATS} times ` +
      `(each invocation re-busts the cache in its own setup()) to get multiple bursts. ` +
      `After each run, check Loki (see header comment) for the repo query count.`,
    );
  }
}

// k6 resolves `exec` by exported function name — export under the name used
// in the scenario definitions above.
export { mixedRequest, missRequest, stampedeRequest };
