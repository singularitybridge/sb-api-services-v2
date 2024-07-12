/// file_path: src/models/User.ts
import mongoose, { Document, Schema } from 'mongoose';
import { IIdentifier, IdentifierSchema } from './Assistant';

export interface IUser extends Document {
    name: string;
    email: string;
    nickname?: string;
    role: string;
    identifiers: IIdentifier[];
    companyId: string;
    googleId?: string;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    nickname: { type: String },
    role: { type: String, required: true },
    identifiers: { type: [IdentifierSchema], required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    googleId: { type: String, required: true, unique: true }
});

UserSchema.index({ 'identifiers.type': 1, 'identifiers.value': 1 }, { unique: true });
export const User = mongoose.model<IUser>('User', UserSchema);
