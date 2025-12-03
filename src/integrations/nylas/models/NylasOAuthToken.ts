/**
 * Nylas OAuth Token Model
 *
 * Stores temporary authentication tokens for OAuth callback flow.
 * These tokens are used when users are redirected back from Nylas OAuth.
 *
 * This model is integration-specific and keeps OAuth state management
 * isolated from the core User model.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INylasOAuthToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  createdAt: Date;
  expiresAt: Date;
}

const NylasOAuthTokenSchema = new Schema<INylasOAuthToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index - automatically delete expired tokens after 1 hour
NylasOAuthTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for efficient token lookups
NylasOAuthTokenSchema.index({ token: 1, userId: 1 });

export const NylasOAuthToken: Model<INylasOAuthToken> =
  mongoose.models.NylasOAuthToken ||
  mongoose.model<INylasOAuthToken>('NylasOAuthToken', NylasOAuthTokenSchema);
