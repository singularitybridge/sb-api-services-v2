// file path: /src/models/IntegrationConfig.ts
import mongoose, { Document, Schema } from 'mongoose';

/**
 * Represents an encrypted API key stored within an integration config.
 * Reuses the same encryption format as Company.api_keys for consistency.
 */
export interface IIntegrationApiKey {
  key: string; // Key identifier (e.g., "jira_api_token", "jira_domain")
  value: string; // Encrypted value
  iv: string; // Initialization vector for AES-256-GCM
  tag: string; // Authentication tag for AES-256-GCM
}

/**
 * Integration configuration for a company.
 * Each company can have its own configuration per integration,
 * storing API keys and settings specific to that integration.
 */
export interface IIntegrationConfig extends Document {
  companyId: mongoose.Types.ObjectId;
  integrationId: string; // e.g., "jira", "openai", "elevenlabs"
  apiKeys: IIntegrationApiKey[];
  enabled: boolean;
  configuredAt: Date;
  configuredBy?: mongoose.Types.ObjectId; // User who configured
  updatedAt: Date;
  createdAt: Date;
}

const IntegrationApiKeySchema = new Schema(
  {
    key: { type: String, required: true },
    value: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
  },
  { _id: false },
);

const IntegrationConfigSchema = new Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    integrationId: {
      type: String,
      required: true,
      index: true,
    },
    apiKeys: {
      type: [IntegrationApiKeySchema],
      default: [],
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    configuredAt: {
      type: Date,
      default: Date.now,
    },
    configuredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true },
);

// Compound unique index: one config per company per integration
IntegrationConfigSchema.index(
  { companyId: 1, integrationId: 1 },
  { unique: true },
);

// Index for querying all configs for a company
IntegrationConfigSchema.index({ companyId: 1 });

export const IntegrationConfig = mongoose.model<IIntegrationConfig>(
  'IntegrationConfig',
  IntegrationConfigSchema,
);
