import mongoose, { Document, Schema } from 'mongoose';

interface IAssistant extends Document {
    assistantId: string;
    currentThreadId: string;
}

const AssistantSchema: Schema = new Schema({
    assistantId: { type: String, required: true },
    currentThreadId: { type: String, required: true },
});

const Assistant = mongoose.model<IAssistant>('Assistant', AssistantSchema);

export default Assistant;