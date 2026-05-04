import useSWR from 'swr';
import type { ExchangeRates } from '@/types';

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fetch failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export function useExchangeRates() {
  const { data, error, isLoading } = useSWR<ExchangeRates>('/api/exchange', fetcher, {
    keepPreviousData: true,
    revalidateOnFocus: false,
    refreshInterval: 60 * 60 * 1000,
  });

  return {
    rates: data,
    isLoading,
    error: error as Error | undefined,
  };
}
