import mongoose, { Document, Schema } from 'mongoose';

export interface IIdentifier {
    key: string;
    value: string;
}

export interface IAssistant extends Document {
    assistantId: string;
    name: string;
    description: string;
    introMessage: string;
    voice: string;
    language: string;
    identifiers: IIdentifier[];
    llmModel: string;
    llmPrompt: string;    
}

export const IdentifierSchema: Schema = new Schema({
    key: { type: String, required: true },
    value: { type: String, required: true },
});

const AssistantSchema: Schema = new Schema({
    assistantId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    introMessage: { type: String, required: true },
    voice: { type: String, required: true },
    language: { type: String, required: true },
    identifiers: { type: [IdentifierSchema], required: true },
    llmModel: { type: String, required: false },
    llmPrompt: { type: String, required: false }
});

AssistantSchema.index({ 'identifiers.type': 1, 'identifiers.value': 1 }, { unique: true });
export const Assistant = mongoose.model<IAssistant>('Assistant', AssistantSchema);

