// file path: /src/models/Journal.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IJournal extends Document {
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  timestamp: Date;
  entryType: string;
  content: string;
  metadata: Record<string, any>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const JournalSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  timestamp: { type: Date, default: Date.now },
  entryType: { type: String, required: true },
  content: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed },
  tags: [{ type: String }],
}, { timestamps: true });

export const Journal = mongoose.model<IJournal>('Journal', JournalSchema);