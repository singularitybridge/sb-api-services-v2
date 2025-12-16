/**
 * Nylas Webhook Routes
 *
 * Receives forwarded webhook events from V3 microservice.
 * Handles grant lifecycle events (created, updated, expired, deleted).
 */

import { Router, Request, Response } from 'express';
import { GrantsService } from '../services/grants.service';

const router = Router();

/**
 * POST /webhooks/nylas/callback
 *
 * Receives forwarded webhook events from V3 microservice.
 * Handles grant lifecycle events (created, updated, expired, deleted).
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body;

    console.log(`[nylas-webhook] Received webhook: ${type}`);

    switch (type) {
      case 'grant.created':
      case 'grant.updated':
        // Grant was created or updated - no action needed
        // The grant is linked via /link-grant endpoint
        console.log(`[nylas-webhook] Grant ${type}: ${data?.grantId}`);
        break;

      case 'grant.expired':
        // Mark grant as expired
        if (data?.grantId) {
          await GrantsService.markGrantExpired(data.grantId);
          console.log(`[nylas-webhook] Grant expired: ${data.grantId}`);
        }
        break;

      case 'grant.deleted':
        // Grant was deleted from Nylas
        if (data?.grantId) {
          const user = await GrantsService.getUserByGrantId(data.grantId);
          if (user) {
            await GrantsService.removeGrant(user._id.toString());
            console.log(`[nylas-webhook] Grant deleted: ${data.grantId}`);
          }
        }
        break;

      default:
        console.log(`[nylas-webhook] Unhandled webhook type: ${type}`);
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[nylas-webhook] Webhook error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;
