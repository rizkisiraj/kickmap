import type { RegionMapData, Result } from '@/types';
import { withCache, CACHE_TTL } from '@/lib/cache';
import { CACHE_KEYS } from '@/lib/cache-keys';
import { heatmapRepository } from '@/repositories/heatmap.repository';

export const heatmapService = {
  async getHeatmapData(): Promise<Result<RegionMapData[]>> {
    const data = await withCache(
      CACHE_KEYS.heatmap(),
      CACHE_TTL.HEATMAP,
      () => heatmapRepository.getRegionStats(),
    );
    return { success: true, data };
  },
};
