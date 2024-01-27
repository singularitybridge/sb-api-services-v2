import mongoose, { Document, Schema } from 'mongoose';

export interface IAction extends Document {
  name: string;
  description: string;
  type: string;
  parameters: string;
}

const ActionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  type: { type: String, required: true },
  parameters: { type: String },
});

export const Action = mongoose.model('Action', ActionSchema);
