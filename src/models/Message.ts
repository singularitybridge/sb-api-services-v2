import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  sessionId: mongoose.Types.ObjectId;
  sender: 'user' | 'assistant' | 'system' | 'agent';
  content?: string; // Optional for non-text messages
  timestamp: Date;
  assistantId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  messageType: string; // Now a flexible string
  data?: any; // Additional data for custom message types
  openAIMessageId?: string;
}

const MessageSchema: Schema = new Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  sender: { type: String, enum: ['user', 'assistant', 'system', 'agent'], required: true },
  content: { type: String }, // Now optional
  timestamp: { type: Date, default: Date.now },
  assistantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assistant', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  messageType: { type: String, required: true },
  data: { type: Schema.Types.Mixed }, // Can store any type of data
  openAIMessageId: { type: String },
});

export const Message = mongoose.model<IMessage>('Message', MessageSchema);