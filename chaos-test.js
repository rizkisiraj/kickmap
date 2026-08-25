// ─────────────────────────────────────────────────────────────────────────────
// chaos-test.js — dependency failure injection. THIS script does not find a
// ceiling and does not need to be well-behaved under load — it runs a steady,
// modest load while a HUMAN OPERATOR manually kills and restores Redis (and,
// optionally, Mongo/Atlas connectivity) so we can watch the app's documented
// failure-handling code paths actually fire, instead of trusting the code
// reading alone.
//
// This is a SEPARATE script from capacity-test.js on purpose — it is not a
// ceiling-finding tool (no ramp, no dropped_iterations abort-at-the-knee
// logic is meaningful here) and it needs operator-timed console instructions
// that don't belong in a script whose job is unattended arrival-rate ramps.
//
// ── What SHOULD happen (derived from reading the actual source, not
//    assumed) ─────────────────────────────────────────────────────────────
//
// `docker compose stop redis`:
//   - src/lib/rate-limit.ts rateLimit() wraps its Redis pipeline in try/catch
//     and the catch unconditionally returns `{ success: true, remaining:
//     maxRequests }` — "Fail open — never block traffic due to Redis
//     downtime". Expect ZERO new 429s while Redis is down, no matter how
//     much load is offered.
//   - src/lib/cache.ts withCache(): step 1 (`redis.get`) throws → caught,
//     logs "Redis cache read error" (log.error, module="cache") → falls to
//     step 2 (staleMemory Map, if this process has served the key before)
//     → step 3 (revalidate(): redis.set NX lock also throws → caught, logs
//     "Redis lock acquisition error" → lockAcquired stays false → falls
//     into the inFlight/poll-then-fetch-ourselves path) → fetchFn() (Mongo).
//     Net effect: latency jumps to Mongo-bound (comparable to capacity-test
//     .js's `miss` scenario numbers), NOT to an error. Error rate should
//     stay ~0 throughout. **Any 500s during this phase are a bug** — every
//     Redis failure path above is wrapped in try/catch specifically so a
//     dead cache degrades latency, not correctness.
//   - Also expect `void redis.setex(...)` and `void redis.del(lockKey)`
//     calls in cache.ts to throw and be silently swallowed (`.catch(() =>
//     {})` on the del; the setex has no catch at all — it's a floating
//     promise, so its rejection is unhandled but fire-and-forget, i.e. it
//     does not affect the response the user already got).
//
// `docker compose start redis`:
//   - src/lib/redis.ts's retryStrategy: `(times) => times > 3 ? null :
//     Math.min(times * 200, 1000)`. ⚠️ KNOWN GOTCHA, inferred from code —
//     NOT verified by actually running this, because this task doesn't run
//     docker: if Redis stays down for longer than ~4 reconnect attempts
//     (~1.2s of backoff), ioredis returns `null` from retryStrategy and
//     STOPS retrying permanently, emitting `end` — it does NOT keep
//     probing forever waiting for Redis to come back. Any docker-compose-
//     stop chaos run almost certainly exceeds 1.2s, so `docker compose
//     start redis` may NOT be enough by itself to restore the "Redis
//     connected" log line / baseline latency. If latency and cache
//     behavior do not recover within a few seconds of starting Redis,
//     the fix is `docker compose restart app` to force a fresh ioredis
//     client — confirm which behavior you actually observe and treat that
//     as the real finding, this comment is a prediction to check, not a
//     guarantee.
//   - If it DOES reconnect (or after `docker compose restart app`): "Redis
//     connected" (module="redis", log.info) appears in Loki, subsequent
//     withCache calls hit step 1 successfully again, latency returns to
//     baseline.
//
// Mongo (Atlas) chaos — ADVANCED / OPTIONAL, NOT the default path:
//   Atlas is a remote managed cluster — there is no local container to
//   `docker compose stop`. The only way to simulate a Mongo outage from
//   this host is to block outbound traffic to it at the OS level. This is
//   MUCH more disruptive than the Redis phase (the app fails OPEN on Redis
//   but has no equivalent fallback for Mongo — every cache miss and every
//   fetchFn() call will hang/error) and it will NOT be reverted
//   automatically by this script. Only do this if you specifically want to
//   observe Mongo-failure behavior (pool errors, "MongoDB disconnected",
//   whatever error shape a hung Atlas connection actually produces) and you
//   are prepared to run the undo command yourself:
//
//     # Find the Atlas IP(s) first — mongodb+srv resolves via SRV/TXT DNS
//     # to multiple shard/replica hosts, resolve your actual cluster's
//     # hostname (from MONGODB_URI, NOT reproduced here — it's a secret):
//     dig +short <your-cluster-shard-0-host>.mongodb.net
//
//     # Block outbound to that IP (run once per resolved IP):
//     sudo iptables -A OUTPUT -d <ATLAS_IP> -j DROP
//
//     # UNDO — run this the moment you're done observing, the app is
//     # completely broken (not degraded — broken) until you do:
//     sudo iptables -D OUTPUT -d <ATLAS_IP> -j DROP
//
//   This script will NOT print these instructions as part of the default
//   run — see the console output at startup, which only walks through the
//   Redis phase. Do the Mongo/iptables step manually, out of band, only if
//   you explicitly want it.
//
// ── Load shape ───────────────────────────────────────────────────────────
// constant-arrival-rate at __ENV.CHAOS_RATE req/s (default 50) — steady and
// modest on purpose, this is not a capacity test, it needs to stay well
// within the app's normal ceiling so any latency/error change you observe
// is attributable to the injected failure, not to offered load exceeding
// capacity. Total duration __ENV.CHAOS_DURATION_MIN minutes (default 10),
// split into three PRE-DEFINED, separately-tagged phases so k6's own
// summary (and Loki, via the `phase` tag if you thread it through — see
// note below) separate pre-failure / during-failure / post-recovery:
//
//   pre_failure     first ~30% of the run — baseline, nothing killed yet
//   during_failure  middle ~40% — kill Redis at the start of this phase
//   post_recovery   last ~30% — restart Redis at the start of this phase
//
// setup() prints the exact elapsed-time AND wall-clock offsets for both
// operator actions before any load starts. Watch the console.
//
// Note on Loki correlation: k6's `tags: { phase: ... }` only affects k6's
// OWN summary/metrics, not the app's logs — the app has no concept of
// "phase". To correlate in Grafana, use the wall-clock timestamps this
// script prints and narrow the Loki time range to each phase, the same way
// panels 7/11/12 are correlated in OBSERVABILITY.md (time range, not a
// label) since there's no `phase` field threaded into the app's logger.
//
// ── Tiers / auth — same contract as capacity-test.js ───────────────────
// TIER=A (default) → http://127.0.0.1:3002, X-Real-IP per VU.
// TIER=B → https://kickmap.sijar.tech, requires LOAD_TEST_SECRET.
//
// Example:
//   TIER=A CHAOS_RATE=50 CHAOS_DURATION_MIN=10 TEST_RUN=$(uuidgen) \
//     k6 run chaos-test.js
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
const TEST_RUN = __ENV.TEST_RUN || `chaos-${Date.now()}-${Math.floor(Math.random() * 1e9).toString(36)}`;
const CHAOS_RATE = Number(__ENV.CHAOS_RATE || 50);
const CHAOS_DURATION_MIN = Number(__ENV.CHAOS_DURATION_MIN || 10);

// Phase split: 30% / 40% / 30%, each phase at least 1 minute.
const PRE_MIN = Math.max(1, Math.round(CHAOS_DURATION_MIN * 0.3));
const DURING_MIN = Math.max(1, Math.round(CHAOS_DURATION_MIN * 0.4));
const POST_MIN = Math.max(1, CHAOS_DURATION_MIN - PRE_MIN - DURING_MIN);

const REGIONS = ['MY', 'ID', 'SG', 'TH'];
const SIZES   = ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'];
const VENDORS = ['Nike', 'Adidas', 'New Balance', 'Puma', 'Reebok', 'Asics', 'Vans', 'Converse'];

let knownProductCodes = [];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Same per-VU synthetic IP trick as capacity-test.js — keeps the app's
// per-IP rate limiter from confounding the chaos observation (we want to
// see Redis-down behavior, not a rate-limit artifact from all requests
// sharing one IP).
function vuIp() {
  return `10.${Math.floor(__VU / 254)}.${(__VU % 254) + 1}.1`;
}

function tierHeaders() {
  if (TIER === 'B') return { 'X-Load-Test': LOAD_TEST_SECRET };
  return { 'X-Real-IP': vuIp() };
}

// Same status-bucket split as capacity-test.js — see that file's comment.
// status_500 is the one that matters most here: per the header comment,
// ANY 500 during during_failure is a bug (Redis failures are all supposed
// to degrade latency, not correctness), not an expected finding.
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

// Same weighted endpoint mix as capacity-test.js's mixedRequest — chaos
// wants realistic traffic shape, not a novel one. Deliberately favors
// endpoints that go through withCache (products/deals/heatmap) since
// that's the code path under test.
function chaosRequest() {
  const roll = Math.random() * 100;

  if (roll < 36) {
    const res = get(`${BASE_URL}/api/heatmap`, { endpoint: 'heatmap' });
    check(res, { 'heatmap not 500': (r) => r.status !== 500 });
  } else if (roll < 62) {
    const res = get(`${BASE_URL}/api/deals?sort=discount_desc&limit=20`, { endpoint: 'deals' });
    check(res, { 'deals not 500': (r) => r.status !== 500 });
  } else if (roll < 82) {
    const size = pick(SIZES);
    const res = get(`${BASE_URL}/api/products?size=${size}&inStock=true&limit=24`, { endpoint: 'products' });
    check(res, { 'products not 500': (r) => r.status !== 500 });
  } else if (roll < 92) {
    const res = get(`${BASE_URL}/api/exchange`, { endpoint: 'exchange' });
    check(res, { 'exchange not 500': (r) => r.status !== 500 });
  } else if (knownProductCodes.length > 0) {
    const code = pick(knownProductCodes);
    const res = get(`${BASE_URL}/api/products/${encodeURIComponent(code)}`, { endpoint: 'product-detail' });
    check(res, { 'product detail not 500': (r) => r.status !== 500 });
  } else {
    const vendor = pick(VENDORS);
    const res = get(`${BASE_URL}/api/products?vendor=${encodeURIComponent(vendor)}&limit=24`, { endpoint: 'products' });
    check(res, { 'products not 500': (r) => r.status !== 500 });
  }
}

export const options = {
  scenarios: {
    pre_failure: {
      executor: 'constant-arrival-rate',
      rate: CHAOS_RATE,
      timeUnit: '1s',
      duration: `${PRE_MIN}m`,
      preAllocatedVUs: Math.max(100, Math.ceil(CHAOS_RATE * 0.5)),
      maxVUs: Math.max(500, CHAOS_RATE * 3),
      exec: 'chaosRequest',
      tags: { phase: 'pre_failure' },
    },
    during_failure: {
      executor: 'constant-arrival-rate',
      rate: CHAOS_RATE,
      timeUnit: '1s',
      duration: `${DURING_MIN}m`,
      startTime: `${PRE_MIN}m`,
      preAllocatedVUs: Math.max(100, Math.ceil(CHAOS_RATE * 0.5)),
      maxVUs: Math.max(500, CHAOS_RATE * 3),
      exec: 'chaosRequest',
      tags: { phase: 'during_failure' },
    },
    post_recovery: {
      executor: 'constant-arrival-rate',
      rate: CHAOS_RATE,
      timeUnit: '1s',
      duration: `${POST_MIN}m`,
      startTime: `${PRE_MIN + DURING_MIN}m`,
      preAllocatedVUs: Math.max(100, Math.ceil(CHAOS_RATE * 0.5)),
      maxVUs: Math.max(500, CHAOS_RATE * 3),
      exec: 'chaosRequest',
      tags: { phase: 'post_recovery' },
    },
  },
  thresholds: {
    // NOT abortOnFail — this is not a ceiling-finding scenario and we want
    // the full run to complete regardless, so the operator can see the
    // post-recovery phase too. A failing threshold here is a signal to go
    // read Loki, not a reason to cut the run short.
    // Any 500 anywhere in this run is, per the header comment, a bug —
    // every documented Redis failure path degrades latency, not
    // correctness. Threshold set tight for exactly that reason.
    status_500: ['rate<0.01'],
    // 429s should be ~0 throughout, INCLUDING during_failure — rateLimit()
    // fails open on Redis errors, so a spike in 429s during the kill
    // window would itself be evidence the fail-open path isn't working.
    status_429: ['rate<0.02'],
    // Deliberately no p95/latency threshold — latency jumping during
    // during_failure (Mongo-bound instead of Redis-bound) is the expected
    // finding, not a failure.
  },
};

export function setup() {
  const now = Date.now();
  const preFailureEnd = new Date(now + PRE_MIN * 60 * 1000);
  const duringFailureEnd = new Date(now + (PRE_MIN + DURING_MIN) * 60 * 1000);
  const totalEnd = new Date(now + CHAOS_DURATION_MIN * 60 * 1000);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('CHAOS TEST — dependency failure injection. Manual operator action required.');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Target: ${BASE_URL} (TIER=${TIER}), rate=${CHAOS_RATE} req/s, total=${CHAOS_DURATION_MIN}m`);
  console.log('');
  console.log(`Phase 1 — pre_failure   (t+0 → t+${PRE_MIN}m, ends ~${preFailureEnd.toLocaleTimeString()}):`);
  console.log('  Do nothing. Let this run to establish baseline latency/error rate.');
  console.log('');
  console.log(`Phase 2 — during_failure (t+${PRE_MIN}m → t+${PRE_MIN + DURING_MIN}m, ends ~${duringFailureEnd.toLocaleTimeString()}):`);
  console.log(`  >>> AT ~${preFailureEnd.toLocaleTimeString()}, RUN:  docker compose stop redis`);
  console.log('  Expect: latency jumps (Mongo-bound), status_429 stays ~0 (fail-open),');
  console.log('  status_500 stays ~0 (any 500 here is a bug — see header comment).');
  console.log('  Loki: {container="kickmap"} | json | module="cache" | log_level=~"warn|error"');
  console.log('');
  console.log(`Phase 3 — post_recovery (t+${PRE_MIN + DURING_MIN}m → t+${CHAOS_DURATION_MIN}m, ends ~${totalEnd.toLocaleTimeString()}):`);
  console.log(`  >>> AT ~${duringFailureEnd.toLocaleTimeString()}, RUN:  docker compose start redis`);
  console.log('  Expect: "Redis connected" in Loki ({container="kickmap"} | json | module="redis"),');
  console.log('  latency returns to baseline. ⚠️ KNOWN GOTCHA (see header comment, unverified —');
  console.log('  this task did not run docker): ioredis retryStrategy gives up after ~1.2s of');
  console.log('  backoff, so recovery may require `docker compose restart app`, not just');
  console.log('  `start redis`, if the client already gave up retrying. Watch Loki for');
  console.log('  "Redis connected" — if it never appears, restart the app container.');
  console.log('');
  console.log('Mongo/Atlas chaos is ADVANCED/OPTIONAL and NOT part of this script — see the');
  console.log('iptables instructions in the header comment if you want to run it manually.');
  console.log('═══════════════════════════════════════════════════════════════');
}

export { chaosRequest };
