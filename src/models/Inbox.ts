import mongoose, { Document, Schema } from 'mongoose';

export interface IInbox extends Document {
  sessionId: mongoose.Schema.Types.ObjectId;
  // as assistant may change during a session, we need to store the assistantId
  assistantId: mongoose.Schema.Types.ObjectId;
  message: string;
  created: Date;
}

const InboxSchema: Schema = new Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true,
  },
  assistantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assistant',
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

export const Inbox = mongoose.model<IInbox>('Inbox', InboxSchema);
