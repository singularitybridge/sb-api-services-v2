/**
 * Nylas Webhook Model
 *
 * Tracks webhook subscriptions for each Nylas grant
 * Stores webhook configuration and delivery status
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INylasWebhook extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  nylasAccountId: Types.ObjectId;       // Reference to NylasAccount
  webhookId: string;                    // Nylas webhook ID
  triggerTypes: string[];               // ['calendar.created', 'message.created', ...]
  webhookUrl: string;                   // Our webhook receiver endpoint
  webhookSecret?: string;               // HMAC secret for validation
  status: 'active' | 'inactive' | 'error';
  lastDeliveryAt?: Date;                // Last successful webhook delivery
  lastError?: {
    message: string;
    occurredAt: Date;
    retryCount: number;
  };
  metadata?: {
    createdVia?: string;                // 'auto' | 'manual'
    notificationEmail?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const nylasWebhookSchema = new Schema<INylasWebhook>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    nylasAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'NylasAccount',
      required: true,
      index: true,
    },
    webhookId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    triggerTypes: {
      type: [String],
      required: true,
      default: [],
    },
    webhookUrl: {
      type: String,
      required: true,
    },
    webhookSecret: {
      type: String,
      select: false, // Don't return in queries by default
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'error'],
      default: 'active',
      index: true,
    },
    lastDeliveryAt: {
      type: Date,
    },
    lastError: {
      message: String,
      occurredAt: Date,
      retryCount: Number,
    },
    metadata: {
      createdVia: String,
      notificationEmail: String,
    },
  },
  {
    timestamps: true,
    collection: 'nylasWebhooks',
  }
);

// ==========================================
// Indexes
// ==========================================

// Compound index for webhook lookup
nylasWebhookSchema.index({ companyId: 1, status: 1 });
nylasWebhookSchema.index({ companyId: 1, nylasAccountId: 1 });

// Index for finding stale webhooks
nylasWebhookSchema.index({ status: 1, lastDeliveryAt: 1 });

// Unique constraint: one webhook per grant
nylasWebhookSchema.index(
  { nylasAccountId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

// ==========================================
// Static Methods (Functional)
// ==========================================

nylasWebhookSchema.statics.findActiveWebhooks = function (
  companyId: string
): Promise<INylasWebhook[]> {
  return this.find({
    companyId: new Types.ObjectId(companyId),
    status: 'active',
  }).populate('nylasAccountId');
};

nylasWebhookSchema.statics.findByWebhookId = function (
  webhookId: string
): Promise<INylasWebhook | null> {
  return this.findOne({ webhookId }).select('+webhookSecret');
};

nylasWebhookSchema.statics.markDeliverySuccess = function (
  webhookId: string
): Promise<any> {
  return this.findOneAndUpdate(
    { webhookId },
    {
      $set: {
        lastDeliveryAt: new Date(),
        status: 'active',
      },
      $unset: { lastError: '' },
    },
    { new: true }
  );
};

nylasWebhookSchema.statics.markDeliveryFailure = function (
  webhookId: string,
  errorMessage: string
): Promise<any> {
  return this.findOneAndUpdate(
    { webhookId },
    {
      $set: {
        status: 'error',
        lastError: {
          message: errorMessage,
          occurredAt: new Date(),
          retryCount: 1, // TODO: Implement retry counter increment
        },
      },
    },
    { new: true }
  );
};

// ==========================================
// Instance Methods (Functional)
// ==========================================

nylasWebhookSchema.methods.deactivate = function (): Promise<INylasWebhook> {
  this.status = 'inactive';
  return this.save();
};

nylasWebhookSchema.methods.activate = function (): Promise<INylasWebhook> {
  this.status = 'active';
  this.lastError = undefined;
  return this.save();
};

// ==========================================
// Export
// ==========================================

export const NylasWebhook = mongoose.model<INylasWebhook>(
  'NylasWebhook',
  nylasWebhookSchema
);
