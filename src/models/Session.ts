import mongoose, { Document, Schema } from 'mongoose';

export interface ISession extends Document {
  userId: string;
  assistantId: string;
  threadId: string;
  active: boolean;
  companyId: string;
  createdAt: Date;
  lastActivityAt: Date;
  channel: string;
  channelUserId: string;
  channelMetadata?: Record<string, any>;
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
  createdAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now },
  channel: { type: String, default: 'web', index: true },
  channelUserId: { type: String, default: '' },
  channelMetadata: { type: Schema.Types.Mixed },
});

SessionSchema.index(
  { companyId: 1, userId: 1, channel: 1, channelUserId: 1, assistantId: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
export const Session = mongoose.model<ISession>('Session', SessionSchema);
