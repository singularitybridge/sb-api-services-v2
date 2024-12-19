import mongoose, { Document, Schema } from 'mongoose';

export interface IUIConnection extends Document {
  companyId: string;
  isUiConnected: boolean;
  socketId?: string;
  lastConnectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UIConnectionSchema = new Schema({
  companyId: { type: String, required: true, unique: true, index: true },
  isUiConnected: { type: Boolean, default: false, index: true },
  socketId: { type: String, sparse: true },
  lastConnectedAt: { type: Date, default: Date.now }
}, {
  timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Compound index for finding active connections efficiently
UIConnectionSchema.index({ isUiConnected: 1, companyId: 1 });

// Index for time-based queries if needed
UIConnectionSchema.index({ lastConnectedAt: -1 });

export const UIConnection = mongoose.model<IUIConnection>('UIConnection', UIConnectionSchema);
