/**
 * Nylas Auth Routes
 *
 * Handles OAuth callback from V3 microservice and webhook events.
 * These routes receive grant information after a user completes Nylas OAuth.
 */

import { Router, Request, Response } from 'express';
import { UserGrantService, GrantData } from '../services/user-grant.service';
import { Invite, InviteStatus } from '../models/Invite';
import { User } from '../models/User';
import mongoose from 'mongoose';

const router = Router();

/**
 * POST /link-grant
 *
 * Called by V3 microservice after successful OAuth to link grant to user.
 * Can be called with:
 * 1. inviteToken - Links grant to user created from invite
 * 2. userId - Links grant to existing user
 * 3. companyId + email - Finds existing user in company
 */
router.post('/link-grant', async (req: Request, res: Response) => {
  try {
    const {
      grantId,
      email,
      provider,
      scopes,
      expiresAt,
      inviteToken,
      userId,
      companyId,
    } = req.body;

    if (!grantId || !email) {
      return res.status(400).json({
        success: false,
        error: 'grantId and email are required',
      });
    }

    console.log(`[nylas-auth] Linking grant ${grantId.substring(0, 8)}... for ${email}`);

    const grantData: GrantData = {
      grantId,
      email,
      provider: provider || 'unknown',
      scopes,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };

    let user = null;

    // Scenario 1: Invite token provided - create/update user from invite
    if (inviteToken) {
      const invite = await Invite.findOne({ inviteToken });

      if (!invite) {
        return res.status(404).json({
          success: false,
          error: 'Invite not found',
        });
      }

      if (invite.status !== 'pending') {
        return res.status(400).json({
          success: false,
          error: `Invite is ${invite.status}, not pending`,
        });
      }

      // Check if user already exists for this invite
      user = await User.findOne({
        email: invite.email.toLowerCase(),
        companyId: invite.companyId,
      });

      if (!user) {
        // Create new user from invite
        user = new User({
          name: invite.email.split('@')[0],
          email: invite.email.toLowerCase(),
          companyId: invite.companyId,
          role: 'CompanyUser',
        });
        await user.save();
        console.log(`[nylas-auth] Created new user ${user._id} from invite`);
      }

      // Store the grant
      user = await UserGrantService.storeNylasGrant(user._id.toString(), grantData);

      // Mark invite as accepted
      invite.status = InviteStatus.ACCEPTED;
      invite.acceptedAt = new Date();
      await invite.save();

      console.log(`[nylas-auth] Invite ${invite.inviteToken.substring(0, 8)}... accepted`);
    }
    // Scenario 2: User ID provided - update existing user
    else if (userId) {
      user = await UserGrantService.storeNylasGrant(userId, grantData);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }
    }
    // Scenario 3: Company ID + email - find existing user in company
    else if (companyId && email) {
      user = await UserGrantService.getUserByEmailAndCompany(email, companyId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found in company',
        });
      }

      user = await UserGrantService.storeNylasGrant(user._id.toString(), grantData);
    }
    else {
      return res.status(400).json({
        success: false,
        error: 'Must provide inviteToken, userId, or companyId+email',
      });
    }

    return res.json({
      success: true,
      userId: user?._id,
      grantLinked: true,
    });
  } catch (error: any) {
    console.error('[nylas-auth] Error linking grant:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /webhooks/nylas/callback
 *
 * Receives forwarded webhook events from V3 microservice.
 * Handles grant lifecycle events (created, updated, expired, deleted).
 */
router.post('/webhooks/nylas/callback', async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    console.log(`[nylas-auth] Received webhook: ${type}`);

    switch (type) {
      case 'grant.created':
      case 'grant.updated':
        // Grant was created or updated - no action needed
        // The grant is linked via /link-grant endpoint
        console.log(`[nylas-auth] Grant ${type}: ${data?.grantId}`);
        break;

      case 'grant.expired':
        // Mark grant as expired
        if (data?.grantId) {
          await UserGrantService.markGrantExpired(data.grantId);
          console.log(`[nylas-auth] Grant expired: ${data.grantId}`);
        }
        break;

      case 'grant.deleted':
        // Grant was deleted from Nylas
        if (data?.grantId) {
          const user = await UserGrantService.getUserByGrantId(data.grantId);
          if (user) {
            await UserGrantService.removeGrant(user._id.toString());
            console.log(`[nylas-auth] Grant deleted: ${data.grantId}`);
          }
        }
        break;

      default:
        console.log(`[nylas-auth] Unhandled webhook type: ${type}`);
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[nylas-auth] Webhook error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /grant/:userId
 *
 * Get a user's Nylas grant status (requires authentication).
 */
router.get('/grant/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const grant = await UserGrantService.getUserGrant(userId);

    if (!grant) {
      return res.json({
        success: true,
        hasGrant: false,
        grant: null,
      });
    }

    return res.json({
      success: true,
      hasGrant: true,
      grant: {
        email: grant.email,
        provider: grant.provider,
        status: grant.status,
        createdAt: grant.createdAt,
        expiresAt: grant.expiresAt,
      },
    });
  } catch (error: any) {
    console.error('[nylas-auth] Error getting grant:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * DELETE /grant/:userId
 *
 * Revoke a user's Nylas grant (requires authentication).
 */
router.delete('/grant/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await UserGrantService.revokeGrant(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    return res.json({
      success: true,
      revoked: true,
    });
  } catch (error: any) {
    console.error('[nylas-auth] Error revoking grant:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /company-grants/:companyId
 *
 * Get all users with active grants in a company (requires authentication).
 */
router.get('/company-grants/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    const users = await UserGrantService.getCompanyUsersWithGrants(companyId);

    return res.json({
      success: true,
      count: users.length,
      users: users.map((u) => ({
        userId: u._id,
        name: u.name,
        email: u.email,
        grant: u.nylasGrant ? {
          email: u.nylasGrant.email,
          provider: u.nylasGrant.provider,
          status: u.nylasGrant.status,
        } : null,
      })),
    });
  } catch (error: any) {
    console.error('[nylas-auth] Error getting company grants:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;
