/**
 * Nylas Grant Resolution Service
 *
 * Handles multi-user grant resolution for admin cross-user access.
 * Maps users to their Nylas grants and validates admin permissions.
 */

import mongoose from 'mongoose';
import { NylasAccount } from '../models/NylasAccount';
import { User } from '../../../models/User';

// ==========================================
// Grant Resolution Functions
// ==========================================

/**
 * Get Nylas grant ID for a specific user
 */
export async function getGrantForUser(
  userId: string | mongoose.Types.ObjectId
): Promise<string | null> {
  const account = await NylasAccount.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true,
    status: 'active',
  });

  if (!account) {
    console.log(`[GRANT RESOLUTION] No active Nylas account found for user ${userId}`);
    return null;
  }

  return account.nylasGrantId;
}

/**
 * Get full Nylas account details for a user
 */
export async function getNylasAccountForUser(
  userId: string | mongoose.Types.ObjectId
) {
  return await NylasAccount.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    isActive: true,
    status: 'active',
  });
}

/**
 * Resolve user by email, name, or ID
 * Returns userId or null if not found
 */
export async function resolveUserIdentifier(
  identifier: string,
  companyId: string | mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId | null> {
  // Check if identifier is a valid MongoDB ObjectId (user ID)
  if (mongoose.Types.ObjectId.isValid(identifier) && /^[0-9a-fA-F]{24}$/.test(identifier)) {
    const user = await User.findOne({
      _id: new mongoose.Types.ObjectId(identifier),
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    return user ? (user._id as mongoose.Types.ObjectId) : null;
  }

  // Check if identifier is an email address
  if (identifier.includes('@')) {
    const user = await User.findOne({
      email: identifier.toLowerCase(),
      companyId: new mongoose.Types.ObjectId(companyId),
    });
    return user ? (user._id as mongoose.Types.ObjectId) : null;
  }

  // Try to find by name (case-insensitive partial match)
  const user = await User.findOne({
    name: new RegExp(identifier, 'i'),
    companyId: new mongoose.Types.ObjectId(companyId),
  });

  if (user) {
    return user._id as mongoose.Types.ObjectId;
  }

  // Try to find by Nylas account email
  const nylasAccount = await NylasAccount.findOne({
    emailAddress: identifier.toLowerCase(),
    companyId: new mongoose.Types.ObjectId(companyId),
    isActive: true,
  });

  return nylasAccount ? nylasAccount.userId : null;
}

/**
 * Resolve target user grant from various input formats
 * Used by Nylas actions to support targetEmail/targetUserId/targetName parameters
 */
export async function resolveTargetUserGrant(
  targetIdentifier: string | undefined,
  requestingUserId: string | mongoose.Types.ObjectId,
  companyId: string | mongoose.Types.ObjectId
): Promise<{
  grantId: string;
  targetUserId: mongoose.Types.ObjectId;
  isAdminAccess: boolean;
}> {
  const requestingUserObjId = new mongoose.Types.ObjectId(requestingUserId);

  // If no target specified, use requesting user's own grant
  if (!targetIdentifier) {
    const grantId = await getGrantForUser(requestingUserObjId);
    if (!grantId) {
      // Fallback to service account grant from environment
      const serviceAccountGrantId = process.env.NYLAS_GRANT_ID;
      if (serviceAccountGrantId) {
        console.log('[GRANT RESOLUTION] Using service account grant from .env');
        return {
          grantId: serviceAccountGrantId,
          targetUserId: requestingUserObjId,
          isAdminAccess: false,
        };
      }
      throw new Error('No Nylas account connected for your user. Please connect your email account.');
    }
    return {
      grantId,
      targetUserId: requestingUserObjId,
      isAdminAccess: false,
    };
  }

  // Resolve target user
  const targetUserId = await resolveUserIdentifier(targetIdentifier, companyId);
  if (!targetUserId) {
    throw new Error(`User not found: ${targetIdentifier}`);
  }

  // Check if this is cross-user access
  const isAdminAccess = !requestingUserObjId.equals(targetUserId);

  // If cross-user access, validate admin permissions
  if (isAdminAccess) {
    const requestingUser = await User.findById(requestingUserObjId);
    if (!requestingUser || requestingUser.role !== 'Admin') {
      throw new Error(
        `Access denied: Only administrators can access other users' data. You are attempting to access ${targetIdentifier}'s data.`
      );
    }
  }

  // Get target user's grant
  const grantId = await getGrantForUser(targetUserId);
  if (!grantId) {
    const targetUser = await User.findById(targetUserId);
    throw new Error(
      `No Nylas account connected for user ${targetUser?.name || targetIdentifier}. ` +
      `That user needs to connect their email account first.`
    );
  }

  return {
    grantId,
    targetUserId,
    isAdminAccess,
  };
}

// ==========================================
// Permission Validation
// ==========================================

/**
 * Check if a user is an administrator
 */
export async function isUserAdmin(
  userId: string | mongoose.Types.ObjectId
): Promise<boolean> {
  const user = await User.findById(userId);
  return user ? user.role === 'Admin' : false;
}

/**
 * Validate admin permission for cross-user access
 * Throws error if user is not admin and tries to access another user's data
 */
export async function validateAdminCrossUserAccess(
  requestingUserId: string | mongoose.Types.ObjectId,
  targetUserId: string | mongoose.Types.ObjectId
): Promise<void> {
  const requestingUserObjId = new mongoose.Types.ObjectId(requestingUserId);
  const targetUserObjId = new mongoose.Types.ObjectId(targetUserId);

  // Same user - no admin check needed
  if (requestingUserObjId.equals(targetUserObjId)) {
    return;
  }

  // Cross-user access - require admin role
  const isAdmin = await isUserAdmin(requestingUserObjId);
  if (!isAdmin) {
    const requestingUser = await User.findById(requestingUserObjId);
    const targetUser = await User.findById(targetUserObjId);
    throw new Error(
      `Access denied: User ${requestingUser?.name} (role: ${requestingUser?.role}) ` +
      `cannot access ${targetUser?.name}'s data. Admin role required.`
    );
  }
}

// ==========================================
// Company-wide Grant Management
// ==========================================

/**
 * Get all Nylas accounts for a company
 */
export async function getCompanyNylasAccounts(
  companyId: string | mongoose.Types.ObjectId,
  options: {
    activeOnly?: boolean;
    status?: 'active' | 'revoked' | 'error' | 'pending';
  } = {}
) {
  const query: any = {
    companyId: new mongoose.Types.ObjectId(companyId),
  };

  if (options.activeOnly !== false) {
    query.isActive = true;
  }

  if (options.status) {
    query.status = options.status;
  }

  return await NylasAccount.find(query)
    .populate('userId', 'name email role')
    .sort({ createdAt: -1 });
}

/**
 * Get user details with their Nylas account status
 */
export async function getUserWithNylasStatus(
  userId: string | mongoose.Types.ObjectId
) {
  const user = await User.findById(userId);
  if (!user) {
    return null;
  }

  const nylasAccount = await getNylasAccountForUser(userId);

  return {
    userId: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    nylasAccount: nylasAccount ? {
      grantId: nylasAccount.nylasGrantId,
      provider: nylasAccount.provider,
      emailAddress: nylasAccount.emailAddress,
      status: nylasAccount.status,
      isActive: nylasAccount.isActive,
      lastSyncedAt: nylasAccount.lastSyncedAt,
    } : null,
  };
}
