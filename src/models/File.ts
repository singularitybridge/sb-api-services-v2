// file path: src/models/File.ts
import mongoose, { Document, Schema } from 'mongoose';

export interface IFile extends Document {
  filename: string;
  title: string;
  description?: string;
  mimeType: string;
  size: number;
  openaiFileId: string;
  assistantId: string;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema: Schema = new Schema(
  {
    filename: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    openaiFileId: { type: String, required: true },
    assistantId: {
      type: Schema.Types.ObjectId,
      ref: 'Assistant',
      required: true,
    },
  },
  { timestamps: true },
);

export const File = mongoose.model<IFile>('File', FileSchema);
