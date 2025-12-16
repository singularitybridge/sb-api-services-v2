/**
 * Nylas Auth Routes
 *
 * Handles OAuth callback from V3 microservice and grant management.
 * These routes receive grant information after a user completes Nylas OAuth.
 */

import { Router, Request, Response } from 'express';
import { GrantsService, GrantData } from '../services/grants.service';
import { Invite, InviteStatus } from '../../../models/Invite';
import { User } from '../../../models/User';
import { verifyTokenMiddleware, verifyAccess } from '../../../middleware/auth.middleware';

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
        return res.status(400).json({
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
      await GrantsService.storeNylasGrant(user._id.toString(), grantData);

      // Mark invite as accepted
      invite.status = InviteStatus.ACCEPTED;
      invite.acceptedAt = new Date();
      await invite.save();

      console.log(`[nylas-auth] Invite ${invite.inviteToken.substring(0, 8)}... accepted`);
    }
    // Scenario 2: User ID provided - update existing user
    else if (userId) {
      await GrantsService.storeNylasGrant(userId, grantData);
      user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }
    }
    // Scenario 3: Company ID + email - find existing user in company
    else if (companyId && email) {
      user = await GrantsService.getUserByEmailAndCompany(email, companyId);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found in company',
        });
      }

      await GrantsService.storeNylasGrant(user._id.toString(), grantData);
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
 * GET /grant/:userId
 *
 * Get a user's Nylas grant status (requires authentication).
 * Users can view their own grant, admins can view any grant.
 */
router.get('/grant/:userId', verifyTokenMiddleware, verifyAccess(), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;

    // Check permission: user can view their own grant OR admin can view any
    if (userId !== requestingUserId) {
      const requestingUser = await User.findById(requestingUserId);
      if (!requestingUser || requestingUser.role !== 'Admin') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: Only administrators can view other users\' grants',
        });
      }
    }

    const grant = await GrantsService.getUserGrant(userId);

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
 * Revoke a user's Nylas grant (requires authentication and admin role).
 */
router.delete('/grant/:userId', verifyTokenMiddleware, verifyAccess(), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.userId;

    // Admin-only action
    const requestingUser = await User.findById(requestingUserId);
    if (!requestingUser || requestingUser.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only administrators can revoke grants',
      });
    }

    await GrantsService.revokeGrant(userId);

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
 * Get all users with active grants in a company (requires authentication and admin role).
 * Admin must belong to the company they're querying.
 */
router.get('/company-grants/:companyId', verifyTokenMiddleware, verifyAccess(), async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const requestingUserId = (req as any).user?.userId;

    // Admin-only action
    const requestingUser = await User.findById(requestingUserId);
    if (!requestingUser || requestingUser.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Only administrators can list company grants',
      });
    }

    // Verify user belongs to the company they're querying
    if (requestingUser.companyId.toString() !== companyId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Cannot access grants from a different company',
      });
    }

    const users = await GrantsService.getCompanyUsersWithGrants(companyId);

    // Get grants for each user
    const usersWithGrants = await Promise.all(
      users.map(async (u) => {
        const grant = await GrantsService.getUserGrant(u._id.toString());
        return {
          userId: u._id,
          name: u.name,
          email: u.email,
          grant: grant ? {
            email: grant.email,
            provider: grant.provider,
            status: grant.status,
          } : null,
        };
      })
    );

    return res.json({
      success: true,
      count: usersWithGrants.length,
      users: usersWithGrants,
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
