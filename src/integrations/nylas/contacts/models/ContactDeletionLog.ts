/**
 * Contact Deletion Log Model
 *
 * Audit trail for contact deletions. Tracks who deleted what contact,
 * when, why, and whether it was soft or hard delete.
 *
 * This provides accountability and enables recovery of accidentally
 * deleted contacts.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// TypeScript Interfaces
// ==========================================

export type DeletionType = 'soft' | 'hard';
export type DeletionStatus = 'deleted' | 'restored' | 'permanently_deleted';

export interface IContactDeletionLog extends Document {
  // Contact Information
  contactId: string;              // Nylas contact ID
  grantId: string;                // Nylas grant ID
  companyId: mongoose.Types.ObjectId;  // Company
  ownerId: mongoose.Types.ObjectId;    // Original owner

  // Contact Snapshot (before deletion)
  contactSnapshot: {
    givenName?: string;
    surname?: string;
    emails?: Array<{ email: string; type?: string }>;
    phoneNumbers?: Array<{ number: string; type?: string }>;
    companyName?: string;
    notes?: string;
  };

  // Deletion Details
  deletionType: DeletionType;     // soft or hard
  deletedBy: mongoose.Types.ObjectId;  // User who deleted
  deletedAt: Date;
  deletionReason?: string;        // Optional reason

  // Status Tracking
  status: DeletionStatus;
  restoredBy?: mongoose.Types.ObjectId;
  restoredAt?: Date;
  permanentlyDeletedAt?: Date;

  // Metadata
  hasActiveEmails: boolean;       // Had active email threads
  hasActiveMeetings: boolean;     // Had upcoming meetings
  interactionCount: number;       // Total interactions before deletion
  lastInteractionAt?: Date;

  // Audit Trail
  ipAddress?: string;             // IP address of deletion request
  userAgent?: string;             // User agent string
}

// Static methods interface
export interface IContactDeletionLogModel extends Model<IContactDeletionLog> {
  logDeletion(params: {
    contactId: string;
    grantId: string;
    companyId: mongoose.Types.ObjectId;
    ownerId: mongoose.Types.ObjectId;
    deletedBy: mongoose.Types.ObjectId;
    deletionType: DeletionType;
    contactSnapshot: any;
    deletionReason?: string;
    metadata?: {
      hasActiveEmails?: boolean;
      hasActiveMeetings?: boolean;
      interactionCount?: number;
      lastInteractionAt?: Date;
    };
    audit?: {
      ipAddress?: string;
      userAgent?: string;
    };
  }): Promise<IContactDeletionLog>;

  findByCompany(
    companyId: mongoose.Types.ObjectId,
    options?: {
      status?: DeletionStatus;
      deletionType?: DeletionType;
      limit?: number;
    }
  ): Promise<IContactDeletionLog[]>;

  findByUser(
    userId: mongoose.Types.ObjectId,
    options?: {
      asOwner?: boolean;
      asDeleter?: boolean;
      limit?: number;
    }
  ): Promise<IContactDeletionLog[]>;

  findRestorable(companyId: mongoose.Types.ObjectId, limit?: number): Promise<IContactDeletionLog[]>;

  getStatistics(
    companyId: mongoose.Types.ObjectId,
    dateRange?: { start: Date; end: Date }
  ): Promise<any>;
}

// ==========================================
// Mongoose Schema
// ==========================================

const ContactDeletionLogSchema = new Schema<IContactDeletionLog>(
  {
    // Contact Information
    contactId: {
      type: String,
      required: true,
      index: true,
    },
    grantId: {
      type: String,
      required: true,
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

    // Contact Snapshot
    contactSnapshot: {
      givenName: String,
      surname: String,
      emails: [{
        email: String,
        type: String,
      }],
      phoneNumbers: [{
        number: String,
        type: String,
      }],
      companyName: String,
      notes: String,
    },

    // Deletion Details
    deletionType: {
      type: String,
      enum: ['soft', 'hard'],
      required: true,
      index: true,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    deletionReason: {
      type: String,
    },

    // Status Tracking
    status: {
      type: String,
      enum: ['deleted', 'restored', 'permanently_deleted'],
      default: 'deleted',
      index: true,
    },
    restoredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    restoredAt: {
      type: Date,
    },
    permanentlyDeletedAt: {
      type: Date,
    },

    // Metadata
    hasActiveEmails: {
      type: Boolean,
      default: false,
    },
    hasActiveMeetings: {
      type: Boolean,
      default: false,
    },
    interactionCount: {
      type: Number,
      default: 0,
    },
    lastInteractionAt: {
      type: Date,
    },

    // Audit Trail
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
    collection: 'contact_deletion_logs',
  }
);

// ==========================================
// Indexes for Performance
// ==========================================

// Compound indexes for common queries
ContactDeletionLogSchema.index({ companyId: 1, deletedAt: -1 });
ContactDeletionLogSchema.index({ companyId: 1, status: 1 });
ContactDeletionLogSchema.index({ ownerId: 1, deletedAt: -1 });
ContactDeletionLogSchema.index({ deletedBy: 1, deletedAt: -1 });
ContactDeletionLogSchema.index({ contactId: 1, grantId: 1 });

// TTL index - auto-delete logs older than 90 days (for permanently deleted contacts)
ContactDeletionLogSchema.index(
  { permanentlyDeletedAt: 1 },
  {
    expireAfterSeconds: 90 * 24 * 60 * 60, // 90 days
    partialFilterExpression: { status: 'permanently_deleted' },
  }
);

// ==========================================
// Instance Methods
// ==========================================

/**
 * Mark contact as restored
 */
ContactDeletionLogSchema.methods.markRestored = function(
  userId: mongoose.Types.ObjectId
): void {
  this.status = 'restored';
  this.restoredBy = userId;
  this.restoredAt = new Date();
};

/**
 * Mark contact as permanently deleted
 */
ContactDeletionLogSchema.methods.markPermanentlyDeleted = function(): void {
  this.status = 'permanently_deleted';
  this.permanentlyDeletedAt = new Date();
};

/**
 * Get deletion summary string
 */
ContactDeletionLogSchema.methods.getSummary = function(): string {
  const { givenName, surname, emails } = this.contactSnapshot;
  const name = [givenName, surname].filter(Boolean).join(' ') || 'Unknown';
  const email = emails?.[0]?.email || 'No email';

  return `${name} (${email}) - ${this.deletionType} delete by ${this.deletedBy} at ${this.deletedAt}`;
};

/**
 * Check if contact can be restored
 */
ContactDeletionLogSchema.methods.canRestore = function(): boolean {
  // Only soft-deleted contacts that haven't been permanently deleted
  return this.deletionType === 'soft' && this.status === 'deleted';
};

// ==========================================
// Static Methods
// ==========================================

/**
 * Log a contact deletion
 */
ContactDeletionLogSchema.statics.logDeletion = async function(params: {
  contactId: string;
  grantId: string;
  companyId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  deletedBy: mongoose.Types.ObjectId;
  deletionType: DeletionType;
  contactSnapshot: any;
  deletionReason?: string;
  metadata?: {
    hasActiveEmails?: boolean;
    hasActiveMeetings?: boolean;
    interactionCount?: number;
    lastInteractionAt?: Date;
  };
  audit?: {
    ipAddress?: string;
    userAgent?: string;
  };
}) {
  const log = new this({
    contactId: params.contactId,
    grantId: params.grantId,
    companyId: params.companyId,
    ownerId: params.ownerId,
    deletedBy: params.deletedBy,
    deletionType: params.deletionType,
    contactSnapshot: params.contactSnapshot,
    deletionReason: params.deletionReason,
    hasActiveEmails: params.metadata?.hasActiveEmails || false,
    hasActiveMeetings: params.metadata?.hasActiveMeetings || false,
    interactionCount: params.metadata?.interactionCount || 0,
    lastInteractionAt: params.metadata?.lastInteractionAt,
    ipAddress: params.audit?.ipAddress,
    userAgent: params.audit?.userAgent,
  });

  return await log.save();
};

/**
 * Find deletion logs for a company
 */
ContactDeletionLogSchema.statics.findByCompany = function(
  companyId: mongoose.Types.ObjectId,
  options: {
    status?: DeletionStatus;
    deletionType?: DeletionType;
    limit?: number;
  } = {}
) {
  const query: any = { companyId };

  if (options.status) {
    query.status = options.status;
  }

  if (options.deletionType) {
    query.deletionType = options.deletionType;
  }

  return this.find(query)
    .sort({ deletedAt: -1 })
    .limit(options.limit || 100)
    .populate('deletedBy', 'name email')
    .populate('restoredBy', 'name email');
};

/**
 * Find deletion logs for a user
 */
ContactDeletionLogSchema.statics.findByUser = function(
  userId: mongoose.Types.ObjectId,
  options: {
    asOwner?: boolean;
    asDeleter?: boolean;
    limit?: number;
  } = {}
) {
  const { asOwner = true, asDeleter = false, limit = 100 } = options;

  const query: any = {};

  if (asOwner && asDeleter) {
    query.$or = [{ ownerId: userId }, { deletedBy: userId }];
  } else if (asOwner) {
    query.ownerId = userId;
  } else if (asDeleter) {
    query.deletedBy = userId;
  }

  return this.find(query)
    .sort({ deletedAt: -1 })
    .limit(limit);
};

/**
 * Find restorable contacts
 */
ContactDeletionLogSchema.statics.findRestorable = function(
  companyId: mongoose.Types.ObjectId,
  limit = 50
) {
  return this.find({
    companyId,
    deletionType: 'soft',
    status: 'deleted',
  })
    .sort({ deletedAt: -1 })
    .limit(limit);
};

/**
 * Get deletion statistics
 */
ContactDeletionLogSchema.statics.getStatistics = async function(
  companyId: mongoose.Types.ObjectId,
  dateRange?: { start: Date; end: Date }
) {
  const matchStage: any = { companyId };

  if (dateRange) {
    matchStage.deletedAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalDeletions: { $sum: 1 },
        softDeletes: {
          $sum: { $cond: [{ $eq: ['$deletionType', 'soft'] }, 1, 0] },
        },
        hardDeletes: {
          $sum: { $cond: [{ $eq: ['$deletionType', 'hard'] }, 1, 0] },
        },
        restored: {
          $sum: { $cond: [{ $eq: ['$status', 'restored'] }, 1, 0] },
        },
        permanentlyDeleted: {
          $sum: { $cond: [{ $eq: ['$status', 'permanently_deleted'] }, 1, 0] },
        },
        withActiveEmails: {
          $sum: { $cond: ['$hasActiveEmails', 1, 0] },
        },
        withActiveMeetings: {
          $sum: { $cond: ['$hasActiveMeetings', 1, 0] },
        },
      },
    },
  ]);

  return stats[0] || {
    totalDeletions: 0,
    softDeletes: 0,
    hardDeletes: 0,
    restored: 0,
    permanentlyDeleted: 0,
    withActiveEmails: 0,
    withActiveMeetings: 0,
  };
};

// ==========================================
// Model Export
// ==========================================

export const ContactDeletionLog = mongoose.model<IContactDeletionLog, IContactDeletionLogModel>(
  'ContactDeletionLog',
  ContactDeletionLogSchema
);
