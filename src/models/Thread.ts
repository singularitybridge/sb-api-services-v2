import mongoose, { Document, Schema } from 'mongoose';

interface IThread extends Document {
    userId: mongoose.Types.ObjectId;
    assistantId: string;
    isActive: boolean;
}

const ThreadSchema: Schema = new Schema({
    userId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    assistantId: { type: String, required: true },
    isActive: { type: Boolean, default: true },
});

const Thread = mongoose.model<IThread>('Thread', ThreadSchema);

export default Thread;