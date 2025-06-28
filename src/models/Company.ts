// file path: /src/models/Company.ts
import mongoose, { Document, Schema } from 'mongoose';
import { IIdentifier, IdentifierSchema } from './Assistant';

export interface IApiKey {
  key: string;
  value: string;
  iv?: string;
  tag?: string;
}

export interface Token {
  value: string;
  iv?: string;
  tag?: string;
}

const ApiKeySchema = new Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
  iv: { type: String, required: true },
  tag: { type: String, required: true },
});

const TokenSchema = new Schema({
  value: { type: String, required: true },
  iv: { type: String, required: true },
  tag: { type: String, required: true },
});

export enum OnboardingStatus {
  CREATED = 'created',
  API_KEY_REQUIRED = 'api_key_required',
  READY_FOR_ASSISTANTS = 'ready_for_assistants',
  USING_BASIC_FEATURES = 'using_basic_features',
  ADVANCED_USER = 'advanced_user',
  EXPERT_USER = 'expert_user',
}

export interface ICompany extends Document {
  name: string;
  description?: string | null;
  token?: Token;
  api_keys: IApiKey[];
  identifiers?: IIdentifier[]; // Made optional
  onboardingStatus: OnboardingStatus;
  onboardedModules: string[];
}

const CompanySchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  token: TokenSchema,
  api_keys: [ApiKeySchema],
  identifiers: { type: [IdentifierSchema], required: false }, // Made optional
  onboardingStatus: {
    type: String,
    enum: Object.values(OnboardingStatus),
    default: OnboardingStatus.CREATED,
  },
  onboardedModules: [{ type: String }],
});

// Update the index to allow null values and make it sparse
CompanySchema.index(
  { 'identifiers.type': 1, 'identifiers.value': 1 },
  { unique: true, sparse: true },
);

export const Company = mongoose.model('Company', CompanySchema);
