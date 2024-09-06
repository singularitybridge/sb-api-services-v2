import mongoose, { Document, Schema } from 'mongoose';

export interface IContentFile extends Document {
  filename: string;
  title: string;
  description?: string;
  mimeType: string;
  size: number;
  gcpStorageUrl: string;
  companyId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ContentFileSchema: Schema = new Schema({
  filename: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  gcpStorageUrl: { type: String, required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
}, { timestamps: true });

export const ContentFile = mongoose.model<IContentFile>('ContentFile', ContentFileSchema);