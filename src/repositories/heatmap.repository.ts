import type { RegionMapData, StockLevel } from '@/types';
import { connectDB } from '@/db/connection';
import { JDRegionStockModel } from '@/db/models/JDRegionStock';
import { createLogger } from '@/lib/logger';

const log = createLogger('repo:heatmap');

const ALL_REGIONS: Array<'MY' | 'ID' | 'SG' | 'TH'> = ['MY', 'ID', 'SG', 'TH'];

function deriveStockLevel(inStockCount: number): StockLevel {
  if (inStockCount > 200) return 'high';
  if (inStockCount > 60) return 'medium';
  if (inStockCount > 0) return 'low';
  return 'none';
}

interface StockAggResult {
  _id: string;
  totalProducts: number;
  inStockCount: number;
  onSaleCount: number;
}

interface VendorCountResult {
  _id: { region: string; vendor: string };
  count: number;
}

interface VendorGroupedResult {
  _id: string;
  topBrands: string[];
}

export const heatmapRepository = {
  async getRegionStats(): Promise<RegionMapData[]> {
    await connectDB();

    const startTime = Date.now();

    // Query 1: stock stats grouped by region (no productCodes array)
    const stockAgg = await JDRegionStockModel.aggregate<StockAggResult>([
      {
        $group: {
          _id: '$region',
          totalProducts: { $sum: 1 },
          inStockCount: {
            $sum: { $cond: [{ $eq: ['$inStock', true] }, 1, 0] },
          },
          onSaleCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$isOnSale', true] }, { $eq: ['$inStock', true] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Query 2: top 3 vendors per region via $lookup (single pipeline, no $in array)
    const vendorAgg = await JDRegionStockModel.aggregate<VendorGroupedResult>([
      {
        $lookup: {
          from: 'jdproducts',
          localField: 'productCode',
          foreignField: 'productCode',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: { region: '$region', vendor: '$product.vendor' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.region': 1, count: -1 } },
      {
        $group: {
          _id: '$_id.region',
          topBrands: {
            $push: '$_id.vendor',
          },
        },
      },
    ]);

    const regionMap = new Map(stockAgg.map((r) => [r._id, r]));
    const vendorMap = new Map(vendorAgg.map((r) => [r._id, r.topBrands.slice(0, 3)]));

    const data = ALL_REGIONS.map((region) => {
      const stats = regionMap.get(region);
      if (stats === undefined) {
        return {
          region,
          totalProducts: 0,
          inStockCount: 0,
          onSaleCount: 0,
          stockLevel: 'none' as StockLevel,
          topBrands: [],
        };
      }

      return {
        region,
        totalProducts: stats.totalProducts,
        inStockCount: stats.inStockCount,
        onSaleCount: stats.onSaleCount,
        stockLevel: deriveStockLevel(stats.inStockCount),
        topBrands: vendorMap.get(region) ?? [],
      };
    });

    const duration = Date.now() - startTime;
    if (duration > 100) {
      log.warn({ duration }, 'Slow heatmap query');
    } else {
      log.debug({ duration }, 'Heatmap query completed');
    }

    return data;
  },
};
