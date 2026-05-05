import mongoose, { Schema, InferSchemaType } from 'mongoose';

const JDProductSchema = new Schema(
  {
    productCode: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    vendor: { type: String, required: true, index: true },
    imageUrl: { type: String, required: true },
    gender: { type: String, required: true },
    productType: { type: String, required: true },
    colorway: { type: String },
  },
  {
    collection: 'jdproducts',
    timestamps: true,
  }
);

// Compound index for brand page queries (vendor filter + stable productCode sort)
JDProductSchema.index({ vendor: 1, productCode: 1 });

// Text index for search queries across title, vendor, and colorway
JDProductSchema.index({ title: 'text', vendor: 'text', colorway: 'text' });

export type JDProductDocument = InferSchemaType<typeof JDProductSchema>;

export const JDProductModel =
  (mongoose.models['JDProduct'] as mongoose.Model<JDProductDocument> | undefined) ??
  mongoose.model<JDProductDocument>('JDProduct', JDProductSchema);
