import mongoose, { Document, Schema } from 'mongoose';
import { IIdentifier, IdentifierSchema } from './Assistant';

export interface ICompany extends Document {
  [key: string]: any;
  name: string;
  description: string;
  openai_api_key: string;
  gcp_key: string;
  labs11_api_key: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  notion_api_key: string;
  identifiers: IIdentifier[];
}

// type EncryptedKeyValues = {
//   openai_api_key?: string;
//   gcp_key?: string;
//   notion_api_key?: string;
//   labs11_api_key?: string;
//   twilio_account_sid?: string;
//   twilio_auth_token?: string;
// };

// export interface ICompany extends Document, EncryptedKeyValues {
//   name: string;
//   description: string;
//   identifiers: IIdentifier[];
// }

const CompanySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  openai_api_key: {
    encrypted: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
  },
  gcp_key: {
    encrypted: { type: String },
    iv: { type: String },
    tag: { type: String },
  },
  notion_api_key: {
    encrypted: { type: String },
    iv: { type: String },
    tag: { type: String },
  },
  labs11_api_key: {
    encrypted: { type: String },
    iv: { type: String },
    tag: { type: String },
  },
  twilio_account_sid: {
    encrypted: { type: String },
    iv: { type: String },
    tag: { type: String },
  },
  twilio_auth_token: {
    encrypted: { type: String },
    iv: { type: String },
    tag: { type: String },
  },
  identifiers: { type: [IdentifierSchema], required: true },
});

CompanySchema.index(
  { 'identifiers.type': 1, 'identifiers.value': 1 },
  { unique: true },
);
export const Company = mongoose.model('Company', CompanySchema);
