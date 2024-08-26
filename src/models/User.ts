// file_path: src/models/User.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  googleId?: string;
  email: string;
  companyId: mongoose.Types.ObjectId;
  role: 'Admin' | 'CompanyUser';
  identifiers: { key: string; value: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  googleId: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  role: { type: String, enum: ['Admin', 'CompanyUser'], default: 'CompanyUser' },
  identifiers: [{ key: String, value: String }],
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);