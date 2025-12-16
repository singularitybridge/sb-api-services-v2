/**
 * Nylas Grants Service
 *
 * Manages per-user Nylas grants for individual email/calendar access.
 * Each user can have their own Nylas grant linked to their personal account.
 *
 * MIGRATION STRATEGY:
 * - Write: Always to new NylasGrant collection
 * - Read: Try NylasGrant first, fallback to User.nylasGrant (transitional)
 * - After migration complete: Remove fallback logic
 */

import mongoose from 'mongoose';
import { User, IUser, INylasGrant } from '../../../models/User';
import { NylasGrant, INylasGrant as INylasGrantDoc } from '../models/NylasGrant';

export interface GrantData {
  grantId: string;
  email: string;
  provider: string;
  scopes?: string[];
  expiresAt?: Date;
}

export class GrantsService {
  /**
   * Store a Nylas grant for a user
   * Always writes to new NylasGrant collection
   */
  static async storeNylasGrant(
    userId: string,
    grantData: GrantData,
  ): Promise<INylasGrantDoc> {
    // Get user to retrieve companyId
    const user = await User.findById(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const grantDoc = await NylasGrant.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      {
        $set: {
          userId: new mongoose.Types.ObjectId(userId),
          companyId: user.companyId,
          grantId: grantData.grantId,
          email: grantData.email.toLowerCase(),
          provider: grantData.provider,
          status: 'active',
          scopes: grantData.scopes || [],
          expiresAt: grantData.expiresAt,
        },
      },
      { upsert: true, new: true },
    );

    console.log(`[grants-service] Stored grant ${grantData.grantId.substring(0, 8)}... for user ${userId}`);

    return grantDoc;
  }

  /**
   * Get a user's Nylas grant
   * Dual-read: Try new collection first, fallback to User.nylasGrant
   */
  static async getUserGrant(userId: string): Promise<INylasGrant | null> {
    // Try new NylasGrant collection first
    const grant = await NylasGrant.findOne({ userId: new mongoose.Types.ObjectId(userId) });

    if (grant) {
      // Convert to old interface format
      return {
        grantId: grant.grantId,
        email: grant.email,
        provider: grant.provider,
        status: grant.status,
        scopes: grant.scopes,
        createdAt: grant.createdAt,
        expiresAt: grant.expiresAt,
      };
    }

    // Fallback to User.nylasGrant (transitional)
    const user = await User.findById(userId).select('nylasGrant');
    if (user?.nylasGrant) {
      console.log(`[grants-service] FALLBACK: Found grant in User.nylasGrant for user ${userId}`);
      return user.nylasGrant;
    }

    return null;
  }

  /**
   * Find user by their Nylas grant ID
   * Dual-read: Try new collection first, fallback to User query
   */
  static async getUserByGrantId(grantId: string): Promise<IUser | null> {
    // Try new NylasGrant collection first
    const grant = await NylasGrant.findOne({ grantId });

    if (grant) {
      return User.findById(grant.userId);
    }

    // Fallback to User.nylasGrant query (transitional)
    const user = await User.findOne({ 'nylasGrant.grantId': grantId });
    if (user) {
      console.log(`[grants-service] FALLBACK: Found user by grantId in User.nylasGrant`);
    }

    return user;
  }

  /**
   * Find user by email and company
   */
  static async getUserByEmailAndCompany(
    email: string,
    companyId: string,
  ): Promise<IUser | null> {
    return User.findOne({
      email: email.toLowerCase(),
      companyId: new mongoose.Types.ObjectId(companyId),
    });
  }

  /**
   * Get grant by email and company
   * NEW METHOD - Query NylasGrant collection directly
   */
  static async getGrantByEmailAndCompany(
    email: string,
    companyId: string,
  ): Promise<INylasGrant | null> {
    // Try new NylasGrant collection first
    const grant = await NylasGrant.findOne({
      email: email.toLowerCase(),
      companyId: new mongoose.Types.ObjectId(companyId),
    });

    if (grant) {
      return {
        grantId: grant.grantId,
        email: grant.email,
        provider: grant.provider,
        status: grant.status,
        scopes: grant.scopes,
        createdAt: grant.createdAt,
        expiresAt: grant.expiresAt,
      };
    }

    // Fallback to User.nylasGrant (transitional)
    const user = await User.findOne({
      email: email.toLowerCase(),
      companyId: new mongoose.Types.ObjectId(companyId),
      'nylasGrant.grantId': { $exists: true },
    }).select('nylasGrant');

    if (user?.nylasGrant) {
      console.log(`[grants-service] FALLBACK: Found grant in User.nylasGrant by email ${email}`);
      return user.nylasGrant;
    }

    return null;
  }

  /**
   * Revoke a user's Nylas grant
   */
  static async revokeGrant(userId: string): Promise<void> {
    // Update NylasGrant collection
    const grant = await NylasGrant.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $set: { status: 'revoked' } },
      { new: true },
    );

    if (grant) {
      console.log(`[grants-service] Revoked grant for user ${userId}`);
    } else {
      // Fallback to User.nylasGrant (transitional)
      await User.findByIdAndUpdate(
        userId,
        { $set: { 'nylasGrant.status': 'revoked' } },
      );
      console.log(`[grants-service] FALLBACK: Revoked grant in User.nylasGrant for user ${userId}`);
    }
  }

  /**
   * Mark a grant as expired by grant ID
   */
  static async markGrantExpired(grantId: string): Promise<void> {
    // Update NylasGrant collection
    const grant = await NylasGrant.findOneAndUpdate(
      { grantId },
      { $set: { status: 'expired' } },
      { new: true },
    );

    if (grant) {
      console.log(`[grants-service] Marked grant ${grantId.substring(0, 8)}... as expired`);
    } else {
      // Fallback to User.nylasGrant (transitional)
      await User.findOneAndUpdate(
        { 'nylasGrant.grantId': grantId },
        { $set: { 'nylasGrant.status': 'expired' } },
      );
      console.log(`[grants-service] FALLBACK: Marked grant ${grantId.substring(0, 8)}... as expired in User.nylasGrant`);
    }
  }

  /**
   * Remove a user's Nylas grant completely
   */
  static async removeGrant(userId: string): Promise<void> {
    // Delete from NylasGrant collection
    const result = await NylasGrant.deleteOne({ userId: new mongoose.Types.ObjectId(userId) });

    if (result.deletedCount > 0) {
      console.log(`[grants-service] Removed grant for user ${userId}`);
    } else {
      // Fallback to User.nylasGrant (transitional)
      await User.findByIdAndUpdate(
        userId,
        { $unset: { nylasGrant: 1 } },
      );
      console.log(`[grants-service] FALLBACK: Removed grant from User.nylasGrant for user ${userId}`);
    }
  }

  /**
   * Check if a user has an active Nylas grant
   * Dual-read: Try new collection first, fallback to User.nylasGrant
   */
  static async hasActiveGrant(userId: string): Promise<boolean> {
    // Try new NylasGrant collection first
    const grant = await NylasGrant.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      status: 'active',
    });

    if (grant) {
      return true;
    }

    // Fallback to User.nylasGrant (transitional)
    const user = await User.findById(userId).select('nylasGrant');
    if (user?.nylasGrant?.status === 'active' && user.nylasGrant.grantId) {
      console.log(`[grants-service] FALLBACK: Found active grant in User.nylasGrant for user ${userId}`);
      return true;
    }

    return false;
  }

  /**
   * Get all users in a company with active Nylas grants
   * Dual-read: Combine results from both collections
   */
  static async getCompanyUsersWithGrants(
    companyId: string,
  ): Promise<IUser[]> {
    // Get users from new NylasGrant collection
    const grants = await NylasGrant.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      status: 'active',
    });

    const userIds = grants.map(g => g.userId);

    // Get users by IDs
    const usersFromGrants = await User.find({
      _id: { $in: userIds },
    });

    // Fallback: Get users with grants in User.nylasGrant (transitional)
    const usersWithEmbeddedGrants = await User.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      'nylasGrant.status': 'active',
      'nylasGrant.grantId': { $exists: true, $ne: null },
      _id: { $nin: userIds }, // Exclude users already found in NylasGrant collection
    });

    if (usersWithEmbeddedGrants.length > 0) {
      console.log(`[grants-service] FALLBACK: Found ${usersWithEmbeddedGrants.length} users with grants in User.nylasGrant`);
    }

    // Combine and return unique users
    return [...usersFromGrants, ...usersWithEmbeddedGrants];
  }
}
