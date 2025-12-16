import mongoose, { Document, Schema } from 'mongoose';

/**
 * Nylas Grant Model
 *
 * Separate collection for per-user Nylas grants (extracted from User model).
 * Each user can have one active grant for email/calendar access.
 */
export interface INylasGrant extends Document {
  userId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  grantId: string;
  email: string;
  provider: string;
  status: 'active' | 'expired' | 'revoked';
  scopes?: string[];
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  migratedAt?: Date;
}

const NylasGrantSchema: Schema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    grantId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    provider: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked'],
      default: 'active',
      required: true,
    },
    scopes: [{ type: String }],
    expiresAt: { type: Date },
    migratedAt: { type: Date },
  },
  { timestamps: true },
);

// Indexes for efficient queries
NylasGrantSchema.index({ userId: 1 }, { unique: true }); // Primary lookup by user
NylasGrantSchema.index({ grantId: 1 }, { unique: true }); // Nylas grant lookups
NylasGrantSchema.index({ companyId: 1, status: 1 }); // Company queries with status filter
NylasGrantSchema.index({ email: 1, companyId: 1 }); // Email lookups within company
NylasGrantSchema.index({ status: 1, expiresAt: 1 }); // Cleanup queries for expired grants

export const NylasGrant = mongoose.model<INylasGrant>('NylasGrant', NylasGrantSchema);
