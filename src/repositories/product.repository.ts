import type { PipelineStage } from 'mongoose';
import type { Product, ProductFilters, RegionStock } from '@/types';
import { connectDB } from '@/db/connection';
import { JDProductModel } from '@/db/models/JDProduct';
import { JDRegionStockModel } from '@/db/models/JDRegionStock';

function mapStockDoc(s: {
  region: string;
  sizesAvailable?: string[];
  sizesTotal?: string[];
  inStock: boolean;
  totalStock: number;
  price: number;
  originalPrice?: number | null;
  isOnSale: boolean;
  currency: string;
  scrapedAt: Date | string;
}): RegionStock {
  return {
    region: s.region as 'MY' | 'ID' | 'SG',
    sizesAvailable: s.sizesAvailable ?? [],
    sizesTotal: s.sizesTotal ?? [],
    inStock: s.inStock,
    totalStock: s.totalStock,
    price: s.price,
    originalPrice: s.originalPrice ?? null,
    isOnSale: s.isOnSale,
    currency: s.currency as 'MYR' | 'IDR' | 'SGD',
    scrapedAt: s.scrapedAt instanceof Date ? s.scrapedAt.toISOString() : String(s.scrapedAt),
  };
}

export const productRepository = {
  async findMany(filters: ProductFilters): Promise<Product[]> {
    await connectDB();

    // Build stock filter stage
    const stockMatch: Record<string, unknown> = {};
    if (filters.region !== undefined) stockMatch['region'] = filters.region;
    if (filters.inStock !== undefined) stockMatch['inStock'] = filters.inStock;
    if (filters.onSaleOnly === true) stockMatch['isOnSale'] = true;
    if (filters.size !== undefined) stockMatch['sizesTotal'] = filters.size;

    // Build product filter stage
    const productMatch: Record<string, unknown> = {};
    if (filters.vendor !== undefined) {
      productMatch['vendor'] = { $regex: new RegExp(filters.vendor, 'i') };
    }
    if (filters.gender !== undefined) {
      productMatch['gender'] = { $regex: new RegExp(filters.gender, 'i') };
    }
    if (filters.model !== undefined) {
      productMatch['$or'] = [
        { title: { $regex: new RegExp(filters.model, 'i') } },
        { colorway: { $regex: new RegExp(filters.model, 'i') } },
      ];
    }
    if (filters.q !== undefined && filters.q.trim().length >= 2) {
      const qRegex = { $regex: new RegExp(filters.q.trim(), 'i') };
      productMatch['$or'] = [{ title: qRegex }, { vendor: qRegex }, { colorway: qRegex }];
    }

    interface AggResult {
      productCode: string;
      title: string;
      vendor: string;
      imageUrl: string;
      gender: string;
      productType: string;
      colorway?: string;
      stock: {
        region: string;
        sizesAvailable: string[];
        sizesTotal: string[];
        inStock: boolean;
        totalStock: number;
        price: number;
        originalPrice?: number | null;
        isOnSale: boolean;
        currency: string;
        scrapedAt: Date | string;
      }[];
    }

    const pipeline: PipelineStage[] = [
      // Start from products, optionally filter by product fields first
      ...(Object.keys(productMatch).length > 0 ? [{ $match: productMatch }] : []),
      // Join stock in one round trip
      {
        $lookup: {
          from: 'jdregionstocks',
          localField: 'productCode',
          foreignField: 'productCode',
          as: 'stock',
        },
      },
      // Filter by stock conditions
      ...(Object.keys(stockMatch).length > 0
        ? [{ $match: { stock: { $elemMatch: stockMatch } } }]
        : []),
      // Keep only matching stock entries (e.g. only SG stocks when region=SG)
      ...(Object.keys(stockMatch).length > 0
        ? [{
            $set: {
              stock: {
                $filter: {
                  input: '$stock',
                  as: 's',
                  cond: {
                    $and: Object.entries(stockMatch).map(([k, v]) =>
                      // sizesTotal/sizesAvailable are arrays — use $in instead of $eq
                      k === 'sizesTotal' || k === 'sizesAvailable'
                        ? { $in: [v, `$$s.${k}`] }
                        : { $eq: [`$$s.${k}`, v] }
                    ),
                  },
                },
              },
            },
          }]
        : []),
      // Require at least one matching stock entry
      { $match: { 'stock.0': { $exists: true } } },
      // multiRegion: keep only products available in 2+ regions
      ...(filters.multiRegion === true
        ? [{ $match: { $expr: { $gte: [{ $size: { $setUnion: '$stock.region' } }, 2] } } }]
        : []),
      { $sort: { productCode: 1 } },
    ];

    const results = await JDProductModel.aggregate<AggResult>(pipeline);

    return results.map((p) => {
      const product: Product = {
        productCode: p.productCode,
        title: p.title,
        vendor: p.vendor,
        imageUrl: p.imageUrl,
        gender: p.gender,
        productType: p.productType,
        stock: p.stock.map(mapStockDoc),
      };
      if (p.colorway !== undefined && p.colorway !== null) {
        product.colorway = p.colorway;
      }
      return product;
    });
  },

  async findByCode(code: string): Promise<Product | null> {
    await connectDB();

    const product = await JDProductModel.findOne({ productCode: code }).lean();
    if (!product) return null;

    const stocks = await JDRegionStockModel.find({ productCode: code }).lean();

    const result: Product = {
      productCode: product.productCode,
      title: product.title,
      vendor: product.vendor,
      imageUrl: product.imageUrl,
      gender: product.gender,
      productType: product.productType,
      stock: stocks.map(mapStockDoc),
    };
    // Only set colorway if it exists — exactOptionalPropertyTypes requires no undefined assignment
    if (product.colorway !== undefined && product.colorway !== null) {
      result.colorway = product.colorway;
    }
    return result;
  },
};
