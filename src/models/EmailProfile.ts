/**
 * Email Profile Model
 *
 * Abstraction layer for email identities that AI agents can use
 * Multiple profiles can point to the same Nylas account
 * Provides role-based access and organizational context
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmailProfile extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  nylasAccountId: Types.ObjectId;
  label: string;
  fromEmail: string;
  fromName?: string;
  replyToEmail?: string;
  defaultCalendarId?: string;
  role: 'admin' | 'team' | 'personal' | 'shared';
  tags: string[];
  settings?: {
    autoReply?: boolean;
    signature?: string;
    timezone?: string;
    workingHours?: {
      start: string;
      end: string;
      days: number[];
    };
    [key: string]: any;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emailProfileSchema = new Schema<IEmailProfile>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    nylasAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'NylasAccount',
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    fromEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    fromName: {
      type: String,
      trim: true,
    },
    replyToEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    defaultCalendarId: {
      type: String,
    },
    role: {
      type: String,
      enum: ['admin', 'team', 'personal', 'shared'],
      default: 'team',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
emailProfileSchema.index({ companyId: 1, role: 1, isActive: 1 });
emailProfileSchema.index({ companyId: 1, tags: 1 });
emailProfileSchema.index({ nylasAccountId: 1, isActive: 1 });

// Virtual for Nylas account details
emailProfileSchema.virtual('nylasAccount', {
  ref: 'NylasAccount',
  localField: 'nylasAccountId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for team memberships
emailProfileSchema.virtual('teamMemberships', {
  ref: 'TeamMember',
  localField: '_id',
  foreignField: 'emailProfileId',
});

export const EmailProfile = mongoose.model<IEmailProfile>(
  'EmailProfile',
  emailProfileSchema
);
