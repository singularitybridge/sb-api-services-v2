import mongoose, { Document, Schema } from 'mongoose';

export interface ISession extends Document {
    userId: string;
    assistantId: string;
    threadId: string;
    active: boolean;
    companyId: string;
}

export const SessionSchema: Schema = new Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assistantId: { type: String, required: true },
    threadId: { type: String, required: true },
    active: { type: Boolean, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
});

export const Session = mongoose.model<ISession>('Session', SessionSchema);

