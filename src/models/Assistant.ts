import mongoose, { Document, Schema } from 'mongoose';

export interface IIdentifier {
  key: string;
  value: string;
}

export const IdentifierSchema: Schema = new Schema({
  key: { type: String, required: true },
  value: { type: String, required: true },
});

export interface IAssistant extends Document {
  assistantId: string;
  name: string;
  description: string;
  conversationStarters: IIdentifier[];
  voice: string;
  language: string;
  llmModel: string;
  llmPrompt: string;
  companyId: string;
  allowedActions: string[];
  avatarImage?: string;
}

const AssistantSchema: Schema = new Schema({
  assistantId: { type: String, required: false },
  name: { type: String, required: true },
  description: { type: String, required: true },
  conversationStarters: { type: [IdentifierSchema], required: true, default: [] },
  voice: { type: String, required: true },
  language: { type: String, required: true },
  llmModel: { type: String, required: false },
  llmPrompt: { type: String, required: false },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  allowedActions: [{ type: String, required: false }],
  avatarImage: { type: String, required: false, default: 'default-avatar' },
});

export const Assistant = mongoose.model<IAssistant>(
  'Assistant',
  AssistantSchema,
);
