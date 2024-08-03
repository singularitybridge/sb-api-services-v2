import mongoose, { Document, Schema } from 'mongoose';

export interface IInbox extends Document {
  sessionId: mongoose.Schema.Types.ObjectId;
  senderId: mongoose.Schema.Types.ObjectId;
  companyId: mongoose.Schema.Types.ObjectId;
  type: 'human_agent_request' | 'human_agent_response' | 'notification';
  status: 'open' | 'in_progress' | 'closed';
  message: string;
  createdAt: Date;
}

const InboxSchema: Schema = new Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assistant',
    required: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
  type: {
    type: String,
    enum: ['human_agent_request', 'human_agent_response', 'notification'],
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'closed'],
    default: 'open',
  },
  message: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const Inbox = mongoose.model<IInbox>('Inbox', InboxSchema);