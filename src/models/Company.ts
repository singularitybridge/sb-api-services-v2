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

export interface ICompany extends Document {
  name: string;
  description?: string;
  token?: Token;
  api_keys: IApiKey[];
  identifiers: IIdentifier[];
}


const CompanySchema = new Schema({
  name: { type: String, required: true },
  description: { type: String },
  token: TokenSchema,
  api_keys: [ApiKeySchema],
  identifiers: { type: [IdentifierSchema], required: true },
});

CompanySchema.index(
  { 'identifiers.type': 1, 'identifiers.value': 1 },
  { unique: true },
);

export const Company = mongoose.model('Company', CompanySchema);
