/**
 * Contact Group Model (Simplified)
 *
 * Represents a group/label for organizing contacts.
 * Contacts can belong to multiple groups via ContactMetadata.groups array.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IContactGroup extends Document {
  name: string;
  description?: string;
  companyId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  memberCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  updateMemberCount(): Promise<void>;
}

const ContactGroupSchema = new Schema<IContactGroup>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    memberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'contact_groups',
  }
);

// Indexes for common queries
ContactGroupSchema.index({ companyId: 1, isDeleted: 1 });
ContactGroupSchema.index({ companyId: 1, name: 1 });

// Instance method to update member count
ContactGroupSchema.methods.updateMemberCount = async function(): Promise<void> {
  const ContactMetadata = mongoose.model('ContactMetadata');

  const count = await ContactMetadata.countDocuments({
    groups: this._id,
    isDeleted: false,
  });

  this.memberCount = count;
};

export const ContactGroup = mongoose.model<IContactGroup>(
  'ContactGroup',
  ContactGroupSchema
);
