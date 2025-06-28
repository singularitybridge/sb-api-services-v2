import mongoose, { Document, Schema } from 'mongoose';

export interface IContentItem extends Document {
  companyId: mongoose.Types.ObjectId;
  contentTypeId: mongoose.Types.ObjectId;
  artifactKey: string;
  data: Record<string, any>;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const ContentItemSchema: Schema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    contentTypeId: {
      type: Schema.Types.ObjectId,
      ref: 'ContentType',
      required: true,
    },
    artifactKey: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    embedding: { type: [Number], required: false },
  },
  { timestamps: true },
);

ContentItemSchema.index({ companyId: 1, contentTypeId: 1 });
ContentItemSchema.index({ artifactKey: 1 }); // Index for performance, but not unique
ContentItemSchema.index({ 'data.status': 1 });
ContentItemSchema.index({ 'data.createdAt': -1 });
ContentItemSchema.index({ embedding: '2dsphere' }); // Index for vector search

export const ContentItem = mongoose.model<IContentItem>(
  'ContentItem',
  ContentItemSchema,
);
