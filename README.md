# KickMap

Live sneaker availability and pricing across JD Sports Malaysia, Indonesia, and Singapore — visualised on an interactive heatmap.

## What it does

- **Heatmap** — choropleth map of MY / ID / SG coloured by stock level (high / medium / low / none). Click a region to browse its in-stock products in a slide panel.
- **Deals** — on-sale products ranked by discount percentage with before/after pricing.
- **Compare** — side-by-side price table across all three regions; cheapest cell highlighted.
- **Size Finder** — pick a UK size and see every style available in it, across all regions.
- **Brand pages** — full catalogue per brand with regional availability.
- **Product detail** — per-region price, size grid, and stock status for a single product.

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Map | react-leaflet + GeoJSON choropleth |
| Database | MongoDB Atlas (read-only consumer) |
| Cache | Redis (ioredis) — 6 h TTL on all product queries |
| Data source | JD Sports scraper (separate repo) |

## Architecture

```
Browser
  ↓ page request
Next.js Server Component
  ↓ cache miss only
Redis → MongoDB Atlas

Browser (interactive)
  ↓ SWR / fetch
Next.js API routes (/api/...)
  ↓
Redis → MongoDB Atlas
```

The app is a **read-only consumer** of the MongoDB database populated by the scraper. It never writes to it.

## Local development

**Prerequisites:** Node 20+, a running Redis instance, access to the MongoDB Atlas cluster.

```bash
# 1. Install dependencies
npm install

# 2. Copy and fill in env vars
cp .env.example .env.local

# 3. Start Redis (if not already running)
redis-server
# or
docker run -p 6379:6379 redis:7-alpine

# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `REDIS_URL` | ✅ | Redis connection URL |
| `SCRAPER_SECRET` | ✅ | Shared secret for the `/api/revalidate` webhook |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public URL of the app (baked into client bundle) |
| `RATE_LIMIT_WINDOW_MS` | — | Rate limit window in ms (default 60000) |
| `RATE_LIMIT_MAX_REQUESTS` | — | Max requests per window (default 100) |
| `EXCHANGE_API_BASE_URL` | — | Exchange rate API base (default open.er-api.com) |

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build
npm run start    # start production server
npm run lint     # ESLint + type check
```

## Deployment

The app is configured with `output: 'standalone'` for minimal Docker images. Build and run with the provided `Dockerfile` and `docker-compose.yml` (kept out of version control — generate them locally).

```bash
# Build image (set your public URL at build time)
docker compose build --build-arg NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Run app + Redis
docker compose up -d
```

`REDIS_URL` is automatically pointed at the Redis container by docker-compose. MongoDB stays on Atlas.

## Project structure

```
src/
├── app/                        # Pages and API routes
│   ├── page.tsx                # / — heatmap
│   ├── deals/                  # /deals
│   ├── compare/                # /compare
│   ├── size-finder/            # /size-finder
│   ├── brand/[vendor]/         # /brand/nike
│   ├── product/[productCode]/  # /product/398846-01
│   └── api/                    # Route handlers
├── components/                 # Shared UI components
│   └── RegionMap/              # Leaflet map (client-only)
├── db/                         # Mongoose models + connection
├── lib/                        # Redis, cache helper, formatting
├── repositories/               # Raw DB queries
├── services/                   # Business logic over repositories
├── types/                      # Shared TypeScript types
└── env.ts                      # Zod-validated env vars
```
