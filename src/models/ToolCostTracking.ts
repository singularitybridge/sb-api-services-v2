import mongoose, { Document, Schema } from 'mongoose';

export interface IToolCostTracking extends Document {
  companyId: mongoose.Types.ObjectId;
  assistantId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  provider: string;
  service: string;
  actionId: string;
  modelName?: string;
  cost: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  units?: number;
  unitType?: string;
  timestamp: Date;
}

const ToolCostTrackingSchema: Schema = new Schema(
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
      required: false,
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
      required: false,
    },
    provider: {
      type: String,
      required: true,
      index: true,
    },
    service: {
      type: String,
      required: true,
    },
    actionId: {
      type: String,
      required: true,
    },
    modelName: {
      type: String,
      required: false,
    },
    cost: {
      type: Number,
      required: true,
      default: 0,
    },
    inputTokens: {
      type: Number,
      required: false,
    },
    outputTokens: {
      type: Number,
      required: false,
    },
    totalTokens: {
      type: Number,
      required: false,
    },
    units: {
      type: Number,
      required: false,
    },
    unitType: {
      type: String,
      required: false,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

ToolCostTrackingSchema.index({ companyId: 1, timestamp: -1 });
ToolCostTrackingSchema.index({ companyId: 1, provider: 1, timestamp: -1 });
ToolCostTrackingSchema.index({ companyId: 1, assistantId: 1, timestamp: -1 });
ToolCostTrackingSchema.index({ companyId: 1, sessionId: 1, timestamp: -1 });

export const ToolCostTracking = mongoose.model<IToolCostTracking>(
  'ToolCostTracking',
  ToolCostTrackingSchema,
);
