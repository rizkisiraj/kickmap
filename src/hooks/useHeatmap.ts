import useSWR from 'swr';
import type { RegionMapData } from '@/types';

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Fetch failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export function useHeatmap() {
  const { data, error, isLoading, isValidating } = useSWR<{ data: RegionMapData[] }>(
    '/api/heatmap',
    fetcher,
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000,
      onError: (err) => {
        console.error('[useHeatmap] SWR error:', err.message);
      },
    },
  );

  return {
    regionData: data?.data ?? [],
    isLoading,
    isValidating,
    error: error as Error | undefined,
  };
}
