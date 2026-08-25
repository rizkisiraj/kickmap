import { createLogger, createTelemetryLogger } from '@/lib/logger';

const log = createLogger('instrumentation');

const PROCESS_TICK_INTERVAL_MS = 10_000;
const NS_TO_MS = 1_000_000;
// monitorEventLoopDelay's default resolution. Explicit (rather than relying
// on the Node default) so the value logged alongside mean/max is always
// accurate even if the default changes across Node versions.
const EVENT_LOOP_RESOLUTION_MS = 20;

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    log.info(
      {
        nodeVersion: process.version,
        env: process.env.NODE_ENV,
        port: process.env.PORT ?? '3000',
      },
      'KickMap server starting',
    );

    // Dynamic imports so this module has no side effects (no Mongo connect)
    // just from being loaded — only the process tick pulls in perf_hooks and
    // the pool gauge reader.
    const { monitorEventLoopDelay } = await import('node:perf_hooks');
    const { getPoolStats } = await import('@/lib/pool-stats');

    const telemetryLog = createTelemetryLogger('process');
    // NOTE: monitorEventLoopDelay records the observed timer interval, so an
    // idle process reports a mean approximately equal to `resolution`, not
    // ~0ms — do not read the absolute mean as "0 = healthy". The signal of
    // interest is the delta above `resolution`, which is why `resolution` is
    // logged alongside mean/max rather than subtracted out (subtracting could
    // go negative and would obscure the real value being reported).
    const eventLoopHistogram = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
    eventLoopHistogram.enable();

    const interval = setInterval(() => {
      const { heapUsed, heapTotal, rss } = process.memoryUsage();
      const eventLoopLagMean = eventLoopHistogram.mean / NS_TO_MS;
      const eventLoopLagMax = eventLoopHistogram.max / NS_TO_MS;
      eventLoopHistogram.reset();

      const { poolInUse, poolSize } = getPoolStats();

      telemetryLog.info(
        {
          heapUsed,
          heapTotal,
          rss,
          eventLoopLag: { mean: eventLoopLagMean, max: eventLoopLagMax, resolution: EVENT_LOOP_RESOLUTION_MS },
          poolInUse,
          poolSize,
        },
        'Process tick',
      );
    }, PROCESS_TICK_INTERVAL_MS);

    interval.unref();
  }
}
