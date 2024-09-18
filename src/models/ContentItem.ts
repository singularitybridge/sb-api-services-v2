import mongoose, { Document, Schema } from 'mongoose';

export interface IContentItem extends Document {
  companyId: mongoose.Types.ObjectId;
  title: string;
  contentType: string;
  content: any;
  metadata?: Record<string, any>;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ContentItemSchema: Schema = new Schema(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
    title: { type: String, required: true },
    contentType: { type: String, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    metadata: { type: Schema.Types.Mixed },
    tags: [{ type: String }],
  },
  { timestamps: true }
);

ContentItemSchema.index({ companyId: 1, title: 1 }, { unique: true });

export const ContentItem = mongoose.model<IContentItem>('ContentItem', ContentItemSchema);