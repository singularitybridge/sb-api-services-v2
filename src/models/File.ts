import mongoose, { Schema, Document } from 'mongoose';

export interface IFile extends Document {
  assistantId: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  openaiFileId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FileSchema: Schema = new Schema(
  {
    assistantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assistant',
      required: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    openaiFileId: {
      type: String,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster lookups
FileSchema.index({ assistantId: 1 });
FileSchema.index({ openaiFileId: 1 });

export const File = mongoose.model<IFile>('File', FileSchema);
