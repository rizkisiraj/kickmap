import mongoose, { Schema, InferSchemaType } from 'mongoose';

const JDRegionStockSchema = new Schema(
  {
    productCode: { type: String, required: true, index: true },
    region: { type: String, required: true, enum: ['MY', 'ID', 'SG'], index: true },
    sizesAvailable: { type: [String], default: [] },
    sizesTotal: { type: [String], default: [] },
    inStock: { type: Boolean, required: true, index: true },
    totalStock: { type: Number, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number, default: null },
    isOnSale: { type: Boolean, required: true, index: true },
    currency: { type: String, required: true, enum: ['MYR', 'IDR', 'SGD'] },
    scrapedAt: { type: Date, required: true },
  },
  {
    collection: 'jdregionstocks',
  }
);

// Compound indexes
JDRegionStockSchema.index({ region: 1, inStock: 1 });
JDRegionStockSchema.index({ productCode: 1, region: 1 }, { unique: true });
JDRegionStockSchema.index({ region: 1, inStock: 1, productCode: 1 }); // covers the main filter path
JDRegionStockSchema.index({ sizesAvailable: 1 });                      // size-finder queries

export type JDRegionStockDocument = InferSchemaType<typeof JDRegionStockSchema>;

export const JDRegionStockModel =
  (mongoose.models['JDRegionStock'] as mongoose.Model<JDRegionStockDocument> | undefined) ??
  mongoose.model<JDRegionStockDocument>('JDRegionStock', JDRegionStockSchema);
