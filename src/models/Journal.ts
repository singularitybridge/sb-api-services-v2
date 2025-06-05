import mongoose, { Document, Schema } from 'mongoose';

export interface IJournal extends Document {
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  sessionId: mongoose.Types.ObjectId;
  timestamp: Date;
  entryType: string;
  content: string;
  metadata: { [key: string]: any }; // Allow any extra keys
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isIndexed: boolean;
  embeddingId?: string;
  embeddingModel?: string;
}

const JournalSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  timestamp: { type: Date, default: Date.now },
  entryType: { 
    type: String, 
    required: true 
  },
  content: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed }, // Mongoose stores objects as Mixed by default if not strictly typed
  tags: [{ type: String }],
  isIndexed: { type: Boolean, default: false },
  embeddingId: { type: String },
  embeddingModel: { type: String },
}, { timestamps: true });

JournalSchema.index({ companyId: 1, userId: 1, timestamp: -1 });
JournalSchema.index({ isIndexed: 1 }, { sparse: true });

export const Journal = mongoose.model<IJournal>('Journal', JournalSchema);
