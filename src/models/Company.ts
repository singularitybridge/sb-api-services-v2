// src/models/Company.ts

import mongoose from 'mongoose';

export interface ICompany extends mongoose.Document {
    name: string;
    description: string;
    openai_api_key: string;
}

const CompanySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    openai_api_key: { type: String, required: true },
});

export const Company = mongoose.model('Company', CompanySchema);