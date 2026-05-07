import http from 'k6/http';
import { sleep, check, group } from 'k6';
import { Rate } from 'k6/metrics';

const appErrors = new Rate('app_errors');       // non-2xx excluding expected 429s
const rateLimitedRate = new Rate('rate_limited'); // 429s — expected, just tracked

const BASE_URL = __ENV.BASE_URL || 'https://kickmap.sijar.tech';

const VENDORS = ['Nike', 'Adidas', 'New Balance', 'Puma', 'Reebok', 'Asics', 'Vans', 'Converse'];
const SIZES   = ['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'];
const REGIONS = ['MY', 'ID', 'SG'];

// Product codes discovered during warmup — shared across all product_browser VUs
let knownProductCodes = [];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function think(min, max) { sleep(Math.random() * (max - min) + min); }

// Each VU gets a unique fake IP so the app's per-IP rate limiter treats
// each virtual user as a separate client (as they would be in production).
function vuIp() {
  return `10.${Math.floor(__VU / 254)}.${(__VU % 254) + 1}.1`;
}

function get(url, params = {}) {
  const res = http.get(url, {
    ...params,
    headers: { 'X-Forwarded-For': vuIp(), ...(params.headers ?? {}) },
  });
  rateLimitedRate.add(res.status === 429);
  if (res.status === 429) {
    console.log(`429 from ${url}`);
  }
  // Track real application errors — exclude 429s (expected rate limit behavior)
  appErrors.add(res.status !== 200 && res.status !== 429);
  return res;
}

export const options = {
  scenarios: {
    warmup: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
      exec: 'warmup',
    },
    homepage_browser: {
      executor: 'constant-vus',
      vus: 18,
      duration: '5m',
      exec: 'homepageBrowser',
      startTime: '1m',
    },
    deal_hunter: {
      executor: 'constant-vus',
      vus: 13,
      duration: '5m',
      exec: 'dealHunter',
      startTime: '1m',
    },
    size_finder: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      exec: 'sizeFinder',
      startTime: '1m',
    },
    price_comparer: {
      executor: 'constant-vus',
      vus: 4,
      duration: '5m',
      exec: 'priceComparer',
      startTime: '1m',
    },
    product_browser: {
      executor: 'constant-vus',
      vus: 5,
      duration: '5m',
      exec: 'productBrowser',
      startTime: '1m',
    },
  },
  thresholds: {
    'http_req_duration{endpoint:heatmap}':  ['p(95)<150'],
    'http_req_duration{endpoint:products}': ['p(95)<200'],
    'http_req_duration{endpoint:deals}':    ['p(95)<200'],
    'http_req_duration{endpoint:exchange}':       ['p(95)<300'],
    'http_req_duration{endpoint:product-detail}': ['p(95)<200'],
    'http_req_failed': ['rate<0.02'],  // k6 built-in counts 429s — relaxed to 2%
    'app_errors':      ['rate<0.005'], // real errors only (non-2xx, non-429)
    'rate_limited':    ['rate<0.05'],  // 429s expected; alert only if >5%
  },
};

// ── Warm-up: populate Redis cache before main load hits ───────────────────────
export function warmup() {
  get(`${BASE_URL}/api/heatmap`);
  get(`${BASE_URL}/api/sizes`);
  get(`${BASE_URL}/api/exchange`);
  get(`${BASE_URL}/api/deals?sort=discount_desc&limit=20`);

  // Warm all 3 regional product caches
  for (const region of REGIONS) {
    get(`${BASE_URL}/api/products?region=${region}&inStock=true&limit=20`);
  }

  // Warm vendor and multiRegion caches; collect product codes for productBrowser
  const initial = get(`${BASE_URL}/api/products?limit=24`);
  if (initial.status === 200 && knownProductCodes.length === 0) {
    try {
      const body = JSON.parse(initial.body);
      knownProductCodes = (body.data ?? [])
        .map((p) => p.productCode)
        .filter(Boolean)
        .slice(0, 20);
    } catch (_) {}
  }

  get(`${BASE_URL}/api/products?multiRegion=true&limit=200`);
  sleep(1);
}

// ── Scenario 1: Homepage Browser (36%) ───────────────────────────────────────
// Mirrors: SSR heatmap + products + onSaleOnly → filter bar → map region click → slide panel
export function homepageBrowser() {
  group('homepage', () => {
    // Page load — SSR fires 3 parallel calls; we send them sequentially (k6 is single-threaded)
    const heatmap = get(`${BASE_URL}/api/heatmap`, { tags: { endpoint: 'heatmap' } });
    check(heatmap, { 'heatmap 200': (r) => r.status === 200 });

    get(`${BASE_URL}/api/products?limit=24`, { tags: { endpoint: 'products' } });

    // SSR also fetches onSaleOnly products for the deal banner
    get(`${BASE_URL}/api/products?onSaleOnly=true&limit=10`, { tags: { endpoint: 'products' } });

    think(2, 5); // user reads the map

    // User adjusts filter bar (300ms debounce in app, we just fire the result)
    const vendor = pick(VENDORS);
    const filtered = get(
      `${BASE_URL}/api/products?vendor=${encodeURIComponent(vendor)}&limit=500`,
      { tags: { endpoint: 'products' } },
    );
    check(filtered, { 'filter bar 200': (r) => r.status === 200 });

    think(1, 3); // user picks a region on the map

    // User clicks a region → slide panel fetches regional products
    const region = pick(REGIONS);
    const regional = get(
      `${BASE_URL}/api/products?region=${region}&inStock=true&limit=20`,
      { tags: { endpoint: 'products' } },
    );
    check(regional, { 'slide panel 200': (r) => r.status === 200 });

    think(3, 8); // user browses the slide panel
  });
}

// ── Scenario 2: Deal Hunter (26%) ────────────────────────────────────────────
// Mirrors: DealsClient initial load → "Load More" button → region filter
export function dealHunter() {
  group('deals', () => {
    const deals = get(
      `${BASE_URL}/api/deals?sort=discount_desc&limit=20`,
      { tags: { endpoint: 'deals' } },
    );
    check(deals, { 'deals 200': (r) => r.status === 200 });

    think(3, 7); // user reads the deals list

    // User clicks "Load More"
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
          think(2, 5);
        }
      } catch (_) {}
    }

    // User filters by a specific region
    const region = pick(REGIONS);
    const regionDeals = get(
      `${BASE_URL}/api/deals?sort=discount_desc&limit=20&region=${region}`,
      { tags: { endpoint: 'deals' } },
    );
    check(regionDeals, { 'region deals 200': (r) => r.status === 200 });

    think(2, 4);
  });
}

// ── Scenario 3: Size Finder (20%) ────────────────────────────────────────────
// Mirrors: sizes fetch → size chip selection → products grid → IntersectionObserver scroll
export function sizeFinder() {
  group('size-finder', () => {
    const sizes = get(`${BASE_URL}/api/sizes`, { tags: { endpoint: 'sizes' } });
    check(sizes, { 'sizes 200': (r) => r.status === 200 });

    think(1, 3); // user picks a size chip

    const size = pick(SIZES);
    const products = get(
      `${BASE_URL}/api/products?size=${size}&inStock=true&limit=24`,
      { tags: { endpoint: 'products' } },
    );
    check(products, { 'size products 200': (r) => r.status === 200 });

    think(3, 6); // user scrolls through results

    // IntersectionObserver fires → load next page
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
          think(2, 4);
        }
      } catch (_) {}
    }
  });
}

// ── Scenario 4: Price Comparer (8%) ──────────────────────────────────────────
// Mirrors: CompareClient full load → search submit → currency toggle
export function priceComparer() {
  group('compare', () => {
    const compare = get(
      `${BASE_URL}/api/products?multiRegion=true&limit=200`,
      { tags: { endpoint: 'products' } },
    );
    check(compare, { 'compare 200': (r) => r.status === 200 });

    think(2, 4); // user reads the table

    // User submits a search (form submit — not debounced, fires once)
    const q = pick(VENDORS).toLowerCase();
    const searched = get(
      `${BASE_URL}/api/products?multiRegion=true&q=${encodeURIComponent(q)}&limit=10000`,
      { tags: { endpoint: 'products' } },
    );
    check(searched, { 'compare search 200': (r) => r.status === 200 });

    think(1, 2);

    // User toggles currency → exchange rates fetched
    const exchange = get(`${BASE_URL}/api/exchange`, { tags: { endpoint: 'exchange' } });
    check(exchange, { 'exchange 200': (r) => r.status === 200 });

    think(3, 6);
  });
}

// ── Scenario 5: Product Browser (10%) ────────────────────────────────────────
// Mirrors: user clicks a product card → product detail page (SSR)
export function productBrowser() {
  group('product-detail', () => {
    // Discover a product code if we don't have any yet
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

    think(3, 8); // user reads the product page
  });
}
