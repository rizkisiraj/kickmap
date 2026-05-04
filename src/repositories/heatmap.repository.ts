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

export const heatmapRepository = {
  async getRegionStats(): Promise<RegionMapData[]> {
    await connectDB();

    // Query 1: stock stats grouped by region
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

    // Query 2: single fetch for all vendors across all regions (was 3 separate queries)
    const allProductCodes = [...new Set(stockAgg.flatMap((r) => r.productCodes))];
    const vendorDocs = await JDProductModel.find(
      { productCode: { $in: allProductCodes } },
      { productCode: 1, vendor: 1, _id: 0 },
    ).lean();

    // productCode → vendor lookup in memory
    const productVendorMap = new Map(vendorDocs.map((p) => [p.productCode, p.vendor]));
    const regionMap = new Map(stockAgg.map((r) => [r._id, r]));

    return ALL_REGIONS.map((region) => {
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

      // Count vendors for this region in memory instead of a per-region aggregation
      const vendorCount = new Map<string, number>();
      for (const code of data.productCodes) {
        const vendor = productVendorMap.get(code);
        if (vendor !== undefined) {
          vendorCount.set(vendor, (vendorCount.get(vendor) ?? 0) + 1);
        }
      }

      const topBrands = [...vendorCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([vendor]) => vendor);

      return {
        region,
        totalProducts: data.totalProducts,
        inStockCount: data.inStockCount,
        onSaleCount: data.onSaleCount,
        stockLevel: deriveStockLevel(data.inStockCount),
        topBrands,
      };
    });
  },
};
