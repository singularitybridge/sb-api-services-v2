import mongoose, { Document, Schema } from 'mongoose';
import { IIdentifier, IdentifierSchema } from './Assistant';

export interface IUser extends Document {
    name: string;
    nickname: string;
    identifiers: IIdentifier[];
    companyId: string;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    nickname: { type: String, required: true },
    identifiers: { type: [IdentifierSchema], required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
});

UserSchema.index({ 'identifiers.type': 1, 'identifiers.value': 1 }, { unique: true });
export const User = mongoose.model<IUser>('User', UserSchema);

