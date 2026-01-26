import mongoose, { Document, Schema } from 'mongoose';

export interface ITeam extends Document {
  name: string;
  description?: string;
  icon?: string;
  iconType?: 'emoji' | 'lucide' | 'workspace'; // Type of icon: emoji, Lucide component name, or workspace path
  companyId: mongoose.Schema.Types.ObjectId;
}

const TeamSchema: Schema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: false, default: '' },
  icon: { type: String, required: false },
  iconType: {
    type: String,
    enum: ['emoji', 'lucide', 'workspace'],
    default: 'emoji',
    required: false,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
  },
});

export const Team = mongoose.model<ITeam>('Team', TeamSchema);
