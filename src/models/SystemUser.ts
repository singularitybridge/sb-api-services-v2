import mongoose, { Document, Schema } from 'mongoose';

export interface ISystemUser extends Document {
    name: string;
    email: string;
    companyId: string;
    googleId: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const SystemUserSchema: Schema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company'},
    googleId: { type: String, required: true, unique: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export const SystemUser = mongoose.model<ISystemUser>('SystemUser', SystemUserSchema);