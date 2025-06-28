import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export interface IApiKey extends Document {
  name: string;
  key: string;
  hashedKey: string;
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  lastUsed?: Date;
  expiresAt: Date;
  isActive: boolean;
  permissions?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    hashedKey: { type: String, required: true, unique: true }, // For lookup
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    lastUsed: { type: Date },
    expiresAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    permissions: [{ type: String }], // For future use - specific API permissions
  },
  { timestamps: true },
);

// Index for efficient lookup
ApiKeySchema.index({ hashedKey: 1, isActive: 1 });
ApiKeySchema.index({ companyId: 1, userId: 1 });
ApiKeySchema.index({ expiresAt: 1 });

// Method to generate API key
ApiKeySchema.statics.generateApiKey = function (): {
  key: string;
  hashedKey: string;
} {
  // Generate a secure random key with prefix for identification
  const prefix = 'sk_live_';
  const randomBytes = crypto.randomBytes(32).toString('hex');
  const key = prefix + randomBytes;

  // Hash the key for storage
  const hashedKey = crypto.createHash('sha256').update(key).digest('hex');

  return { key, hashedKey };
};

// Method to hash an API key for lookup
ApiKeySchema.statics.hashApiKey = function (key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
};

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);

