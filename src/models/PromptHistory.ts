import mongoose, { Schema, Document } from 'mongoose';

export interface IPromptHistory extends Document {
  assistantId: mongoose.Types.ObjectId;
  companyId: mongoose.Types.ObjectId;
  version: number;
  promptContent: string;
  changeType: 'initial' | 'update' | 'rollback';
  changeDescription: string;
  previousVersion?: number;
  userId?: mongoose.Types.ObjectId;
  metadata?: {
    characterCount?: number;
    lineCount?: number;
    tokenEstimate?: number;
    tags?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const PromptHistorySchema = new Schema<IPromptHistory>(
  {
    assistantId: {
      type: Schema.Types.ObjectId,
      ref: 'Assistant',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    promptContent: {
      type: String,
      required: true,
    },
    changeType: {
      type: String,
      enum: ['initial', 'update', 'rollback'],
      required: true,
      default: 'update',
    },
    changeDescription: {
      type: String,
      required: true,
    },
    previousVersion: {
      type: Number,
      required: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    metadata: {
      characterCount: Number,
      lineCount: Number,
      tokenEstimate: Number,
      tags: [String],
    },
  },
  {
    timestamps: true,
    collection: 'prompt_history',
  },
);

// Compound indexes for efficient queries
PromptHistorySchema.index({ assistantId: 1, version: -1 });
PromptHistorySchema.index({ assistantId: 1, createdAt: -1 });
PromptHistorySchema.index({ companyId: 1, createdAt: -1 });

// Ensure unique version per assistant
PromptHistorySchema.index({ assistantId: 1, version: 1 }, { unique: true });

// Virtual for estimating token count (rough estimate)
PromptHistorySchema.virtual('estimatedTokens').get(function () {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(this.promptContent.length / 4);
});

// Pre-save middleware to calculate metadata
PromptHistorySchema.pre('save', function (next) {
  if (this.isModified('promptContent')) {
    this.metadata = {
      characterCount: this.promptContent.length,
      lineCount: this.promptContent.split('\n').length,
      tokenEstimate: Math.ceil(this.promptContent.length / 4),
      tags: this.metadata?.tags || [],
    };
  }
  next();
});

const PromptHistory = mongoose.model<IPromptHistory>(
  'PromptHistory',
  PromptHistorySchema,
);

export default PromptHistory;
