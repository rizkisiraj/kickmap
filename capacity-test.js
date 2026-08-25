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
// or 'all' to run all three back-to-back (~30 min — opt in explicitly).
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
// Example runs (from the VPS):
//   LOG_LEVEL=warn TIER=A TEST_RUN=$(uuidgen) k6 run capacity-test.js
//   TIER=A SCENARIO=steady STEADY_RATE=350 k6 run capacity-test.js
//   TIER=A SCENARIO=cold_cache k6 run capacity-test.js
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

const REGIONS = ['MY', 'ID', 'SG', 'TH'];
const SIZES   = ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'];
const VENDORS = ['Nike', 'Adidas', 'New Balance', 'Puma', 'Reebok', 'Asics', 'Vans', 'Converse'];

let knownProductCodes = [];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// One synthetic address per (pooled) VU. With arrival-rate executors a VU
// serves many iterations over the run rather than one "user", but spreading
// requests across distinct X-Real-IP values still keeps the app's per-IP
// rate limiter from throttling the offered rate before it's had a chance
// to find the app's real ceiling (100-request/60s windows would otherwise
// cap a single "IP" well below 1500 req/s).
function vuIp() {
  return `10.${Math.floor(__VU / 254)}.${(__VU % 254) + 1}.1`;
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
    tags,
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
};

function selectedScenarios() {
  if (SCENARIO === 'all') return allScenarios;
  if (!allScenarios[SCENARIO]) {
    throw new Error(`Unknown SCENARIO "${SCENARIO}" — expected one of: breakpoint, steady, cold_cache, all`);
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
// Only meaningful for the cold_cache scenario — busts the Redis product/
// heatmap caches so the run measures withCache's single-flight + distributed
// lock recovering under constant offered load, not a warm cache. Using
// setup() (rather than "first iteration on VU 1", as stress-test.js does for
// its closed-model cold_cache scenario) guarantees exactly one bust,
// independent of how many VUs constant-arrival-rate spins up concurrently
// at t=0.
export function setup() {
  if (SCENARIO !== 'cold_cache' && SCENARIO !== 'all') return;

  const res = http.post(`${BASE_URL}/api/revalidate`, null, {
    headers: {
      'X-Test-Run': TEST_RUN,
      Authorization: `Bearer ${__ENV.SCRAPER_SECRET ?? ''}`,
    },
  });
  console.log(`Cache bust for cold_cache scenario: HTTP ${res.status}`);
}

// k6 resolves `exec` by exported function name — export under the name used
// in the scenario definitions above.
export { mixedRequest };
