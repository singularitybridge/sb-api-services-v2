import mongoose, { Document, Schema } from 'mongoose';

export interface IVectorStore extends Document {
  openaiId: string;
  assistantId: Schema.Types.ObjectId;
  companyId: Schema.Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const VectorStoreSchema: Schema = new Schema({
  openaiId: { type: String, required: true },
  assistantId: { type: Schema.Types.ObjectId, ref: 'Assistant', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  name: { type: String, required: true },
}, { timestamps: true });

export const VectorStore = mongoose.model<IVectorStore>('VectorStore', VectorStoreSchema);