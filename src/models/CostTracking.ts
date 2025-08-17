import mongoose, { Document, Schema } from 'mongoose';

export interface ICostTracking extends Document {
  companyId: mongoose.Types.ObjectId;
  assistantId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  provider: 'openai' | 'anthropic' | 'google';
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  duration: number; // in milliseconds
  toolCalls: number;
  cached: boolean;
  requestType: 'streaming' | 'non-streaming' | 'stateless';
  timestamp: Date;
  metadata?: Record<string, any>;
}

const CostTrackingSchema: Schema = new Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    assistantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assistant',
      required: true,
      index: true,
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: false,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['openai', 'anthropic', 'google'],
      required: true,
    },
    modelName: {
      type: String,
      required: true,
      index: true,
    },
    inputTokens: {
      type: Number,
      required: true,
      default: 0,
    },
    outputTokens: {
      type: Number,
      required: true,
      default: 0,
    },
    totalTokens: {
      type: Number,
      required: true,
      default: 0,
    },
    inputCost: {
      type: Number,
      required: true,
      default: 0,
    },
    outputCost: {
      type: Number,
      required: true,
      default: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      default: 0,
    },
    duration: {
      type: Number,
      required: true,
      default: 0,
    },
    toolCalls: {
      type: Number,
      required: false,
      default: 0,
    },
    cached: {
      type: Boolean,
      required: false,
      default: false,
    },
    requestType: {
      type: String,
      enum: ['streaming', 'non-streaming', 'stateless'],
      default: 'non-streaming',
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  },
);

// Compound indexes for efficient queries
CostTrackingSchema.index({ companyId: 1, timestamp: -1 });
CostTrackingSchema.index({ companyId: 1, assistantId: 1, timestamp: -1 });
CostTrackingSchema.index({ companyId: 1, modelName: 1, timestamp: -1 });
CostTrackingSchema.index({ companyId: 1, provider: 1, timestamp: -1 });

export const CostTracking = mongoose.model<ICostTracking>(
  'CostTracking',
  CostTrackingSchema,
);
