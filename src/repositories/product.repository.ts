import type { PipelineStage } from 'mongoose';
import type { Product, ProductFilters, RegionStock } from '@/types';
import { connectDB } from '@/db/connection';
import { JDProductModel } from '@/db/models/JDProduct';
import { JDRegionStockModel } from '@/db/models/JDRegionStock';
import { createLogger } from '@/lib/logger';

const log = createLogger('repo:product');

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

    const startTime = Date.now();

    // Build stock filter stage
    const stockMatch: Record<string, unknown> = {};
    if (filters.region !== undefined) stockMatch['region'] = filters.region;
    if (filters.inStock !== undefined) stockMatch['inStock'] = filters.inStock;
    if (filters.onSaleOnly === true) stockMatch['isOnSale'] = true;
    if (filters.size !== undefined) stockMatch['sizesAvailable'] = filters.size;

    // Build non-search product filter stage (vendor, gender, model)
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

    function buildPipeline(firstMatch: Record<string, unknown>): PipelineStage[] {
      return [
        { $match: firstMatch },
        ...(Object.keys(productMatch).length > 0 ? [{ $match: productMatch }] : []),
        {
          $lookup: {
            from: 'jdregionstocks',
            localField: 'productCode',
            foreignField: 'productCode',
            as: 'stock',
          },
        },
        ...(Object.keys(stockMatch).length > 0
          ? [{ $match: { stock: { $elemMatch: stockMatch } } }]
          : []),
        ...(Object.keys(stockMatch).length > 0
          ? [{
              $set: {
                stock: {
                  $filter: {
                    input: '$stock',
                    as: 's',
                    cond: {
                      $and: Object.entries(stockMatch).map(([k, v]) =>
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
        { $match: { 'stock.0': { $exists: true } } },
        ...(filters.multiRegion === true
          ? [{ $match: { $expr: { $gte: [{ $size: { $setUnion: '$stock.region' } }, 2] } } }]
          : []),
        { $sort: { productCode: 1 } },
      ];
    }

    function mapResults(results: AggResult[]): Product[] {
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
    }

    let results: Product[] = [];
    let searchPath = 'standard';

    // Hybrid search: $text first (indexed), $regex fallback (catches partials)
    if (filters.q !== undefined && filters.q.trim().length >= 2) {
      const trimmedQ = filters.q.trim();

      // Stage 1: $text search (uses text index)
      const textPipeline = buildPipeline({ $text: { $search: trimmedQ } });
      const textResults = await JDProductModel.aggregate<AggResult>(textPipeline);

      if (textResults.length > 0) {
        results = mapResults(textResults);
        searchPath = 'text';
      } else {
        // Stage 2: $regex fallback for partial matches
        const qRegex = { $regex: new RegExp(trimmedQ, 'i') };
        const regexPipeline = buildPipeline({
          $or: [{ title: qRegex }, { vendor: qRegex }, { colorway: qRegex }],
        });
        const regexResults = await JDProductModel.aggregate<AggResult>(regexPipeline);
        results = mapResults(regexResults);
        searchPath = 'regex';
      }
    } else {
      // No search query — standard pipeline
      const firstMatch = Object.keys(productMatch).length > 0 ? productMatch : {};
      const pipeline = buildPipeline(firstMatch);
      const standardResults = await JDProductModel.aggregate<AggResult>(pipeline);
      results = mapResults(standardResults);
    }

    const duration = Date.now() - startTime;
    const filterSummary = Object.entries(filters)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k)
      .join(',');

    if (duration > 100) {
      log.warn({ duration, resultCount: results.length, searchPath, filters: filterSummary }, 'Slow product query');
    } else {
      log.debug({ duration, resultCount: results.length, searchPath, filters: filterSummary }, 'Product query completed');
    }

    if (results.length === 0 && filterSummary) {
      log.debug({ filters: filterSummary, searchPath }, 'Zero results for product query');
    }

    return results;
  },

  async findByCode(code: string): Promise<Product | null> {
    await connectDB();

    const startTime = Date.now();
    const product = await JDProductModel.findOne({ productCode: code }).lean();
    if (!product) {
      log.debug({ productCode: code, duration: Date.now() - startTime }, 'Product not found');
      return null;
    }

    const stocks = await JDRegionStockModel.find({ productCode: code }).lean();
    const duration = Date.now() - startTime;

    const result: Product = {
      productCode: product.productCode,
      title: product.title,
      vendor: product.vendor,
      imageUrl: product.imageUrl,
      gender: product.gender,
      productType: product.productType,
      stock: stocks.map(mapStockDoc),
    };
    if (product.colorway !== undefined && product.colorway !== null) {
      result.colorway = product.colorway;
    }

    if (duration > 100) {
      log.warn({ productCode: code, duration }, 'Slow product detail query');
    } else {
      log.debug({ productCode: code, duration }, 'Product detail query completed');
    }

    return result;
  },
};
