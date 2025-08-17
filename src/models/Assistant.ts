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
  llmModel: string; // Existing field, will now be the primary model identifier
  llmPrompt: string;
  llmProvider: 'openai' | 'google' | 'anthropic'; // New field for provider
  maxOutputTokens?: number; // New field for token limit
  companyId: string;
  allowedActions: string[];
  avatarImage?: string;
  teams?: mongoose.Schema.Types.ObjectId[];
  lastAccessedAt?: Date;
}

const AssistantSchema: Schema = new Schema({
  assistantId: { type: String, required: false },
  name: { type: String, required: true },
  description: { type: String, required: true },
  conversationStarters: {
    type: [IdentifierSchema],
    required: true,
    default: [],
  },
  voice: { type: String, required: true },
  language: { type: String, required: true },
  llmModel: { type: String, required: false }, // Existing field, will store model name like 'gpt-4.1-mini'
  llmPrompt: { type: String, required: false },
  llmProvider: {
    // New field for provider
    type: String,
    enum: ['openai', 'google', 'anthropic'],
    default: 'openai', // Default provider
    required: true,
  },
  maxOutputTokens: { type: Number, required: false, default: 25000 }, // Default to 25k tokens
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  allowedActions: [{ type: String, required: false }],
  avatarImage: { type: String, required: false, default: 'default-avatar' },
  teams: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: false },
  ],
  lastAccessedAt: { type: Date, required: false },
});

// Virtual property for backwards compatibility with 'maxTokens'
AssistantSchema.virtual('maxTokens')
  .get(function () {
    return this.maxOutputTokens;
  })
  .set(function (value: number) {
    this.maxOutputTokens = value;
  });

// Ensure virtual fields are included in JSON output
AssistantSchema.set('toJSON', {
  virtuals: true,
  transform: function (doc, ret) {
    // Optional: Remove maxTokens from output to avoid confusion
    // delete ret.maxTokens;
    return ret;
  },
});

export const Assistant = mongoose.model<IAssistant>(
  'Assistant',
  AssistantSchema,
);
