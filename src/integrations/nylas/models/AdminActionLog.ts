/**
 * AdminActionLog Model
 *
 * Audit trail for administrator actions when accessing other users' data.
 * Tracks cross-user access for compliance and security monitoring.
 *
 * Use Cases:
 * - Admin views Sarah's emails
 * - Admin schedules meeting on John's calendar
 * - Admin creates contact in Mary's account
 *
 * Compliance:
 * - Required for GDPR, HIPAA, SOC 2 compliance
 * - Provides full audit trail of admin activities
 * - Enables forensic analysis of data access
 */

import mongoose, { Schema, Document, Types, Model } from 'mongoose';

export interface IAdminActionLog extends Document {
  _id: Types.ObjectId;
  adminUserId: Types.ObjectId; // User who performed the action
  targetUserId: Types.ObjectId; // User whose data was accessed
  companyId: Types.ObjectId;
  action: string; // Action name (e.g., 'nylasGetCalendarEvents', 'nylasSendEmail')
  resourceType: 'email' | 'calendar' | 'contact' | 'other'; // Type of resource accessed
  resourceId?: string; // Specific resource ID (e.g., event ID, message ID)
  method: 'read' | 'create' | 'update' | 'delete'; // HTTP method equivalent
  requestParams?: {
    [key: string]: any;
  };
  responseStatus: 'success' | 'error' | 'unauthorized';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  assistantId?: Types.ObjectId;
  duration?: number; // Action duration in milliseconds
  metadata?: {
    targetEmail?: string;
    targetName?: string;
    [key: string]: any;
  };
  createdAt: Date;
}

// Static methods interface
export interface IAdminActionLogModel extends Model<IAdminActionLog> {
  logAdminAction(logData: {
    adminUserId: Types.ObjectId | string;
    targetUserId: Types.ObjectId | string;
    companyId: Types.ObjectId | string;
    action: string;
    resourceType: 'email' | 'calendar' | 'contact' | 'other';
    method: 'read' | 'create' | 'update' | 'delete';
    responseStatus: 'success' | 'error' | 'unauthorized';
    resourceId?: string;
    requestParams?: any;
    errorMessage?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    assistantId?: Types.ObjectId | string;
    duration?: number;
    metadata?: any;
  }): Promise<IAdminActionLog | null>;

  getAdminActivity(
    adminUserId: Types.ObjectId | string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      resourceType?: string;
    }
  ): Promise<IAdminActionLog[]>;

  getTargetUserActivity(
    targetUserId: Types.ObjectId | string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<IAdminActionLog[]>;
}

const adminActionLogSchema = new Schema<IAdminActionLog>(
  {
    adminUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      enum: ['email', 'calendar', 'contact', 'other'],
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      index: true,
    },
    method: {
      type: String,
      enum: ['read', 'create', 'update', 'delete'],
      required: true,
      index: true,
    },
    requestParams: {
      type: Schema.Types.Mixed,
      default: {},
    },
    responseStatus: {
      type: String,
      enum: ['success', 'error', 'unauthorized'],
      required: true,
      index: true,
    },
    errorMessage: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    sessionId: {
      type: String,
      index: true,
    },
    assistantId: {
      type: Schema.Types.ObjectId,
      ref: 'Assistant',
      index: true,
    },
    duration: {
      type: Number,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only need createdAt for logs
  }
);

// Compound indexes for common queries
adminActionLogSchema.index({ adminUserId: 1, createdAt: -1 });
adminActionLogSchema.index({ targetUserId: 1, createdAt: -1 });
adminActionLogSchema.index({ companyId: 1, createdAt: -1 });
adminActionLogSchema.index({ action: 1, resourceType: 1, createdAt: -1 });
adminActionLogSchema.index({ responseStatus: 1, createdAt: -1 });

// TTL index: Auto-delete logs older than 2 years (compliance requirement)
adminActionLogSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 63072000, // 2 years in seconds
    name: 'log_expiration',
  }
);

// Virtuals
adminActionLogSchema.virtual('adminUser', {
  ref: 'User',
  localField: 'adminUserId',
  foreignField: '_id',
  justOne: true,
});

adminActionLogSchema.virtual('targetUser', {
  ref: 'User',
  localField: 'targetUserId',
  foreignField: '_id',
  justOne: true,
});

adminActionLogSchema.virtual('assistant', {
  ref: 'Assistant',
  localField: 'assistantId',
  foreignField: '_id',
  justOne: true,
});

// Static methods
adminActionLogSchema.statics.logAdminAction = async function (logData: {
  adminUserId: Types.ObjectId | string;
  targetUserId: Types.ObjectId | string;
  companyId: Types.ObjectId | string;
  action: string;
  resourceType: 'email' | 'calendar' | 'contact' | 'other';
  method: 'read' | 'create' | 'update' | 'delete';
  responseStatus: 'success' | 'error' | 'unauthorized';
  resourceId?: string;
  requestParams?: any;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  assistantId?: Types.ObjectId | string;
  duration?: number;
  metadata?: any;
}) {
  try {
    const log = new this(logData);
    await log.save();
    return log;
  } catch (error) {
    console.error('[ADMIN AUDIT LOG] Failed to save log:', error);
    // Don't throw - we don't want logging failures to break the app
    return null;
  }
};

adminActionLogSchema.statics.getAdminActivity = async function (
  adminUserId: Types.ObjectId | string,
  options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    resourceType?: string;
  } = {}
) {
  const query: any = { adminUserId };

  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) query.createdAt.$gte = options.startDate;
    if (options.endDate) query.createdAt.$lte = options.endDate;
  }

  if (options.resourceType) {
    query.resourceType = options.resourceType;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .populate('targetUser', 'name email')
    .populate('assistant', 'name');
};

adminActionLogSchema.statics.getTargetUserActivity = async function (
  targetUserId: Types.ObjectId | string,
  options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}
) {
  const query: any = { targetUserId };

  if (options.startDate || options.endDate) {
    query.createdAt = {};
    if (options.startDate) query.createdAt.$gte = options.startDate;
    if (options.endDate) query.createdAt.$lte = options.endDate;
  }

  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .populate('adminUser', 'name email')
    .populate('assistant', 'name');
};

export const AdminActionLog = mongoose.model<IAdminActionLog, IAdminActionLogModel>(
  'AdminActionLog',
  adminActionLogSchema
);
