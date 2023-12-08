import mongoose, { Document, Schema } from 'mongoose';

export interface ISession extends Document {
    userId: string;
    assistantId: string;
    threadId: string;
    active: boolean;
}

export const SessionSchema: Schema = new Schema({
    userId: { type: String, required: true },
    assistantId: { type: String, required: true },
    threadId: { type: String, required: true },
    active: { type: Boolean, required: true },
});

export const Session = mongoose.model<ISession>('Session', SessionSchema);

