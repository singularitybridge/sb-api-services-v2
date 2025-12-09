/**
 * User Grant Service
 *
 * Manages per-user Nylas grants for individual email/calendar access.
 * Each user can have their own Nylas grant linked to their personal account.
 */

import { User, IUser, INylasGrant } from '../models/User';
import mongoose from 'mongoose';

export interface GrantData {
  grantId: string;
  email: string;
  provider: string;
  scopes?: string[];
  expiresAt?: Date;
}

export class UserGrantService {
  /**
   * Store a Nylas grant for a user
   */
  static async storeNylasGrant(
    userId: string,
    grantData: GrantData,
  ): Promise<IUser | null> {
    const nylasGrant: INylasGrant = {
      grantId: grantData.grantId,
      email: grantData.email,
      provider: grantData.provider,
      status: 'active',
      scopes: grantData.scopes,
      createdAt: new Date(),
      expiresAt: grantData.expiresAt,
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { nylasGrant } },
      { new: true },
    );

    if (user) {
      console.log(`[user-grant] Stored grant ${grantData.grantId.substring(0, 8)}... for user ${userId}`);
    }

    return user;
  }

  /**
   * Get a user's Nylas grant
   */
  static async getUserGrant(userId: string): Promise<INylasGrant | null> {
    const user = await User.findById(userId).select('nylasGrant');
    return user?.nylasGrant || null;
  }

  /**
   * Find user by their Nylas grant ID
   */
  static async getUserByGrantId(grantId: string): Promise<IUser | null> {
    return User.findOne({ 'nylasGrant.grantId': grantId });
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
   * Revoke a user's Nylas grant
   */
  static async revokeGrant(userId: string): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { 'nylasGrant.status': 'revoked' } },
      { new: true },
    );

    if (user) {
      console.log(`[user-grant] Revoked grant for user ${userId}`);
    }

    return user;
  }

  /**
   * Mark a grant as expired by grant ID
   */
  static async markGrantExpired(grantId: string): Promise<IUser | null> {
    const user = await User.findOneAndUpdate(
      { 'nylasGrant.grantId': grantId },
      { $set: { 'nylasGrant.status': 'expired' } },
      { new: true },
    );

    if (user) {
      console.log(`[user-grant] Marked grant ${grantId.substring(0, 8)}... as expired`);
    }

    return user;
  }

  /**
   * Remove a user's Nylas grant completely
   */
  static async removeGrant(userId: string): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(
      userId,
      { $unset: { nylasGrant: 1 } },
      { new: true },
    );

    if (user) {
      console.log(`[user-grant] Removed grant for user ${userId}`);
    }

    return user;
  }

  /**
   * Check if a user has an active Nylas grant
   */
  static async hasActiveGrant(userId: string): Promise<boolean> {
    const user = await User.findById(userId).select('nylasGrant');
    return user?.nylasGrant?.status === 'active' && !!user.nylasGrant.grantId;
  }

  /**
   * Get all users in a company with active Nylas grants
   */
  static async getCompanyUsersWithGrants(
    companyId: string,
  ): Promise<IUser[]> {
    return User.find({
      companyId: new mongoose.Types.ObjectId(companyId),
      'nylasGrant.status': 'active',
      'nylasGrant.grantId': { $exists: true, $ne: null },
    });
  }
}
