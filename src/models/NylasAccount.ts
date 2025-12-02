/**
 * Nylas Account Model
 *
 * Represents a connected email/calendar account (Nylas Grant)
 * Supports per-user grants for multi-user admin access
 *
 * Key Features:
 * - Maps userId to Nylas grantId (one account per user)
 * - Enables admin cross-user access (admin can access other users' data)
 * - Tracks connection status and last validation
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INylasAccount extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // NEW: Link to User who owns this grant
  companyId: Types.ObjectId;
  nylasGrantId: string;
  provider: 'google' | 'microsoft' | 'imap' | 'yahoo';
  emailAddress: string;
  displayName?: string;
  defaultCalendarId?: string;
  scopes: string[];
  status: 'active' | 'revoked' | 'error' | 'pending';
  isActive: boolean; // NEW: Soft delete flag
  lastSyncedAt?: Date; // NEW: Track last data sync
  lastValidatedAt?: Date; // NEW: Track last connection validation
  metadata?: {
    organizationUnit?: string;
    timezone?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;

  // NEW: Instance methods
  updateLastSynced(): Promise<this>;
  validateConnection(): Promise<this>;
  disconnect(): Promise<this>;
}

const nylasAccountSchema = new Schema<INylasAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    nylasGrantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['google', 'microsoft', 'imap', 'yahoo'],
      required: true,
    },
    emailAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    defaultCalendarId: {
      type: String,
    },
    scopes: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'revoked', 'error', 'pending'],
      default: 'active',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastSyncedAt: {
      type: Date,
    },
    lastValidatedAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
nylasAccountSchema.index({ userId: 1, isActive: 1 });
nylasAccountSchema.index({ companyId: 1, status: 1, isActive: 1 });
nylasAccountSchema.index({ companyId: 1, emailAddress: 1 });
nylasAccountSchema.index({ emailAddress: 1, companyId: 1, isActive: 1 });

// Unique constraint: One active account per user
nylasAccountSchema.index(
  { userId: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
    name: 'unique_active_user_account',
  }
);

// Virtual for referencing email profiles
nylasAccountSchema.virtual('emailProfiles', {
  ref: 'EmailProfile',
  localField: '_id',
  foreignField: 'nylasAccountId',
});

// Virtual for user details
nylasAccountSchema.virtual('user', {
  ref: 'User',
  localField: 'userId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for company details
nylasAccountSchema.virtual('company', {
  ref: 'Company',
  localField: 'companyId',
  foreignField: '_id',
  justOne: true,
});

// Instance methods
nylasAccountSchema.methods.updateLastSynced = function () {
  this.lastSyncedAt = new Date();
  return this.save();
};

nylasAccountSchema.methods.validateConnection = async function () {
  // TODO: Make actual Nylas API call to verify grant is still valid
  // For now, just update the timestamp
  this.lastValidatedAt = new Date();
  return this.save();
};

nylasAccountSchema.methods.disconnect = function () {
  this.status = 'revoked';
  this.isActive = false;
  return this.save();
};

export const NylasAccount = mongoose.model<INylasAccount>(
  'NylasAccount',
  nylasAccountSchema
);
