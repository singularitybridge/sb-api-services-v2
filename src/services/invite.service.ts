import validator from 'validator';
import mongoose from 'mongoose';
import { Invite, IInvite, InviteStatus, InviteSource } from '../models/Invite';
import { User } from '../models/User';
import { Company } from '../models/Company';
import { InvitationEmailService, InviteData } from './invitation-email.service';

export class InviteService {
  /**
   * Create a new invite
   * @param email - Email address to invite
   * @param companyId - Company ID inviting the user
   * @param invitedById - User ID who is sending the invite
   * @param name - Optional name for the invitee
   * @param role - Optional role to assign (default: CompanyUser)
   * @param metadata - Optional metadata (IP, user agent, source)
   */
  static async createInvite(
    email: string,
    companyId: string,
    invitedById: string,
    name?: string,
    role?: 'Admin' | 'CompanyUser',
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      source?: InviteSource;
    },
  ): Promise<IInvite> {
    // 1. Validate email format
    if (!validator.isEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Verify inviter belongs to the company
    const inviter = await User.findById(invitedById);
    if (!inviter) {
      throw new Error('Inviter not found');
    }

    if (inviter.companyId.toString() !== companyId) {
      throw new Error('Inviter does not belong to this company');
    }

    // 3. Check if user already exists in the system
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      // Check if user is in the same company
      if (existingUser.companyId.toString() === companyId) {
        throw new Error('User is already a member of this company');
      }
      // User exists in different company - don't reveal this for security
      throw new Error('Unable to send invite. Please contact support.');
    }

    // 4. Check for duplicate pending invite
    const existingInvite = await Invite.findOne({
      email: normalizedEmail,
      companyId,
      status: InviteStatus.PENDING,
    });

    if (existingInvite) {
      throw new Error('A pending invite already exists for this email');
    }

    // 5. Verify company exists
    const company = await Company.findById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    // 6. Create invite with 7-day expiration
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await Invite.create({
      email: normalizedEmail,
      name,
      companyId,
      invitedBy: invitedById,
      role: role || 'CompanyUser',
      status: InviteStatus.PENDING,
      expiresAt,
      metadata: {
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        source: metadata?.source || InviteSource.DASHBOARD,
      },
    });

    // Send invitation email (non-blocking)
    try {
      const inviteData: InviteData = {
        _id: invite._id.toString(),
        email: invite.email,
        companyId: companyId,
        invitedBy: invitedById,
        inviteToken: invite.inviteToken,
        expiresAt: invite.expiresAt,
      };

      await InvitationEmailService.sendInvitationEmail({
        invite: inviteData,
        inviterName: inviter.name,
        companyName: company.name,
        companyId: companyId,
      });
    } catch (emailError: any) {
      // Log but don't fail the invite creation if email fails
      console.error(`[invite] Failed to send invitation email: ${emailError.message}`);
    }

    return invite;
  }

  /**
   * List invites for a company with optional filters
   */
  static async listInvites(
    companyId: string,
    filters?: {
      status?: InviteStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ invites: IInvite[]; total: number }> {
    const query: any = { companyId };

    if (filters?.status) {
      query.status = filters.status;
    }

    const limit = filters?.limit || 20;
    const offset = filters?.offset || 0;

    const [invites, total] = await Promise.all([
      Invite.find(query)
        .populate('invitedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .lean(),
      Invite.countDocuments(query),
    ]);

    return { invites: invites as IInvite[], total };
  }

  /**
   * Revoke a pending invite
   */
  static async revokeInvite(
    inviteId: string,
    companyId: string,
  ): Promise<IInvite> {
    const invite = await Invite.findById(inviteId);

    if (!invite) {
      throw new Error('Invite not found');
    }

    // Verify invite belongs to the company
    if (invite.companyId.toString() !== companyId) {
      throw new Error('Not authorized to revoke this invite');
    }

    // Can only revoke pending invites
    if (invite.status !== InviteStatus.PENDING) {
      throw new Error(`Cannot revoke invite with status: ${invite.status}`);
    }

    invite.status = InviteStatus.REVOKED;
    await invite.save();

    return invite;
  }

  /**
   * Find an active (pending, non-expired) invite by email
   */
  static async findActiveInvite(email: string): Promise<IInvite | null> {
    const normalizedEmail = email.toLowerCase().trim();

    const invite = await Invite.findOne({
      email: normalizedEmail,
      status: InviteStatus.PENDING,
      expiresAt: { $gt: new Date() },
    })
      .populate('companyId')
      .populate('invitedBy', 'name email');

    return invite;
  }

  /**
   * Accept an invite (mark as accepted)
   * Should be called within a transaction from googleAuth.service
   */
  static async acceptInvite(
    inviteId: string,
    session?: mongoose.ClientSession,
  ): Promise<IInvite> {
    const invite = await Invite.findById(inviteId).session(session || null);

    if (!invite) {
      throw new Error('Invite not found');
    }

    if (invite.status !== InviteStatus.PENDING) {
      throw new Error('Invite is not pending');
    }

    if (invite.expiresAt < new Date()) {
      throw new Error('Invite has expired');
    }

    invite.status = InviteStatus.ACCEPTED;
    invite.acceptedAt = new Date();
    await invite.save({ session });

    return invite;
  }

  /**
   * Get invite by token
   */
  static async findByToken(token: string): Promise<IInvite | null> {
    const invite = await Invite.findOne({
      inviteToken: token,
      status: InviteStatus.PENDING,
      expiresAt: { $gt: new Date() },
    })
      .populate('companyId')
      .populate('invitedBy', 'name email');

    return invite;
  }

  /**
   * Permanently delete an invite (hard delete)
   */
  static async deleteInvite(
    inviteId: string,
    companyId: string,
  ): Promise<boolean> {
    const invite = await Invite.findById(inviteId);

    if (!invite) {
      throw new Error('Invite not found');
    }

    // Verify invite belongs to the company
    if (invite.companyId.toString() !== companyId) {
      throw new Error('Not authorized to delete this invite');
    }

    await Invite.findByIdAndDelete(inviteId);

    return true;
  }

  /**
   * Cleanup expired invites (can be used in a cron job)
   * Note: MongoDB TTL index handles this automatically, but this is useful for manual cleanup
   */
  static async cleanupExpiredInvites(): Promise<number> {
    const result = await Invite.updateMany(
      {
        status: InviteStatus.PENDING,
        expiresAt: { $lt: new Date() },
      },
      {
        status: InviteStatus.EXPIRED,
      },
    );

    return result.modifiedCount;
  }

  /**
   * Validate if user can send invites (rate limiting check)
   * Returns remaining invite quota for the hour
   */
  static async checkInviteQuota(
    userId: string,
    maxPerHour: number = 10,
  ): Promise<{ canInvite: boolean; remaining: number; resetAt: Date }> {
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const recentInvites = await Invite.countDocuments({
      invitedBy: userId,
      createdAt: { $gte: oneHourAgo },
    });

    const remaining = Math.max(0, maxPerHour - recentInvites);
    const resetAt = new Date(oneHourAgo.getTime() + 60 * 60 * 1000);

    return {
      canInvite: remaining > 0,
      remaining,
      resetAt,
    };
  }

  /**
   * Resend invitation email
   * @param inviteId - The invite ID to resend
   * @param companyId - Company ID for authorization
   * @param resenderId - User ID who is resending (for rate limiting)
   */
  static async resendInviteEmail(
    inviteId: string,
    companyId: string,
    resenderId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const invite = await Invite.findById(inviteId);

    if (!invite) {
      throw new Error('Invite not found');
    }

    // Verify invite belongs to the company
    if (invite.companyId.toString() !== companyId) {
      throw new Error('Not authorized to resend this invite');
    }

    // Can only resend pending invites
    if (invite.status !== InviteStatus.PENDING) {
      throw new Error(`Cannot resend invite with status: ${invite.status}`);
    }

    // Check if invite has expired
    if (invite.expiresAt < new Date()) {
      throw new Error('Invite has expired');
    }

    // Check resend limit
    if (invite.resendCount >= 3) {
      throw new Error('Maximum resend limit reached for this invite');
    }

    // Get inviter and company info
    const [inviter, company] = await Promise.all([
      User.findById(resenderId),
      Company.findById(companyId),
    ]);

    if (!inviter || !company) {
      throw new Error('Inviter or company not found');
    }

    // Send the email
    const inviteData: InviteData = {
      _id: invite._id.toString(),
      email: invite.email,
      companyId: companyId,
      invitedBy: resenderId,
      inviteToken: invite.inviteToken,
      expiresAt: invite.expiresAt,
    };

    const result = await InvitationEmailService.resendInvitationEmail({
      invite: inviteData,
      inviterName: inviter.name,
      companyName: company.name,
      companyId: companyId,
    });

    if (result.success) {
      // Update resend count
      invite.resendCount += 1;
      invite.lastResendAt = new Date();
      await invite.save();
    }

    return result;
  }
}
