/**
 * Contact Metadata Model
 *
 * Stores CRM metadata for Nylas contacts including ownership, permissions,
 * lifecycle, tags, and custom fields.
 *
 * This extends basic Nylas contact data with company-specific information.
 */

import mongoose, { Schema, Document, Model } from 'mongoose';

// ==========================================
// TypeScript Interfaces
// ==========================================

export type ContactLifecycle = 'lead' | 'prospect' | 'customer' | 'partner' | 'inactive';
export type ContactSource = 'manual' | 'import' | 'api' | 'meeting' | 'email' | 'oauth';

export interface IContactPermissions {
  view: string[];    // User IDs who can view
  edit: string[];    // User IDs who can edit
  delete: string[];  // User IDs who can delete
}

export interface IContactMetadata extends Document {
  contactId: string;              // Nylas contact ID
  grantId: string;                // Nylas grant ID (which user's contacts)
  companyId: mongoose.Types.ObjectId;  // Company ownership
  ownerId: mongoose.Types.ObjectId;    // User who created/owns
  createdBy: mongoose.Types.ObjectId;  // User ID who created

  // Lifecycle & Source
  lifecycle: ContactLifecycle;
  source: ContactSource;

  // Organization
  tags: string[];                 // Custom tags for organization
  groups: mongoose.Types.ObjectId[];  // Contact group IDs

  // Sharing & Permissions
  isShared: boolean;              // Shared with company
  permissions: IContactPermissions;
  teams: mongoose.Types.ObjectId[];   // Team IDs with access

  // Custom Fields
  customFields: Map<string, any>;

  // Soft Delete
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  deletionReason?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastInteractionAt?: Date;       // Last email/meeting/call

  // Statistics
  interactionCount: number;       // Total interactions
  emailCount: number;             // Emails sent/received
  meetingCount: number;           // Meetings attended

  // Instance methods
  hasPermission(userId: string, action: 'view' | 'edit' | 'delete'): boolean;
  softDelete(userId: mongoose.Types.ObjectId, reason?: string): void;
  restore(): void;
  addTag(tag: string): void;
  removeTag(tag: string): void;
  grantPermission(userId: string, action: 'view' | 'edit' | 'delete'): void;
  revokePermission(userId: string, action: 'view' | 'edit' | 'delete'): void;
  updateLifecycle(stage: ContactLifecycle): void;
  logInteraction(type: 'email' | 'meeting' | 'call'): void;
}

// Static methods interface
export interface IContactMetadataModel extends Model<IContactMetadata> {
  findByContactId(contactId: string, grantId: string): Promise<IContactMetadata | null>;
  findByOwner(ownerId: mongoose.Types.ObjectId, includeDeleted?: boolean): Promise<IContactMetadata[]>;
  findByCompany(companyId: mongoose.Types.ObjectId, includeDeleted?: boolean): Promise<IContactMetadata[]>;
  findByLifecycle(companyId: mongoose.Types.ObjectId, lifecycle: ContactLifecycle): Promise<IContactMetadata[]>;
  findByTag(companyId: mongoose.Types.ObjectId, tag: string): Promise<IContactMetadata[]>;
  findShared(companyId: mongoose.Types.ObjectId): Promise<IContactMetadata[]>;
}

// ==========================================
// Mongoose Schema
// ==========================================

const ContactMetadataSchema = new Schema<IContactMetadata>(
  {
    contactId: {
      type: String,
      required: true,
      index: true,
    },
    grantId: {
      type: String,
      required: true,
      index: true,
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Lifecycle & Source
    lifecycle: {
      type: String,
      enum: ['lead', 'prospect', 'customer', 'partner', 'inactive'],
      default: 'lead',
      index: true,
    },
    source: {
      type: String,
      enum: ['manual', 'import', 'api', 'meeting', 'email', 'oauth'],
      default: 'manual',
    },

    // Organization
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    groups: [{
      type: Schema.Types.ObjectId,
      ref: 'ContactGroup',
    }],

    // Sharing & Permissions
    isShared: {
      type: Boolean,
      default: false,
      index: true,
    },
    permissions: {
      view: {
        type: [String],
        default: [],
      },
      edit: {
        type: [String],
        default: [],
      },
      delete: {
        type: [String],
        default: [],
      },
    },
    teams: [{
      type: Schema.Types.ObjectId,
      ref: 'ContactTeam',
    }],

    // Custom Fields
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },

    // Soft Delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    deletionReason: {
      type: String,
    },

    // Timestamps
    lastInteractionAt: {
      type: Date,
      index: true,
    },

    // Statistics
    interactionCount: {
      type: Number,
      default: 0,
    },
    emailCount: {
      type: Number,
      default: 0,
    },
    meetingCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'contact_metadata',
  }
);

// ==========================================
// Indexes for Performance
// ==========================================

// Compound indexes for common queries
ContactMetadataSchema.index({ companyId: 1, ownerId: 1 });
ContactMetadataSchema.index({ companyId: 1, isDeleted: 1 });
ContactMetadataSchema.index({ companyId: 1, lifecycle: 1 });
ContactMetadataSchema.index({ companyId: 1, tags: 1 });
ContactMetadataSchema.index({ companyId: 1, isShared: 1 });
ContactMetadataSchema.index({ contactId: 1, grantId: 1 }, { unique: true });

// ==========================================
// Instance Methods
// ==========================================

/**
 * Check if user has permission to perform action
 */
ContactMetadataSchema.methods.hasPermission = function(
  userId: string,
  action: 'view' | 'edit' | 'delete'
): boolean {
  // Owner always has all permissions
  if (this.ownerId.toString() === userId) {
    return true;
  }

  // Deleted contacts cannot be accessed (except by owner)
  if (this.isDeleted) {
    return false;
  }

  // Check specific permission
  return this.permissions[action].includes(userId);
};

/**
 * Soft delete the contact metadata
 */
ContactMetadataSchema.methods.softDelete = function(
  userId: mongoose.Types.ObjectId,
  reason?: string
): void {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  if (reason) {
    this.deletionReason = reason;
  }
};

/**
 * Restore soft-deleted contact
 */
ContactMetadataSchema.methods.restore = function(): void {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  this.deletionReason = undefined;
};

/**
 * Add tag to contact
 */
ContactMetadataSchema.methods.addTag = function(tag: string): void {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
  }
};

/**
 * Remove tag from contact
 */
ContactMetadataSchema.methods.removeTag = function(tag: string): void {
  this.tags = this.tags.filter(t => t !== tag);
};

/**
 * Grant permission to user
 */
ContactMetadataSchema.methods.grantPermission = function(
  userId: string,
  action: 'view' | 'edit' | 'delete'
): void {
  if (!this.permissions[action].includes(userId)) {
    this.permissions[action].push(userId);
  }

  // Auto-grant view permission when granting edit or delete
  if (action !== 'view' && !this.permissions.view.includes(userId)) {
    this.permissions.view.push(userId);
  }
};

/**
 * Revoke permission from user
 */
ContactMetadataSchema.methods.revokePermission = function(
  userId: string,
  action: 'view' | 'edit' | 'delete'
): void {
  this.permissions[action] = this.permissions[action].filter(id => id !== userId);
};

/**
 * Update lifecycle stage
 */
ContactMetadataSchema.methods.updateLifecycle = function(
  stage: ContactLifecycle
): void {
  this.lifecycle = stage;
};

/**
 * Log interaction
 */
ContactMetadataSchema.methods.logInteraction = function(
  type: 'email' | 'meeting' | 'call'
): void {
  this.lastInteractionAt = new Date();
  this.interactionCount++;

  if (type === 'email') {
    this.emailCount++;
  } else if (type === 'meeting') {
    this.meetingCount++;
  }
};

// ==========================================
// Static Methods
// ==========================================

/**
 * Find contact metadata by Nylas contact ID
 */
ContactMetadataSchema.statics.findByContactId = function(
  contactId: string,
  grantId: string
) {
  return this.findOne({ contactId, grantId, isDeleted: false });
};

/**
 * Find all contacts for a user
 */
ContactMetadataSchema.statics.findByOwner = function(
  ownerId: mongoose.Types.ObjectId,
  includeDeleted = false
) {
  const query: any = { ownerId };
  if (!includeDeleted) {
    query.isDeleted = false;
  }
  return this.find(query).sort({ updatedAt: -1 });
};

/**
 * Find all contacts for a company
 */
ContactMetadataSchema.statics.findByCompany = function(
  companyId: mongoose.Types.ObjectId,
  includeDeleted = false
) {
  const query: any = { companyId };
  if (!includeDeleted) {
    query.isDeleted = false;
  }
  return this.find(query).sort({ updatedAt: -1 });
};

/**
 * Find contacts by lifecycle stage
 */
ContactMetadataSchema.statics.findByLifecycle = function(
  companyId: mongoose.Types.ObjectId,
  lifecycle: ContactLifecycle
) {
  return this.find({ companyId, lifecycle, isDeleted: false });
};

/**
 * Find contacts by tag
 */
ContactMetadataSchema.statics.findByTag = function(
  companyId: mongoose.Types.ObjectId,
  tag: string
) {
  return this.find({ companyId, tags: tag, isDeleted: false });
};

/**
 * Find shared contacts
 */
ContactMetadataSchema.statics.findShared = function(
  companyId: mongoose.Types.ObjectId
) {
  return this.find({ companyId, isShared: true, isDeleted: false });
};

// ==========================================
// Pre-save Hook
// ==========================================

ContactMetadataSchema.pre('save', function(next) {
  // Ensure owner always has all permissions
  const ownerId = this.ownerId.toString();

  if (!this.permissions.view.includes(ownerId)) {
    this.permissions.view.push(ownerId);
  }
  if (!this.permissions.edit.includes(ownerId)) {
    this.permissions.edit.push(ownerId);
  }
  if (!this.permissions.delete.includes(ownerId)) {
    this.permissions.delete.push(ownerId);
  }

  next();
});

// ==========================================
// Model Export
// ==========================================

export const ContactMetadata = mongoose.model<IContactMetadata, IContactMetadataModel>(
  'ContactMetadata',
  ContactMetadataSchema
);
