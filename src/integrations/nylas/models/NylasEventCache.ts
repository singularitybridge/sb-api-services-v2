/**
 * Nylas Event Cache Model
 *
 * Caches calendar events and emails for fast queries
 * Automatically expires after TTL
 * Updated in real-time via webhooks
 */

import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INylasEventCache extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  nylasAccountId: Types.ObjectId;       // Reference to NylasAccount
  grantId: string;                      // Nylas grant ID for fast lookup
  eventType: 'calendar' | 'message';    // Type of cached data
  eventId: string;                      // Nylas event/message ID
  calendarId?: string;                  // For calendar events
  data: {
    // Flexible structure for calendar event or email
    title?: string;
    subject?: string;
    startTime?: number;                 // Unix timestamp
    endTime?: number;                   // Unix timestamp
    participants?: any[];
    from?: any;
    to?: any[];
    body?: string;
    status?: string;
    // Store full Nylas response for flexibility
    raw: any;
  };
  lastSyncedAt: Date;                   // When this was last synced
  expiresAt: Date;                      // TTL expiration
  metadata?: {
    source?: 'webhook' | 'manual' | 'delta_sync';
    version?: number;                   // For conflict resolution
  };
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  isExpired(): boolean;
  refreshTTL(hours?: number): Promise<INylasEventCache>;
}

// Static methods interface
export interface INylasEventCacheModel extends mongoose.Model<INylasEventCache> {
  getCalendarEvents(
    grantId: string,
    options?: {
      calendarId?: string;
      startTime?: number;
      endTime?: number;
      limit?: number;
    }
  ): Promise<INylasEventCache[]>;

  upsertEvent(
    grantId: string,
    eventType: 'calendar' | 'message',
    eventId: string,
    data: any,
    ttlHours?: number
  ): Promise<INylasEventCache>;

  deleteEvent(
    grantId: string,
    eventType: 'calendar' | 'message',
    eventId: string
  ): Promise<any>;

  clearGrantCache(grantId: string): Promise<any>;

  getCacheStats(companyId: string): Promise<{
    totalEvents: number;
    calendarEvents: number;
    messages: number;
    expiredEvents: number;
  }>;
}

const nylasEventCacheSchema = new Schema<INylasEventCache>(
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
    grantId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ['calendar', 'message'],
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    calendarId: {
      type: String,
      index: true,
    },
    data: {
      title: String,
      subject: String,
      startTime: Number,
      endTime: Number,
      participants: Schema.Types.Mixed,
      from: Schema.Types.Mixed,
      to: Schema.Types.Mixed,
      body: String,
      status: String,
      raw: Schema.Types.Mixed,
    },
    lastSyncedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true, // TTL index
    },
    metadata: {
      source: {
        type: String,
        enum: ['webhook', 'manual', 'delta_sync'],
      },
      version: Number,
    },
  },
  {
    timestamps: true,
    collection: 'nylasEventCache',
  }
);

// ==========================================
// Indexes
// ==========================================

// TTL index - MongoDB auto-deletes expired documents
nylasEventCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for fast calendar queries
nylasEventCacheSchema.index({
  companyId: 1,
  eventType: 1,
  'data.startTime': 1,
  'data.endTime': 1,
});

// Index for grant-based queries
nylasEventCacheSchema.index({
  grantId: 1,
  eventType: 1,
  calendarId: 1,
});

// Unique constraint: one cache entry per event
nylasEventCacheSchema.index(
  { grantId: 1, eventType: 1, eventId: 1 },
  { unique: true }
);

// Index for finding stale cache entries
nylasEventCacheSchema.index({ lastSyncedAt: 1 });

// ==========================================
// Static Methods (Functional)
// ==========================================

/**
 * Get cached calendar events for a time range
 */
nylasEventCacheSchema.statics.getCalendarEvents = function (
  grantId: string,
  options: {
    calendarId?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  } = {}
): Promise<INylasEventCache[]> {
  const query: any = {
    grantId,
    eventType: 'calendar',
    expiresAt: { $gt: new Date() }, // Only non-expired
  };

  if (options.calendarId) {
    query.calendarId = options.calendarId;
  }

  if (options.startTime || options.endTime) {
    query['data.startTime'] = {};
    if (options.startTime) query['data.startTime'].$gte = options.startTime;
    if (options.endTime) query['data.endTime'] = { $lte: options.endTime };
  }

  return this.find(query)
    .sort({ 'data.startTime': 1 })
    .limit(options.limit || 1000);
};

/**
 * Upsert event cache (update or insert)
 */
nylasEventCacheSchema.statics.upsertEvent = function (
  grantId: string,
  eventType: 'calendar' | 'message',
  eventId: string,
  data: any,
  ttlHours: number = 24
): Promise<INylasEventCache> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  return this.findOneAndUpdate(
    { grantId, eventType, eventId },
    {
      $set: {
        data,
        lastSyncedAt: new Date(),
        expiresAt,
        'metadata.version': Date.now(), // Conflict resolution
      },
      $setOnInsert: {
        grantId,
        eventType,
        eventId,
      },
    },
    {
      upsert: true,
      new: true,
    }
  );
};

/**
 * Delete event from cache
 */
nylasEventCacheSchema.statics.deleteEvent = function (
  grantId: string,
  eventType: 'calendar' | 'message',
  eventId: string
): Promise<any> {
  return this.deleteOne({ grantId, eventType, eventId });
};

/**
 * Clear all cache for a grant
 */
nylasEventCacheSchema.statics.clearGrantCache = function (
  grantId: string
): Promise<any> {
  return this.deleteMany({ grantId });
};

/**
 * Get cache statistics
 */
nylasEventCacheSchema.statics.getCacheStats = async function (
  companyId: string
): Promise<{
  totalEvents: number;
  calendarEvents: number;
  messages: number;
  expiredEvents: number;
}> {
  const now = new Date();

  const [total, calendar, messages, expired] = await Promise.all([
    this.countDocuments({ companyId }),
    this.countDocuments({ companyId, eventType: 'calendar' }),
    this.countDocuments({ companyId, eventType: 'message' }),
    this.countDocuments({ companyId, expiresAt: { $lte: now } }),
  ]);

  return {
    totalEvents: total,
    calendarEvents: calendar,
    messages,
    expiredEvents: expired,
  };
};

// ==========================================
// Instance Methods (Functional)
// ==========================================

/**
 * Check if cache entry is expired
 */
nylasEventCacheSchema.methods.isExpired = function (): boolean {
  return this.expiresAt < new Date();
};

/**
 * Refresh TTL (extend expiration)
 */
nylasEventCacheSchema.methods.refreshTTL = function (
  hours: number = 24
): Promise<INylasEventCache> {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  this.expiresAt = expiresAt;
  this.lastSyncedAt = new Date();
  return this.save();
};

// ==========================================
// Export
// ==========================================

export const NylasEventCache = mongoose.model<
  INylasEventCache,
  INylasEventCacheModel
>('NylasEventCache', nylasEventCacheSchema);
