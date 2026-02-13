import mongoose, { Document, Schema } from 'mongoose';

export interface IIdentifier {
  key: string;
  value: string;
}

export const IdentifierSchema: Schema = new Schema({
  key: { type: String, required: true },
  value: { type: String, required: false, default: '' },
});

export interface IAssistant extends Document {
  assistantId: string;
  name: string;
  description: string;
  conversationStarters: IIdentifier[];
  llmModel: string; // Existing field, will now be the primary model identifier
  llmPrompt: string;
  llmProvider: 'openai' | 'google' | 'anthropic'; // New field for provider
  maxTokens?: number; // Token limit for input/prompt window
  companyId: string;
  allowedActions: string[];
  avatarImage?: string;
  teams?: mongoose.Schema.Types.ObjectId[];
  lastAccessedAt?: Date;
  sessionTtlHours?: number;
}

const AssistantSchema: Schema = new Schema({
  assistantId: { type: String, required: false },
  name: { type: String, required: true },
  description: { type: String, required: false },
  conversationStarters: {
    type: [IdentifierSchema],
    required: true,
    default: [],
  },
  llmModel: { type: String, required: false }, // Existing field, will store model name like 'gpt-4.1-mini'
  llmPrompt: { type: String, required: false },
  llmProvider: {
    // New field for provider
    type: String,
    enum: ['openai', 'google', 'anthropic'],
    default: 'openai', // Default provider
    required: true,
  },
  maxTokens: { type: Number, required: false, default: 25000 }, // Default to 25k tokens
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  allowedActions: [{ type: String, required: false }],
  avatarImage: { type: String, required: false, default: 'default-avatar' },
  teams: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: false },
  ],
  lastAccessedAt: { type: Date, required: false },
  sessionTtlHours: { type: Number, required: false },
});

// Note: maxOutputTokens was renamed to maxTokens
// Virtual properties removed to avoid TypeScript compilation issues

export const Assistant = mongoose.model<IAssistant>(
  'Assistant',
  AssistantSchema,
);
