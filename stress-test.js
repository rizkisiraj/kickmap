import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const appErrors    = new Rate('app_errors');
const rateLimited  = new Rate('rate_limited');
const cacheMisses  = new Rate('cache_miss');   // X-Cache-Status: MISS headers

const BASE_URL = __ENV.BASE_URL || 'https://kickmap.sijar.tech';

const VENDORS = ['Nike', 'Adidas', 'New Balance', 'Puma', 'Reebok', 'Asics', 'Vans', 'Converse'];
const SIZES   = ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'];
const REGIONS = ['MY', 'ID', 'SG'];

let knownProductCodes = [];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function think(min, max) { sleep(Math.random() * (max - min) + min); }
function vuIp() {
  return `10.${Math.floor(__VU / 254)}.${(__VU % 254) + 1}.1`;
}

function get(url, params = {}) {
  const res = http.get(url, {
    ...params,
    headers: { 'X-Forwarded-For': vuIp(), ...(params.headers ?? {}) },
    timeout: '30s',
  });
  rateLimited.add(res.status === 429);
  appErrors.add(res.status !== 200 && res.status !== 429);
  cacheMisses.add(res.headers['X-Cache-Status'] === 'MISS');
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stress test shape:
//
//   0m–1m   Warmup        (5 VUs)   — populate Redis cache
//   1m–3m   Ramp up       (5→100 VUs) — find stable throughput ceiling
//   3m–6m   Sustained     (100 VUs) — hold peak, watch for degradation
//   6m–7m   Spike         (100→200 VUs) — sudden traffic burst
//   7m–8m   Recovery      (200→20 VUs) — verify system recovers
//   8m–9m   Cold cache    (20 VUs)  — /revalidate then continue, measure recovery
// ─────────────────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    warmup: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      exec: 'warmup',
      tags: { phase: 'warmup' },
    },
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '2m', target: 100 },
      ],
      exec: 'mainLoad',
      startTime: '1m',
      tags: { phase: 'ramp' },
    },
    sustained: {
      executor: 'constant-vus',
      vus: 100,
      duration: '3m',
      exec: 'mainLoad',
      startTime: '3m',
      tags: { phase: 'sustained' },
    },
    spike: {
      executor: 'ramping-vus',
      startVUs: 100,
      stages: [
        { duration: '30s', target: 200 }, // sudden spike
        { duration: '30s', target: 200 }, // hold spike
      ],
      exec: 'mainLoad',
      startTime: '6m',
      tags: { phase: 'spike' },
    },
    recovery: {
      executor: 'ramping-vus',
      startVUs: 200,
      stages: [
        { duration: '1m', target: 20 },
      ],
      exec: 'mainLoad',
      startTime: '7m',
      tags: { phase: 'recovery' },
    },
    cold_cache: {
      executor: 'constant-vus',
      vus: 20,
      duration: '1m',
      exec: 'coldCacheLoad',
      startTime: '8m',
      tags: { phase: 'cold_cache' },
    },
  },

  thresholds: {
    // During ramp + sustained: same targets as load test
    'http_req_duration{phase:ramp}':      ['p(95)<500'],
    'http_req_duration{phase:sustained}': ['p(95)<500'],

    // Spike: relaxed — we expect degradation, just no total collapse
    'http_req_duration{phase:spike}':     ['p(95)<5000'],

    // Recovery: should return to normal within the window
    'http_req_duration{phase:recovery}':  ['p(95)<1000'],

    // Cold cache: measures how long it takes to warm up under live traffic
    'http_req_duration{phase:cold_cache}': ['p(95)<3000'],

    // Per-endpoint during sustained peak (core SLA)
    'http_req_duration{endpoint:heatmap,phase:sustained}':        ['p(95)<200'],
    'http_req_duration{endpoint:products,phase:sustained}':       ['p(95)<500'],
    'http_req_duration{endpoint:deals,phase:sustained}':          ['p(95)<500'],
    'http_req_duration{endpoint:product-detail,phase:sustained}': ['p(95)<300'],
    'http_req_duration{endpoint:exchange,phase:sustained}':       ['p(95)<300'],

    // Error budgets
    'app_errors':   ['rate<0.01'],  // <1% real errors across entire test
    'rate_limited': ['rate<0.10'],  // 429s spike is expected, alert only >10%
  },
};

// ── Warmup: populate all Redis cache keys ─────────────────────────────────────
export function warmup() {
  get(`${BASE_URL}/api/heatmap`);
  get(`${BASE_URL}/api/sizes`);
  get(`${BASE_URL}/api/exchange`);
  get(`${BASE_URL}/api/deals?sort=discount_desc&limit=20`);

  for (const region of REGIONS) {
    get(`${BASE_URL}/api/products?region=${region}&inStock=true&limit=20`);
  }

  const initial = get(`${BASE_URL}/api/products?limit=24`);
  if (initial.status === 200 && knownProductCodes.length === 0) {
    try {
      const body = JSON.parse(initial.body);
      knownProductCodes = (body.data ?? [])
        .map((p) => p.productCode)
        .filter(Boolean)
        .slice(0, 30);
    } catch (_) {}
  }

  get(`${BASE_URL}/api/products?multiRegion=true&limit=200`);
  sleep(2);
}

// ── Main load: realistic mix of all 5 user journeys ──────────────────────────
// Weighted by VU index to simulate realistic traffic split:
//   0-35%  → homepage browser
//   36-61% → deal hunter
//   62-81% → size finder
//   82-91% → price comparer
//   92-99% → product browser
export function mainLoad() {
  const roll = (__VU % 100);

  if (roll < 36)       homepageBrowser();
  else if (roll < 62)  dealHunter();
  else if (roll < 82)  sizeFinder();
  else if (roll < 92)  priceComparer();
  else                 productBrowser();
}

// ── Cold cache scenario: bust cache then measure recovery ────────────────────
export function coldCacheLoad() {
  // Only VU 1 calls revalidate at the start to simulate post-scrape cache bust
  if (__VU === 1 && __ITER === 0) {
    http.post(`${BASE_URL}/api/revalidate`, null, {
      headers: {
        'X-Forwarded-For': vuIp(),
        'Authorization': `Bearer ${__ENV.SCRAPER_SECRET ?? ''}`,
      },
    });
    console.log('Cache busted — measuring cold cache recovery');
  }

  sleep(0.5); // slight stagger so bust lands before others hit
  mainLoad();
}

// ── Journeys (same as load-test.js but with tighter think times to stress more)

function homepageBrowser() {
  group('homepage', () => {
    const heatmap = get(`${BASE_URL}/api/heatmap`, { tags: { endpoint: 'heatmap' } });
    check(heatmap, { 'heatmap 200': (r) => r.status === 200 });

    get(`${BASE_URL}/api/products?limit=24`, { tags: { endpoint: 'products' } });
    get(`${BASE_URL}/api/products?onSaleOnly=true&limit=10`, { tags: { endpoint: 'products' } });

    think(1, 3); // shorter think time than load test — more pressure

    const vendor = pick(VENDORS);
    const filtered = get(
      `${BASE_URL}/api/products?vendor=${encodeURIComponent(vendor)}&limit=500`,
      { tags: { endpoint: 'products' } },
    );
    check(filtered, { 'filter bar 200': (r) => r.status === 200 });

    think(0.5, 2);

    const region = pick(REGIONS);
    const regional = get(
      `${BASE_URL}/api/products?region=${region}&inStock=true&limit=20`,
      { tags: { endpoint: 'products' } },
    );
    check(regional, { 'slide panel 200': (r) => r.status === 200 });

    think(1, 4);
  });
}

function dealHunter() {
  group('deals', () => {
    const deals = get(
      `${BASE_URL}/api/deals?sort=discount_desc&limit=20`,
      { tags: { endpoint: 'deals' } },
    );
    check(deals, { 'deals 200': (r) => r.status === 200 });

    think(2, 5);

    if (deals.status === 200) {
      try {
        const body = JSON.parse(deals.body);
        const cursor = body?.meta?.nextCursor;
        if (cursor) {
          const more = get(
            `${BASE_URL}/api/deals?sort=discount_desc&limit=20&cursor=${encodeURIComponent(cursor)}`,
            { tags: { endpoint: 'deals' } },
          );
          check(more, { 'load more 200': (r) => r.status === 200 });
          think(1, 3);
        }
      } catch (_) {}
    }

    const region = pick(REGIONS);
    const regionDeals = get(
      `${BASE_URL}/api/deals?sort=discount_desc&limit=20&region=${region}`,
      { tags: { endpoint: 'deals' } },
    );
    check(regionDeals, { 'region deals 200': (r) => r.status === 200 });

    think(1, 3);
  });
}

function sizeFinder() {
  group('size-finder', () => {
    const sizes = get(`${BASE_URL}/api/sizes`, { tags: { endpoint: 'sizes' } });
    check(sizes, { 'sizes 200': (r) => r.status === 200 });

    think(0.5, 2);

    const size = pick(SIZES);
    const products = get(
      `${BASE_URL}/api/products?size=${size}&inStock=true&limit=24`,
      { tags: { endpoint: 'products' } },
    );
    check(products, { 'size products 200': (r) => r.status === 200 });

    think(2, 5);

    if (products.status === 200) {
      try {
        const body = JSON.parse(products.body);
        const cursor = body?.meta?.nextCursor;
        if (cursor) {
          const more = get(
            `${BASE_URL}/api/products?size=${size}&inStock=true&cursor=${encodeURIComponent(cursor)}&limit=24`,
            { tags: { endpoint: 'products' } },
          );
          check(more, { 'size scroll 200': (r) => r.status === 200 });
          think(1, 3);
        }
      } catch (_) {}
    }
  });
}

function priceComparer() {
  group('compare', () => {
    const compare = get(
      `${BASE_URL}/api/products?multiRegion=true&limit=200`,
      { tags: { endpoint: 'products' } },
    );
    check(compare, { 'compare 200': (r) => r.status === 200 });

    think(1, 3);

    const q = pick(VENDORS).toLowerCase();
    const searched = get(
      `${BASE_URL}/api/products?multiRegion=true&q=${encodeURIComponent(q)}&limit=10000`,
      { tags: { endpoint: 'products' } },
    );
    check(searched, { 'compare search 200': (r) => r.status === 200 });

    think(0.5, 1);

    const exchange = get(`${BASE_URL}/api/exchange`, { tags: { endpoint: 'exchange' } });
    check(exchange, { 'exchange 200': (r) => r.status === 200 });

    think(1, 3);
  });
}

function productBrowser() {
  group('product-detail', () => {
    if (knownProductCodes.length === 0) {
      const res = get(`${BASE_URL}/api/products?limit=10`, { tags: { endpoint: 'products' } });
      if (res.status === 200) {
        try {
          const body = JSON.parse(res.body);
          knownProductCodes = (body.data ?? []).map((p) => p.productCode).filter(Boolean);
        } catch (_) {}
      }
    }

    if (knownProductCodes.length > 0) {
      const code = pick(knownProductCodes);
      const detail = get(
        `${BASE_URL}/api/products/${encodeURIComponent(code)}`,
        { tags: { endpoint: 'product-detail' } },
      );
      check(detail, { 'product detail 200': (r) => r.status === 200 });
    }

    think(2, 5);
  });
}
