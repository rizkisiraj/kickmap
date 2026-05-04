import type { RegionMapData, StockLevel } from '@/types';
import { connectDB } from '@/db/connection';
import { JDRegionStockModel } from '@/db/models/JDRegionStock';
import { JDProductModel } from '@/db/models/JDProduct';

const ALL_REGIONS: Array<'MY' | 'ID' | 'SG'> = ['MY', 'ID', 'SG'];

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
  productCodes: string[];
}

interface VendorAggResult {
  _id: string;
  count: number;
}

export const heatmapRepository = {
  async getRegionStats(): Promise<RegionMapData[]> {
    await connectDB();

    // Aggregate stock data by region
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
          productCodes: { $addToSet: '$productCode' },
        },
      },
    ]);

    // Build a map for quick lookup
    const regionMap = new Map(stockAgg.map((r) => [r._id, r]));

    // For each region, get top 3 brands
    const results: RegionMapData[] = await Promise.all(
      ALL_REGIONS.map(async (region) => {
        const data = regionMap.get(region);
        if (data === undefined) {
          return {
            region,
            totalProducts: 0,
            inStockCount: 0,
            onSaleCount: 0,
            stockLevel: 'none' as StockLevel,
            topBrands: [],
          };
        }

        // Get top 3 vendors for this region's products
        const vendorAgg = await JDProductModel.aggregate<VendorAggResult>([
          { $match: { productCode: { $in: data.productCodes } } },
          { $group: { _id: '$vendor', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 3 },
        ]);

        const topBrands = vendorAgg.map((v) => v._id);

        return {
          region,
          totalProducts: data.totalProducts,
          inStockCount: data.inStockCount,
          onSaleCount: data.onSaleCount,
          stockLevel: deriveStockLevel(data.inStockCount),
          topBrands,
        };
      })
    );

    return results;
  },
};
