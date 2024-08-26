import mongoose, { Document, Schema } from 'mongoose';
import { ChannelType } from '../types/ChannelType';

export interface ISession extends Document {
    userId: string;
    assistantId: string;
    threadId: string;
    active: boolean;
    companyId: string;
    channel: ChannelType;
    createdAt: Date;
}

export interface ISessionExtended extends ISession {
    userName?: string;
    assistantName?: string;
    companyName?: string;
}

export const SessionSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assistantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assistant' },
    threadId: { type: String, required: true },
    active: { type: Boolean, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    channel: { type: String, required: true, enum: Object.values(ChannelType), default: ChannelType.WEB },
    createdAt: { type: Date, default: Date.now },
});

SessionSchema.index({ companyId: 1, userId: 1, channel: 1 }, { unique: true, partialFilterExpression: { active: true } });
export const Session = mongoose.model<ISession>('Session', SessionSchema);