import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: ['req.headers.authorization', 'scraperSecret', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
  base: {
    app: 'kickmap',
    version: process.env.npm_package_version ?? '0.0.0',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const createLogger = (module: string) => logger.child({ module });
