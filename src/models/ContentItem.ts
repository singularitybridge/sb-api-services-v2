import mongoose, { Document, Schema } from 'mongoose';

export interface IContentItem extends Document {
  companyId: mongoose.Types.ObjectId;
  contentTypeId: mongoose.Types.ObjectId;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const ContentItemSchema: Schema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    contentTypeId: { type: Schema.Types.ObjectId, ref: 'ContentType', required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

ContentItemSchema.index({ companyId: 1, contentTypeId: 1 });
ContentItemSchema.index({ 'data.status': 1 });
ContentItemSchema.index({ 'data.createdAt': -1 });

export const ContentItem = mongoose.model<IContentItem>('ContentItem', ContentItemSchema);