import mongoose, { Document, Schema } from 'mongoose';
import { IIdentifier, IdentifierSchema } from './Assistant';

export interface ICompany extends Document {
    name: string;
    description: string;
    openai_api_key: string;
    identifiers: IIdentifier[];
}

const CompanySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    openai_api_key: { type: String, required: true },
    identifiers: { type: [IdentifierSchema], required: true },
});

CompanySchema.index({ 'identifiers.type': 1, 'identifiers.value': 1 }, { unique: true });
export const Company = mongoose.model('Company', CompanySchema);