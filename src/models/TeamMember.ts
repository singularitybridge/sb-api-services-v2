/**
 * Team Member Model
 *
 * Junction table linking Teams to Email Profiles
 * Enables many-to-many relationships for multi-user orchestration
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITeamMember extends Document {
  _id: Types.ObjectId;
  teamId: Types.ObjectId;
  emailProfileId: Types.ObjectId;
  role: 'member' | 'lead' | 'manager' | 'admin';
  isActive: boolean;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const teamMemberSchema = new Schema<ITeamMember>(
  {
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    emailProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'EmailProfile',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['member', 'lead', 'manager', 'admin'],
      default: 'member',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
teamMemberSchema.index({ teamId: 1, emailProfileId: 1 }, { unique: true });
teamMemberSchema.index({ teamId: 1, isActive: 1 });
teamMemberSchema.index({ emailProfileId: 1, isActive: 1 });

// Virtual for team details
teamMemberSchema.virtual('team', {
  ref: 'Team',
  localField: 'teamId',
  foreignField: '_id',
  justOne: true,
});

// Virtual for email profile details
teamMemberSchema.virtual('emailProfile', {
  ref: 'EmailProfile',
  localField: 'emailProfileId',
  foreignField: '_id',
  justOne: true,
});

export const TeamMember = mongoose.model<ITeamMember>(
  'TeamMember',
  teamMemberSchema
);
