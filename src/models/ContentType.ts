import mongoose, { Document, Schema } from 'mongoose';

export interface IFieldDefinition {
  name: string;
  type: string;
  required?: boolean;
  default?: any;
  enum?: any[];
}

export interface IContentType extends Document {
  companyId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  fields: IFieldDefinition[];
  createdAt: Date;
  updatedAt: Date;
}

const FieldDefinitionSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  required: { type: Boolean, default: false },
  default: { type: Schema.Types.Mixed },
  enum: [{ type: Schema.Types.Mixed }],
});

const ContentTypeSchema: Schema = new Schema(
  {
    companyId: { type: mongoose.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true },
    description: { type: String },
    fields: { type: [FieldDefinitionSchema], required: true },
  },
  { timestamps: true }
);

ContentTypeSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const ContentType = mongoose.model<IContentType>('ContentType', ContentTypeSchema);