import mongoose, { Document, Schema } from 'mongoose';
import { customAlphabet } from 'nanoid';

// URL-safe token generation (lowercase + numbers, 21 chars = ~132 bits of entropy)
const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 21);

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export enum InviteSource {
  DASHBOARD = 'dashboard',
  API = 'api',
  ADMIN = 'admin',
}

export interface IInvite extends Document {
  email: string;
  name?: string;
  companyId: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId; // User who sent the invite
  status: InviteStatus;
  role?: 'Admin' | 'CompanyUser'; // Role to assign when accepted
  inviteToken: string; // Secure URL-safe token
  acceptedAt?: Date;
  expiresAt: Date;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    source: InviteSource;
  };
  resendCount: number;
  lastResendAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InviteSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true, // Normalize to lowercase
      trim: true,
    },
    name: { type: String, trim: true },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(InviteStatus),
      default: InviteStatus.PENDING,
    },
    role: {
      type: String,
      enum: ['Admin', 'CompanyUser'],
      default: 'CompanyUser',
    },
    inviteToken: {
      type: String,
      unique: true,
      default: () => nanoid(),
      index: true,
    },
    acceptedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    metadata: {
      ipAddress: String,
      userAgent: String,
      source: {
        type: String,
        enum: Object.values(InviteSource),
        default: InviteSource.DASHBOARD,
      },
    },
    resendCount: {
      type: Number,
      default: 0,
      max: 3, // Limit resends to prevent abuse
    },
    lastResendAt: Date,
  },
  { timestamps: true },
);

// Index for faster lookups
InviteSchema.index({ email: 1, status: 1 });
InviteSchema.index({ companyId: 1, createdAt: -1 }); // For paginated listing
InviteSchema.index({ inviteToken: 1 });

// TTL index for automatic cleanup of expired invites (MongoDB native)
InviteSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

// Compound unique index to prevent duplicate pending invites
InviteSchema.index(
  { email: 1, companyId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: InviteStatus.PENDING },
  },
);

export const Invite = mongoose.model<IInvite>('Invite', InviteSchema);
