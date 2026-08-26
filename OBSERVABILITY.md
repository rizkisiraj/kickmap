# KickMap Observability Cheatsheet

Stack: `pino` (JSON to stdout) → Docker `loki` log driver (`mode: non-blocking`) → Loki `:3100` → Grafana (`grafana.json`, 12-panel dashboard).

Loki's **complete** label set — nothing else exists as a label:
`container`, `environment`, `log_level`, `module`.
Everything else (`duration`, `status`, `testRun`, `poolInUse`, `poolSize`, `rss`, `heapUsed`,
`eventLoopLag_mean`, `msg`, `resultCount`, `searchPath`, `key`, `hit`, …) is a **JSON field** —
pipe through `| json` before filtering/unwrapping on it. Nested objects flatten with
underscores: `eventLoopLag: {mean, max, resolution}` becomes `eventLoopLag_mean`,
`eventLoopLag_max`, `eventLoopLag_resolution`.

Module namespaces: `api:products` `api:deals` `api:heatmap` `api:exchange` `api:sizes`
`api:product-detail` `api:health` `api:revalidate` · `repo:product` `repo:deals` `repo:heatmap`
· `cache` `redis` `mongodb` `instrumentation` `process`

> ⚠️ **Never use `$__rate_interval` in a Loki query.** It's a Prometheus template variable —
> Grafana does not interpolate it for a Loki datasource, so it reaches Loki as the literal
> string `$__rate_interval` and every query in the panel fails with `not a valid duration
> string`. Every query in this doc and in `grafana.json` uses `$__interval`. If you're adding a
> panel and autocomplete offers `$__rate_interval`, don't take it.

---

## Step 0 — Which layer is broken?

Run these three, in order. The first one that looks wrong tells you the layer.

```bash
# 1. Is the app even up, and which dependency is down?
curl -s https://kickmap.sijar.tech/api/health | jq
# → {"status":"ok"|"degraded"|"down", "services":{"mongodb":..,"redis":..}, "uptime":N}
```

| Result | Meaning |
|---|---|
| `curl` hangs / 502 / 504 | **nginx or Node** — app is dead, wedged, or >30s (`proxy_read_timeout 30s`) |
| `429` | **nginx** `limit_req` (3000r/m) or **app** `rateLimit()` — two different limiters, see §5 |
| `"status":"down"` (503) | **Both** Mongo and Redis unreachable → network/DNS/container problem, not app logic |
| `"status":"degraded"` | Exactly one dependency down — the JSON says which |
| `"status":"ok"` but slow | **Query, cache, pool, or Node** — go to §2/§3/§4/§6 |
| `uptime` small / resets | **Node restarted** — OOM kill or crash. Check `docker inspect kickmap --format '{{.State.OOMKilled}}'` |

```bash
# 2. Is the container healthy?
docker stats kickmap --no-stream        # RSS climbing toward the limit = leak/OOM
docker inspect kickmap --format '{{.RestartCount}} {{.State.OOMKilled}}'
```

```bash
# 3. NOTE: `docker logs kickmap` returns NOTHING — the loki log driver ships stdout
#    straight to Loki instead of the local json-file driver. If Loki is down you are
#    blind (this is true even with mode: non-blocking — requests still succeed, but
#    the buffered lines have nowhere to go once the 4m ring buffer fills). Fallback:
docker compose -f docker-compose.yml exec loki wget -qO- localhost:3100/ready
```

### If NO logs are reaching Loki at all

Check `loki-url` in `docker-compose.yml` first — it must be a **host-reachable** address:

```yaml
loki-url: "http://127.0.0.1:3100/loki/api/v1/push"   # correct
loki-url: "http://loki:3100/loki/api/v1/push"        # WRONG — silently ships nothing
```

The `loki` log driver is a **Docker plugin running in the Docker daemon on the host**, not a
process inside the compose network. It has no access to Docker's embedded DNS, so the compose
service name `loki` does not resolve for it. It can only reach Loki through the port the `loki`
service publishes (`3100:3100`). Using the service name looks correct, passes `docker compose
config`, starts cleanly — and drops every log line. Do not "fix" `127.0.0.1` to `loki`.

Same reason `depends_on: loki` can't help the log driver: the dependency is daemon-side, not
container-side. After a full `docker compose down`, if the app container fails to start with a
logging-driver error, bring Loki up first (`docker compose up -d loki`, then the rest).
`mode: non-blocking` + `loki-retries: "2"` make this tolerable rather than fatal.

---

## §1 — Errors and the overall shape

```logql
# Every error, newest first
{container="kickmap"} | json | log_level="error"

# Error rate over time, by module
sum by (module) (rate({container="kickmap", log_level="error"} [$__interval]))

# Warnings — slow queries, degraded health, rate limits, lock timeouts all live here
{container="kickmap"} | json | log_level="warn"

# Now that status is logged on every response path, 4xx/5xx are queryable
# directly instead of inferring them from level:
{container="kickmap"} | json | status >= 400

# Breakdown by status code
sum by (status) (count_over_time({container="kickmap"} | json | status >= 400 [$__interval]))
```

> **This used to be a gap — it's fixed.** Every API route (`products`, `deals`, `heatmap`,
> `exchange`, `sizes`, `product/[productCode]`) now logs `status` on every response path,
> including 400/429/404/503, not just thrown 500s. Panel 2 ("Error Rate") still only tracks
> `log_level="error"` (i.e. 500s) — use the `status >= 400` query above for the full 4xx+5xx
> picture, that's what "Recent Errors" (panel 8) does NOT cover.
>
> **One asymmetry to know about:** `product/[productCode]/route.ts` logs its 404 branch at
> `log.debug` (not found is expected, not exceptional), so a 404 will NOT show up in Loki at
> all under `LOG_LEVEL=info` or `warn` — only its 400/429/500 siblings do. If you need 404
> visibility, temporarily run `LOG_LEVEL=debug`.

---

## §2 — Is it a QUERY problem? (best-instrumented layer)

Repos log `duration` on every query; `>100ms` escalates to `warn` so it survives prod log level.

```logql
# All slow queries
{container="kickmap"} | json | log_level="warn" | msg=~"Slow.*query"

# Slow queries by module (this is Panel 7 — NOT scoped by $test_run, see below)
sum by (module) (rate({container="kickmap", module=~"repo:.*"} | json | duration > 100 [$__interval]))

# Which search path is slow? (repo:product tags searchPath)
{container="kickmap"} | json | module="repo:product" | msg="Slow product query"
```

**Signature of a query problem:** `repo:*` duration ≈ `api:*` duration (the repo *is* the
latency), `resultCount` is large, and it correlates with a specific `searchPath` or filter set.

**Fix direction:** missing index on `JDRegionStock`, or the `$lookup` in
`deals.repository.ts` unwinding too many docs.

**`$test_run` does not scope this panel.** Repository logs are triggered by a request but
never receive the `testRun` field — nothing threads the `X-Test-Run` header down past the
route handler into `product.repository.ts` / `deals.repository.ts` / `heatmap.repository.ts`
(that would need request-context plumbing, e.g. `AsyncLocalStorage`, which doesn't exist).
To correlate a load test's slow queries, narrow the **time range** to the run instead of
setting the dashboard variable.

---

## §3 — Is it a CACHE / REDIS problem?

⚠️ **STILL BROKEN IN PRODUCTION TODAY — this has not changed.** All hit/miss/stale/lock lines
in `src/lib/cache.ts` are `log.debug` (`getKeyPattern` hit/miss at lines 31 and 55), and prod
runs `LOG_LEVEL=info`. These queries return nothing until you either set `LOG_LEVEL=debug` or
promote those lines to `info`.

```logql
# Cache hit ratio (needs LOG_LEVEL=debug)
sum(count_over_time({container="kickmap"} | json | module="cache" | hit=true [$__interval]))
/ sum(count_over_time({container="kickmap"} | json | module="cache" [$__interval]))

# These DO work at info level — they are error/warn:
{container="kickmap"} | json | module="cache" | log_level=~"warn|error"
#   "Redis cache read error"        → Redis unreachable, falling through to Mongo
#   "Redis lock acquisition error"  → same
#   "Lock timeout — fetching ourselves" → stampede; N processes all hitting Mongo
#   "Cache revalidation failed"     → the underlying fetchFn threw

# Redis connection lifecycle (always visible — info/warn/error)
{container="kickmap"} | json | module="redis"
```

**Because hit/miss is invisible at `info`, Panel 5 ("Cache Health") is a duration-bucket
proxy, not a real hit-ratio panel.** It buckets `api:*` request `duration` into `<10ms`,
`10–50ms`, and `>=50ms` and treats the `<10ms` bucket as a proxy for cache hits (Redis-served)
and the `>=50ms` bucket as a proxy for misses (Mongo round-trip). It exists specifically
*because* the real hit/miss signal is suppressed at prod log level — if you promote
`cache.ts`'s debug lines to `info`, replace Panel 5 with the real ratio query above instead
of trusting the duration proxy.

**Signature of a cache problem:** `api:*` duration spikes but `repo:*` duration is normal
→ time is being spent in Redis, not Mongo. Note `commandTimeout: 3000` (`redis.ts`), so a
hung Redis shows up as ~3s + a "Redis cache read error".

**Signature of a stampede:** burst of "Lock timeout" warns + simultaneous `repo:*` spike,
typically right after `/api/revalidate` runs.

**Known landmine — still unfixed:** `revalidate/route.ts` uses `redis.keys('products:*')`.
`KEYS` is O(N) and blocks Redis single-threaded. Every scrape completion briefly freezes
Redis for all requests. Replace with `SCAN`.

---

## §4 — Is it a CONNECTION POOL problem?

✅ **Fixed — directly observable now**, no more inference. `src/db/connection.ts` attaches
CMAP listeners after `mongoose.connect()`; `src/lib/pool-stats.ts` maintains the gauges;
`src/instrumentation.ts`'s 10s process tick logs them under `module="process"`.

```logql
# Pool gauges over time (Panel 11 — "Mongo Pool")
max_over_time({container="kickmap", module="process"} | json | unwrap poolInUse [$__interval])
max_over_time({container="kickmap", module="process"} | json | unwrap poolSize [$__interval])

# Pool checkout failures (hard failure — pool exhausted, not just busy)
{container="kickmap"} | json | log_level="error" | msg="Pool checkout failed"

# Pool cleared (rare — teardown/reset event)
{container="kickmap"} | json | msg="Mongo pool cleared"
```

**Read `poolInUse` vs `poolSize` correctly — this is the nuance that will make you
misdiagnose a healthy system as broken if you skip it:**

`poolSize` is `MAX_POOL_SIZE = 50`, but that's a **per-host ceiling**, not a cluster-wide cap.
The Mongo driver keeps a separate connection pool per replica-set member (Atlas is a replica
set — one pool per data-bearing node, plus monitor connections). `poolInUse` in these logs
aggregates in-use connections **across all of those pools**. So `poolInUse: 60` next to
`poolSize: 50` is not a bug — it means multiple hosts each have connections checked out, and
their sum legitimately exceeds any single host's ceiling. The signal to actually watch for
saturation is `poolInUse` approaching `3 × poolSize` (roughly — depends on replica set size),
or a rising trend with no plateau, combined with `api:*` duration climbing while `repo:*`
stays flat (time spent waiting for a connection, not running the query).

| Observed | Likely cause |
|---|---|
| `api:*` duration high, `repo:*` duration **normal**, Redis fine, `poolInUse` near its ceiling | **Pool exhaustion** — time spent waiting for a checkout before the query even starts |
| `"Pool checkout failed"` errors | Pool genuinely exhausted — the driver gave up waiting |
| `"Mongo pool cleared"` | Pool torn down (network blip, failover) — `poolInUse` gauge resets to 0 by design, don't read a sudden drop to 0 here as "load disappeared" |
| Fast 500s + error mentioning "Client must be connected" / "buffering" | **Pool dead**, not saturated. `bufferCommands: false` (`connection.ts`) makes this fail instantly instead of queuing |
| `module="mongodb"` "MongoDB disconnected" / "connection error" | Network or Atlas-side problem |

```logql
{container="kickmap"} | json | module="mongodb"
# "Initializing MongoDB connection..." appearing repeatedly = reconnect loop or
#   the module-level cache is being rebuilt (new process / hot reload)
```

Cross-check server-side:
```bash
# In mongosh against the Atlas cluster
db.serverStatus().connections   # { current, available, totalCreated }
db.currentOp({ "secs_running": { $gt: 1 } })   # long-running ops
```

**`$test_run` does not scope Panel 11.** The process tick is periodic telemetry (every 10s,
independent of any request), so it never carries a `testRun` field. Correlate to a load-test
run by time range.

---

## §5 — Is it an NGINX / edge problem?

⚠️ **STILL NOT IN LOKI — unchanged.** nginx runs on the host and logs to `/var/log/nginx/`.
Nothing from `nginx-config.md` reaches Grafana. Check it on the box directly:

```bash
sudo tail -f /var/log/nginx/error.log
#   "upstream timed out"        → app took >30s (proxy_read_timeout)
#   "connect() failed"          → container down; nginx→127.0.0.1:3002 refused
#   "limiting requests, excess" → nginx limit_req kicked in (3000r/m, burst 500)
#   "limiting connections"      → limit_conn 200 hit

sudo tail -f /var/log/nginx/access.log | grep -E ' (429|499|502|504) '
```

**Two different 429s — do not confuse them:**

| Source | Limit | Visible where |
|---|---|---|
| nginx `limit_req` | 3000 req/min/IP, burst 500 (`api_limit`/`page_limit` zones) | `/var/log/nginx/error.log` only |
| app `rateLimit()` | per-route, hardcoded (see below) | Loki: `msg="Rate limited"` |

Current hardcoded per-route limits (`RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` in
`src/env.ts` are **declared but unused** — every route ignores them and hardcodes its own):

| Route | Limit | Window |
|---|---|---|
| `/api/products` | 100 | 60s |
| `/api/products/[productCode]` | 100 | 60s |
| `/api/deals` | 60 | 60s |
| `/api/heatmap` | 60 | 60s |
| `/api/exchange` | 30 | 60s |
| `/api/sizes` | — no rate limit at all | — |

The app limits are stricter than nginx's shared bucket, so in practice the app fires first
for a normal client:

```logql
{container="kickmap"} | json | msg="Rate limited"
sum by (ip) (count_over_time({container="kickmap"} | json | msg="Rate limited" [15m]))
```

Note `rate-limit.ts`'s `rateLimit()` **fails open** — if Redis is down (pipeline throws), the
`catch` returns `{ success: true }` and rate limiting silently stops.

**Deploy-order hazard for Tier B load tests:** `nginx-config.md` is documentation only — it
is **not applied to the live server**. The geo allowlist (`$is_loadtest`) and the
`X-Load-Test` header passthrough only exist once someone manually copies that config onto the
box and reloads nginx. Until that happens, a Tier B run from the "allowlisted" generator VPS
is not actually allowlisted — it hits nginx's `limit_req`/`limit_conn 200` like any other
client, and the run measures nginx, not the app. Confirm the config is live (`nginx -T | grep
is_loadtest` on the box) before trusting a Tier B number.

---

## §6 — Is it a NODE problem?

✅ **Fixed — process telemetry now exists.** `src/instrumentation.ts` runs a 10s tick
(`.unref()`'d, `module="process"`, `NEXT_RUNTIME==='nodejs'` guarded) logging `rss`,
`heapUsed`, `heapTotal`, and event-loop lag via `perf_hooks.monitorEventLoopDelay()`.

```logql
# Panel 12 — "Node Process"
max_over_time({container="kickmap", module="process"} | json | unwrap rss [$__interval])
max_over_time({container="kickmap", module="process"} | json | unwrap heapUsed [$__interval])
max_over_time({container="kickmap", module="process"} | json | unwrap eventLoopLag_mean [$__interval])

# Raw tick lines (also carries eventLoopLag_max, eventLoopLag_resolution, poolInUse, poolSize)
{container="kickmap", module="process"} | json
```

**Read `eventLoopLag_mean` correctly — this is the nuance that will cause a false alarm if
you skip it.** The histogram is created with `monitorEventLoopDelay({ resolution: 20 })`.
`resolution` is the sampling interval the histogram itself uses to probe the event loop, and
at idle the reported mean converges to *approximately that resolution* — **not to 0**. So
`eventLoopLag_mean ≈ 20ms` at idle is healthy, expected, and not evidence of lag. The
`eventLoopLag_resolution` field (always `20`) is logged alongside mean/max specifically so
you can eyeball the delta instead of misreading the absolute number. The real signal is
**mean or max rising meaningfully above 20ms** — that's actual event-loop blocking (sync
work, GC pressure, a blocking Mongo/Redis call that snuck onto the main thread).

```bash
docker stats kickmap --no-stream                                  # RSS / CPU, cross-check
curl -s .../api/health | jq .uptime                               # reset = restart
docker inspect kickmap --format '{{.RestartCount}} {{.State.OOMKilled}}'
```

**Signature of a Node problem:** *all* modules slow simultaneously, `duration` inflated
everywhere including trivial endpoints like `api:exchange` (which is pure Redis), while Mongo
and Redis are individually healthy, AND `eventLoopLag_mean`/`_max` sitting well above 20ms.
That combination is event-loop blocking or GC pressure — without the lag numbers it's
indistinguishable from a generic slowdown.

**`$test_run` does not scope Panel 12**, same reason as Panel 11 — periodic telemetry, no
`testRun` field. Use the time range.

---

## Fast triage decision tree

```
Site is broken
├─ curl /api/health hangs or 502/504
│   ├─ container not running? ......... docker ps / RestartCount / OOMKilled → NODE
│   └─ container up but no response ... check eventLoopLag_mean/_max (§6) → NODE
├─ /api/health says degraded/down ..... the JSON names the dep → REDIS or MONGO
└─ /api/health ok, but slow
    ├─ repo:* duration high ........... QUERY (§2)   — index / aggregation
    ├─ repo:* normal, api:* high
    │   ├─ cache warn/error present ... REDIS (§3)
    │   ├─ poolInUse near ceiling or
    │   │  "Pool checkout failed" ..... POOL (§4)
    │   └─ neither ..................... check eventLoopLag (§6) — NODE, or unlogged
    ├─ eventLoopLag elevated everywhere NODE (§6)
    └─ users see 429 .................. which one? see §5 — nginx vs app limiter
```

---

## What survives `LOG_LEVEL=warn`

Load-test runs (see "Running a load test" below) typically run at `warn` to cut per-request
volume. What you keep vs. lose:

| Signal | Survives `warn`? | Why |
|---|---|---|
| Errors (`log_level="error"`) | ✅ | Always above the threshold |
| Slow-query warnings (§2) | ✅ | Logged at `warn` specifically so they survive prod levels |
| Rate-limit warnings (§5) | ✅ | Logged at `warn` |
| Cache lock-timeout warnings (§3) | ✅ | Logged at `warn` |
| Pool checkout failures / pool cleared (§4) | ✅ | Logged at `error` |
| **Process tick — `rss`/`heapUsed`/`eventLoopLag`/`poolInUse`/`poolSize`** (§4, §6) | ✅ | `createTelemetryLogger` (`src/lib/logger.ts`) pins this child logger to `level: 'info'` **regardless of the global `LOG_LEVEL`** — that pino child-level override is what makes it survive `warn` |
| Per-request `info` completion lines (route `status`/`duration`) | ❌ | This is the volume `warn` is dropping — the whole point |
| Cache hit/miss (§3) | ❌ (already lost at `info` too) | Logged at `debug`, unrelated to this switch |
| `product/[productCode]` 404s | ❌ | Logged at `debug`, unrelated to this switch |

---

## Running a load test

Three scripts, two tiers, correlated back into Grafana via `X-Test-Run`.

**Scripts:**
- `load-test.js` — closed-model (`ramping-vus`/`constant-vus` + `think()`), five weighted
  user journeys. Answers "can ~50 concurrent real users have a good experience?" Does **not**
  measure capacity — a closed-model executor backs off automatically when the server slows
  (coordinated omission), so a calm p95 here just means the load generator throttled itself.
- `stress-test.js` — also closed-model; cold-cache/recovery only (the old 500/1000-VU phases
  are gone, see below).
- `capacity-test.js` — **open-model** (`ramping-arrival-rate` / `constant-arrival-rate`).
  This is the one that answers "what's the ceiling?" because it holds the offered request
  rate constant regardless of how slow responses get, instead of waiting for each iteration
  to finish before starting the next.

**Why closed-model can't measure capacity and open-model can:** in a closed model (VUs with
`think()` sleeps), the number of in-flight requests is self-limiting — if the server slows
down, each VU simply takes longer to loop back around, so the *offered* load drops exactly
when you'd want to see it climb. This is coordinated omission: the load generator quietly
protects itself and the resulting p95/p99 look deceptively healthy right up to the point of
collapse. `capacity-test.js`'s arrival-rate executors start iterations at a fixed rate no
matter what — when the app falls behind, k6 either queues against `maxVUs` or drops the
iteration outright, and **`dropped_iterations` is the primary output metric**. It sits near
zero while the app keeps up, then climbs the moment it can't — that climb is the knee, and
the arrival rate at the knee **is** the ceiling. Don't look at p95 to find it; a failing p95
threshold would just abort the run before reaching the interesting part, which is why
`capacity-test.js` uses `abortOnFail` on `dropped_iterations` instead of fixed latency
thresholds.

**Two tiers — pick based on what you're testing:**

| Tier | Origin | Target | Answers | Auth mechanism |
|---|---|---|---|---|
| **A** | On the VPS itself, `k6 run` | `http://127.0.0.1:3002` direct | True Node/Mongo/Redis ceiling — no nginx or WAN in the way | k6 sets `X-Real-IP` per VU itself (safe: port 3002 is loopback-only) |
| **B** | Separate, allowlisted VPS, same region | `https://kickmap.sijar.tech` through nginx | Full path: TLS, nginx, keepalive, real latency | k6 sends `X-Load-Test: $LOAD_TEST_SECRET` on every request |

Select with `TIER=A` (default) or `TIER=B`. Tier B fails fast at k6 startup if
`LOAD_TEST_SECRET` is empty — running Tier B without it just measures nginx's shared 3000
r/m bucket, not the app. **Tier B also requires the nginx allowlist config to actually be
live on the server** — see the deploy-order hazard called out in §5; `nginx-config.md` is not
applied automatically.

**Log level per run:**

```bash
# Realistic journey — low rate, server-side p50/p95 panels are the point
LOG_LEVEL=info docker compose up -d app
TIER=A k6 run load-test.js

# Capacity / breakpoint — LOG_LEVEL=warn, see "What survives LOG_LEVEL=warn" above
LOG_LEVEL=warn docker compose up -d app
TIER=A TEST_RUN=$(uuidgen) k6 run capacity-test.js
```

**Correlating a run in Grafana:**
1. Every k6 request carries `X-Test-Run: <uuid>` (`TEST_RUN` env, defaults to an
   auto-generated id per invocation).
2. Routes that receive the header echo it as a `testRun` field on their completion log
   (`src/lib/test-run.ts` → `getTestRun()`).
3. `grafana.json`'s `test_run` dashboard variable (default `.*`) is appended to panel
   queries as `| testRun=~"$test_run"` — set it to your run's UUID to scope the dashboard.

**`test_run` does NOT scope every panel — know which ones it skips:**

| Panels | Scoped by `$test_run`? | Why |
|---|---|---|
| 3, 4, 5, 6 (durations, cache-health proxy, rate-limited) | ✅ | Logged at the API route layer, which genuinely has the `testRun` field |
| 7 (Slow DB Queries) | ❌ | Repository logs are request-triggered but not request-scoped — `testRun` never threads down that far (§2) |
| 11 (Mongo Pool), 12 (Node Process) | ❌ | Periodic 10s telemetry, not per-request — never carries `testRun` (§4, §6) |

For panels 7, 11, 12, correlate to a specific run by **time range**, not the variable.

---

## Runbook — extended `capacity-test.js` scenarios + `chaos-test.js`

Cheatsheet, not prose. Run order top to bottom. All commands assume TIER=A, `LOG_LEVEL=warn`
unless noted, and `TEST_RUN=$(uuidgen)` per invocation so `$test_run` scopes panels 3–6.

| # | Scenario | Command | Check after |
|---|---|---|---|
| 1 | `breakpoint` | `TIER=A TEST_RUN=$(uuidgen) k6 run capacity-test.js` | `dropped_iterations` climb → note the knee rate |
| 2 | `miss` (DB-bound ceiling) | `TIER=A SCENARIO=miss TEST_RUN=$(uuidgen) k6 run capacity-test.js` | Same — `dropped_iterations`; expect a much lower knee than #1 |
| 3 | `steady` @ ~70% of knee | `TIER=A SCENARIO=steady STEADY_RATE=<0.7×knee> k6 run capacity-test.js` | `poolInUse`/`rss` panels 11/12 over the 15m window, no drift |
| 4 | `cold_cache` | `TIER=A SCENARIO=cold_cache SCRAPER_SECRET=$SCRAPER_SECRET k6 run capacity-test.js` | `{module="cache"}\|json\|log_level=~"warn\|error"` — lock-timeout warns should taper off fast |
| 5 | `stampede` (run `LOG_LEVEL=debug` for this one only) | `LOG_LEVEL=debug docker compose up -d app` then `TIER=A SCENARIO=stampede SCRAPER_SECRET=$SCRAPER_SECRET k6 run capacity-test.js` | `sum(count_over_time({container="kickmap",module="repo:product"}\|json\|filters="vendor,onSaleOnly"[$__interval]))` narrowed to the burst's few-second window — **1 (or low single digits) = pass, ~200 = fail**. Repeat: re-run the same command again for burst 2, 3, ... (each `setup()` re-busts the cache — see script comment for why this isn't an internal loop). Revert `LOG_LEVEL` after. |
| 6 | `soak` (long — run overnight/off-hours) | `TIER=A SCENARIO=soak SOAK_RATE=<below knee> SOAK_DURATION=60m k6 run capacity-test.js` | Panels 11/12 over the **full** window: flat `rss`/`heapUsed`/`poolInUse`/`eventLoopLag_mean` = pass |
| 7 | `chaos-test.js` | `TIER=A TEST_RUN=$(uuidgen) k6 run chaos-test.js` — **read the console output at start**, it prints the exact wall-clock times to run `docker compose stop redis` / `docker compose start redis` | During: `status_500` stays ~0 (any 500 = bug), `status_429` stays ~0 (fail-open). After: `{module="redis"}` for `"Redis connected"` — if absent, `docker compose restart app` (see script header for why) |

Notes:
- `miss` and `stampede` don't need `SCRAPER_SECRET` unless noted — `stampede` requires it
  (its `setup()` always busts the cache).
- `soak`/`stampede`/`miss` are intentionally excluded from `SCENARIO=all` — always invoke by
  name.
- Mongo/Atlas chaos (iptables) is advanced/optional, not in this table — see `chaos-test.js`'s
  header comment. It is destructive to the whole app until manually reverted; do not run it as
  part of the default runbook above.

---

## Known gaps — still open

Nothing below has shipped. Ordered by diagnostic value per line of code.

**1. nginx logs still don't reach Loki.** No promtail, no `log_format json_combined` shipping
anywhere. §5's `sudo tail -f` on the host is still the only way to see nginx-layer 429/502/504.

**2. `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` are still dead config.** Declared with
defaults in `src/env.ts`, validated at boot, and never read anywhere — every route hardcodes
its own numbers (see the table in §5). Either wire them up or delete the env vars; leaving
them is a trap for anyone who edits the env var expecting it to change behavior.

**3. No alerting exists.** `loki-config.yaml`'s `ruler.alertmanager_url` points at
`http://localhost:9093`, which inside the Loki container is Loki itself — there is no
Alertmanager and no rules are defined. Everything in this doc is pull-only; nothing pages you.

**4. Loki is single-node filesystem storage, 168h retention, capped at `mem_limit: 512m`.**
No backup. If the volume dies, all history (including the correlation data for past load
tests) is gone. The 512m cap plus `ingestion_rate_mb: 8` / `ingestion_burst_size_mb: 16` in
`loki-config.yaml` mean a runaway high-rate test now degrades logging (ingestion rate-limit
errors in Loki's own logs) instead of OOM-killing the host — that's a deliberate tradeoff, not
a bug; if you see "ingestion rate limit" spam during a legitimate capacity run, raise
`ingestion_rate_mb` rather than removing the cap.

**5. `LOAD_TEST_SECRET` should stay unset in normal production.** `isLoadTest()`
(`src/lib/rate-limit.ts`) returns `false` unconditionally when it's unset — that's the safe
default. Only set it in the environment for the duration of a Tier B run, then unset it again;
leaving it set permanently means anyone who learns the value can bypass both nginx's and the
app's rate limiting indefinitely.

**6. `revalidate/route.ts` still uses `redis.keys()`** instead of `SCAN` (§3) — O(N) blocking
scan on every scrape completion.

**7. `docker logs kickmap` still returns nothing.** This is by design (the `loki` log driver
replaces the default json-file driver), not a regression from adding `mode: non-blocking` —
see the note in Step 0. If you need Loki's own health, check it directly:
`docker compose exec loki wget -qO- localhost:3100/ready`.

**8. No request ID.** nginx doesn't set `X-Request-Id`, and nothing threads one through the
app. The `api:` → `cache` → `repo:` lines of a single slow request still can't be joined
except by eyeballing timestamps — this is also *why* `testRun` can't reach the repo layer
(§2), short of adding the same kind of context plumbing a request ID would need.

**9. Add a Docker healthcheck to the `app` service.** Only `redis` has one — Docker never
restarts a wedged Node process on its own.

**10. Port 3002 is published on all interfaces** (`"3002:3000"` in `docker-compose.yml`). That
is the origin *behind* nginx — no TLS, no `limit_req`, no `limit_conn`, and none of the geo
allowlist. Anything that can route to the VPS on 3002 bypasses the entire edge. It is bound
this way deliberately if the scraper POSTs `/api/revalidate` directly to `<vps-ip>:3002`; if
the scraper instead goes through `kickmap.sijar.tech`, change it to `"127.0.0.1:3002:3000"`.
Note Tier A load tests target `127.0.0.1:3002` from *on* the VPS, so loopback binding does not
interfere with them.

**11. Loki's port 3100 is published on all interfaces** with `auth_enabled: false` in
`loki-config.yaml`. Anyone who can reach the VPS on 3100 can read every log line (including
`ip` fields and anything not caught by pino's `redact` list) and push forged entries. If
Grafana runs on the same host, `"127.0.0.1:3100:3100"` costs nothing — the log driver reaches
Loki via `127.0.0.1` either way (see Step 0). Only leave it open for a remote Grafana, and
then firewall it to that host's IP.
