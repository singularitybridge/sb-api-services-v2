// file path: /src/models/Company.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IApiKey {
  key: string;
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
  api_keys: IApiKey[];
  onboardingStatus: OnboardingStatus;
  onboardedModules: string[];
}

const CompanySchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  api_keys: [ApiKeySchema],
  onboardingStatus: {
    type: String,
    enum: Object.values(OnboardingStatus),
    default: OnboardingStatus.CREATED,
  },
  onboardedModules: [{ type: String }],
});

export const Company = mongoose.model('Company', CompanySchema);
