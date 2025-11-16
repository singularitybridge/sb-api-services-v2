import express, { Request, Response } from 'express';
import { verifyTokenMiddleware } from '../middleware/auth.middleware';
import { InviteService } from '../services/invite.service';
import { InviteStatus, InviteSource } from '../models/Invite';

const inviteRouter = express.Router();

/**
 * POST /api/invites
 * Create a new invite
 */
inviteRouter.post('/', verifyTokenMiddleware, async (req: Request, res: Response) => {
  try {
    const { email, name, role } = req.body;
    const companyId = (req as any).company._id.toString();
    const userId = (req as any).user._id.toString();

    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check invite quota (rate limiting)
    const quota = await InviteService.checkInviteQuota(userId, 10);
    if (!quota.canInvite) {
      return res.status(429).json({
        error: 'Invite limit reached. Please try again later.',
        resetAt: quota.resetAt,
      });
    }

    // Extract metadata from request
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      source: InviteSource.DASHBOARD,
    };

    // Create invite
    const invite = await InviteService.createInvite(
      email,
      companyId,
      userId,
      name,
      role,
      metadata,
    );

    // Return success
    res.status(201).json({
      invite: {
        _id: invite._id,
        email: invite.email,
        name: invite.name,
        status: invite.status,
        role: invite.role,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
      message: 'Invite sent successfully',
    });
  } catch (error: any) {
    console.error('Error creating invite:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    // Handle specific error messages
    if (error.message.includes('Invalid email')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('already exists') || error.message.includes('already a member')) {
      return res.status(409).json({ error: error.message });
    }
    if (error.message.includes('Unable to send invite')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.message.includes('not belong')) {
      return res.status(403).json({ error: 'Not authorized to send invites for this company' });
    }

    res.status(500).json({ error: 'Failed to create invite' });
  }
});

/**
 * GET /api/invites
 * List invites for the authenticated user's company
 */
inviteRouter.get('/', verifyTokenMiddleware, async (req: Request, res: Response) => {
  try {
    const companyId = (req as any).company._id.toString();

    // Parse query parameters
    const status = req.query.status as InviteStatus | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

    // Validate status if provided
    if (status && !Object.values(InviteStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Get invites
    const { invites, total } = await InviteService.listInvites(companyId, {
      status,
      limit,
      offset,
    });

    res.json({
      invites,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error listing invites:', error);
    res.status(500).json({ error: 'Failed to list invites' });
  }
});

/**
 * DELETE /api/invites/:id/revoke
 * Revoke a pending invite
 */
inviteRouter.delete('/:id/revoke', verifyTokenMiddleware, async (req: Request, res: Response) => {
  try {
    const inviteId = req.params.id;
    const companyId = (req as any).company._id.toString();

    // Revoke the invite
    const invite = await InviteService.revokeInvite(inviteId, companyId);

    res.json({
      message: 'Invite revoked successfully',
      invite: {
        _id: invite._id,
        email: invite.email,
        status: invite.status,
      },
    });
  } catch (error: any) {
    console.error('Error revoking invite:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    if (error.message.includes('Not authorized')) {
      return res.status(403).json({ error: error.message });
    }
    if (error.message.includes('Cannot revoke')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

/**
 * GET /api/invites/:id
 * Get a specific invite by ID
 */
inviteRouter.get('/:id', verifyTokenMiddleware, async (req: Request, res: Response) => {
  try {
    const inviteId = req.params.id;
    const companyId = (req as any).company._id.toString();

    const { invites } = await InviteService.listInvites(companyId);
    const invite = invites.find((inv) => inv._id.toString() === inviteId);

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    res.json({ invite });
  } catch (error) {
    console.error('Error getting invite:', error);
    res.status(500).json({ error: 'Failed to get invite' });
  }
});

/**
 * DELETE /api/invites/:id
 * Permanently delete an invite (hard delete)
 */
inviteRouter.delete('/:id', verifyTokenMiddleware, async (req: Request, res: Response) => {
  try {
    const inviteId = req.params.id;
    const companyId = (req as any).company._id.toString();

    // Delete the invite permanently
    const result = await InviteService.deleteInvite(inviteId, companyId);

    res.json({
      message: 'Invite deleted successfully',
      deleted: result,
    });
  } catch (error: any) {
    console.error('Error deleting invite:', error);

    if (error.message.includes('not found')) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    if (error.message.includes('Not authorized')) {
      return res.status(403).json({ error: error.message });
    }

    res.status(500).json({ error: 'Failed to delete invite' });
  }
});

export { inviteRouter };
