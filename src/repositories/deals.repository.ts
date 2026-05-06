import type { Deal } from '@/types';
import { connectDB } from '@/db/connection';
import { JDRegionStockModel } from '@/db/models/JDRegionStock';
import { createLogger } from '@/lib/logger';

const log = createLogger('repo:deals');

interface StockAggResult {
  productCode: string;
  region: string;
  price: number;
  originalPrice: number | null;
  isOnSale: boolean;
  totalStock: number;
  currency: string;
  scrapedAt: Date;
  discountPercent: number;
  product: {
    title: string;
    imageUrl: string;
    vendor: string;
    colorway?: string;
  };
}

export const dealsRepository = {
  async findOnSale(): Promise<Deal[]> {
    await connectDB();

    const startTime = Date.now();
    const results = await JDRegionStockModel.aggregate<StockAggResult>([
      { $match: { isOnSale: true, inStock: true } },
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
        $addFields: {
          discountPercent: {
            $cond: {
              if: { $and: [{ $ne: ['$originalPrice', null] }, { $gt: ['$originalPrice', 0] }] },
              then: {
                $round: [
                  { $multiply: [{ $subtract: [1, { $divide: ['$price', '$originalPrice'] }] }, 100] },
                  0,
                ],
              },
              else: 0,
            },
          },
        },
      },
      { $sort: { discountPercent: -1, productCode: 1, region: 1 } },
    ]);

    const deals = results.map((r) => {
      const productData = r.product;
      return {
        productCode: r.productCode,
        title: productData?.title ?? r.productCode,
        ...(productData?.colorway !== undefined ? { colorway: productData.colorway } : {}),
        imageUrl: productData?.imageUrl ?? '',
        vendor: productData?.vendor ?? '',
        region: r.region as 'MY' | 'ID' | 'SG',
        price: r.price,
        originalPrice: r.originalPrice ?? r.price,
        discountPercent: r.discountPercent,
        currency: r.currency as 'MYR' | 'IDR' | 'SGD',
        totalStock: r.totalStock,
        scrapedAt: r.scrapedAt instanceof Date ? r.scrapedAt.toISOString() : String(r.scrapedAt),
      };
    });

    const duration = Date.now() - startTime;
    if (duration > 100) {
      log.warn({ duration, resultCount: deals.length }, 'Slow deals query');
    } else {
      log.debug({ duration, resultCount: deals.length }, 'Deals query completed');
    }

    return deals;
  },
};
