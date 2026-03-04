import mongoose, { Document, Schema } from 'mongoose';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ITaskCallback {
  type: 'execute_agent' | 'integration_action' | 'webhook';
  agentId?: string;
  input?: string;
  integration?: string;
  action?: string;
  params?: Record<string, any>;
  url?: string;
  headers?: Record<string, string>;
}

export interface ITask extends Document {
  groupId: string;
  creatorAgentId: string;
  handlerAgentId: string;
  companyId: string;
  input: string;
  output?: any;
  status: TaskStatus;
  retryCount: number;
  maxRetries: number;
  error?: string;
  onGroupComplete?: ITaskCallback;
  metadata?: Record<string, any>;
  retryAfter?: Date;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

const TaskCallbackSchema = new Schema(
  {
    type: { type: String, enum: ['execute_agent', 'integration_action', 'webhook'], required: true },
    agentId: { type: String },
    input: { type: String },
    integration: { type: String },
    action: { type: String },
    params: { type: Schema.Types.Mixed },
    url: { type: String },
    headers: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const TaskSchema: Schema = new Schema({
  groupId: { type: String, required: true, index: true },
  creatorAgentId: { type: String, required: true, index: true },
  handlerAgentId: { type: String, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  input: { type: String, required: true },
  output: { type: Schema.Types.Mixed },
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 2 },
  error: { type: String },
  onGroupComplete: { type: TaskCallbackSchema },
  metadata: { type: Schema.Types.Mixed },
  retryAfter: { type: Date },
  createdAt: { type: Date, default: Date.now },
  startedAt: { type: Date },
  completedAt: { type: Date },
});

// Compound index for the task runner: find pending tasks efficiently
TaskSchema.index({ status: 1, createdAt: 1 });

// TTL index: auto-delete completed/failed tasks after 7 days
TaskSchema.index({ completedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { completedAt: { $exists: true } } });

export const Task = mongoose.model<ITask>('Task', TaskSchema);
