import type { Currency, ExchangeRates, Result } from '@/types';
import { redis } from '@/lib/redis';
import { CACHE_KEYS } from '@/lib/cache-keys';
import { CACHE_TTL } from '@/lib/cache';
import { env } from '@/env';

interface ExchangeApiResponse {
  result: string;
  rates: Record<string, number>;
  time_last_update_utc?: string;
}

type ExchangeResult = Result<ExchangeRates> & { cacheStatus: 'HIT' | 'MISS' | 'STALE' };

export const exchangeService = {
  async getExchangeRates(): Promise<ExchangeResult> {
    const cached = await redis.get(CACHE_KEYS.exchangeRates());
    if (cached !== null) {
      return { success: true, data: JSON.parse(cached) as ExchangeRates, cacheStatus: 'HIT' };
    }

    try {
      const response = await fetch(`${env.EXCHANGE_API_BASE_URL}/SGD`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = (await response.json()) as ExchangeApiResponse;
      if (json.result !== 'success') throw new Error('Non-success result');

      const rates: Record<Currency, number> = {
        SGD: 1,
        MYR: json.rates['MYR'] ?? 3.3,
        IDR: json.rates['IDR'] ?? 11000,
        THB: json.rates['THB'] ?? 26,
        USD: json.rates['USD'] ?? 0.75,
      };

      const data: ExchangeRates = {
        base: 'SGD',
        rates,
        updatedAt: json.time_last_update_utc ?? new Date().toISOString(),
      };

      await Promise.all([
        redis.setex(CACHE_KEYS.exchangeRates(), CACHE_TTL.EXCHANGE, JSON.stringify(data)),
        redis.setex(CACHE_KEYS.exchangeRatesStale(), 86400, JSON.stringify(data)),
      ]);

      return { success: true, data, cacheStatus: 'MISS' };
    } catch {
      const stale = await redis.get(CACHE_KEYS.exchangeRatesStale());
      if (stale !== null) {
        return { success: true, data: JSON.parse(stale) as ExchangeRates, cacheStatus: 'STALE' };
      }
      return {
        success: false,
        error: { code: 'UPSTREAM_ERROR', message: 'Exchange rate service unavailable' },
        cacheStatus: 'MISS',
      };
    }
  },
};
