import { createLogger } from '@/lib/logger';

const log = createLogger('instrumentation');

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
  }
}
