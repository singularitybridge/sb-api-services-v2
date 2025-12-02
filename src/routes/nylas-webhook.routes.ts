/**
 * Nylas Webhook Routes
 *
 * Handles incoming webhook notifications from Nylas
 * Updates cache in real-time based on calendar/email changes
 */

import express, { Router, Request, Response } from 'express';
import {
  validateNylasWebhook,
  preserveRawBody,
  NylasWebhookRequest,
} from '../middleware/nylas-webhook-validator';
import {
  createNylasWebhook,
  deleteNylasWebhook,
  listNylasWebhooks,
  syncWebhooksWithNylas,
  setupWebhooksForCompany,
} from '../services/nylas-webhook.service';
import { NylasWebhook } from '../models/NylasWebhook';
import { NylasEventCache } from '../models/NylasEventCache';
import { NylasAccount } from '../models/NylasAccount';
import { verifyTokenMiddleware } from '../middleware/auth.middleware';

const router: Router = express.Router();

// ==========================================
// Webhook Processing Functions
// ==========================================

/**
 * Process calendar event webhook
 */
const processCalendarWebhook = async (delta: any): Promise<void> => {
  const { type, object, grant_id } = delta;
  const event = object;

  console.log(`[WEBHOOK] Calendar ${type} for event ${event.id}`);

  // Find Nylas account by grant ID
  const nylasAccount = await NylasAccount.findOne({
    nylasGrantId: grant_id,
    status: 'active',
  });

  if (!nylasAccount) {
    console.warn(`[WEBHOOK] No active account found for grant ${grant_id}`);
    return;
  }

  if (type === 'calendar.deleted') {
    // Delete from cache
    await NylasEventCache.deleteEvent(grant_id, 'calendar', event.id);
  } else {
    // Upsert to cache (created or updated)
    await NylasEventCache.upsertEvent(
      grant_id,
      'calendar',
      event.id,
      {
        title: event.title,
        startTime: event.when?.start_time,
        endTime: event.when?.end_time,
        participants: event.participants,
        status: event.status,
        raw: event,
      },
      24 // TTL: 24 hours
    );
  }
};

/**
 * Process message (email) webhook
 */
const processMessageWebhook = async (delta: any): Promise<void> => {
  const { type, object, grant_id } = delta;
  const message = object;

  console.log(`[WEBHOOK] Message ${type} for message ${message.id}`);

  // Find Nylas account by grant ID
  const nylasAccount = await NylasAccount.findOne({
    nylasGrantId: grant_id,
    status: 'active',
  });

  if (!nylasAccount) {
    console.warn(`[WEBHOOK] No active account found for grant ${grant_id}`);
    return;
  }

  if (type === 'message.deleted') {
    // Delete from cache
    await NylasEventCache.deleteEvent(grant_id, 'message', message.id);
  } else {
    // Upsert to cache
    await NylasEventCache.upsertEvent(
      grant_id,
      'message',
      message.id,
      {
        subject: message.subject,
        from: message.from,
        to: message.to,
        body: message.snippet || message.body,
        raw: message,
      },
      24 // TTL: 24 hours
    );
  }
};

// ==========================================
// Webhook Receiver Endpoint
// ==========================================

/**
 * POST /webhooks/nylas
 * Receive webhook notifications from Nylas
 */
router.post(
  '/nylas',
  express.json({ limit: '10mb' }),
  preserveRawBody,
  validateNylasWebhook,
  async (req: NylasWebhookRequest, res: Response): Promise<void> => {
    try {
      const webhookPayload = req.webhookPayload;

      if (!webhookPayload || !webhookPayload.deltas) {
        res.status(400).json({
          success: false,
          error: 'Invalid webhook payload',
        });
        return;
      }

      // Process each delta in parallel
      const deltas = webhookPayload.deltas;
      const promises = deltas.map(async (delta: any) => {
        const { type } = delta;

        try {
          if (type.startsWith('calendar.')) {
            await processCalendarWebhook(delta);
          } else if (type.startsWith('message.')) {
            await processMessageWebhook(delta);
          } else {
            console.log(`[WEBHOOK] Unhandled webhook type: ${type}`);
          }
        } catch (error: any) {
          console.error(`[WEBHOOK] Error processing ${type}:`, error.message);
        }
      });

      await Promise.allSettled(promises);

      // Mark webhook delivery as successful
      // (Webhook ID tracking would be per-subscription in production)
      console.log(`[WEBHOOK] Successfully processed ${deltas.length} deltas`);

      res.status(200).json({
        success: true,
        processed: deltas.length,
      });
    } catch (error: any) {
      console.error('[WEBHOOK] Error processing webhook:', error.message);
      res.status(500).json({
        success: false,
        error: 'Failed to process webhook',
      });
    }
  }
);

// ==========================================
// Webhook Management Endpoints (Protected)
// ==========================================

/**
 * POST /webhooks/setup/:companyId
 * Setup webhooks for all accounts in a company
 */
router.post(
  '/setup/:companyId',
  verifyTokenMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyId } = req.params;

      const result = await setupWebhooksForCompany(companyId);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[WEBHOOK] Setup error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /webhooks/list/:companyId
 * List all webhooks for a company
 */
router.get(
  '/list/:companyId',
  verifyTokenMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyId } = req.params;

      const webhooks = await NylasWebhook.find({
        companyId,
      }).populate('nylasAccountId');

      res.status(200).json({
        success: true,
        webhooks,
      });
    } catch (error: any) {
      console.error('[WEBHOOK] List error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * DELETE /webhooks/:webhookId
 * Delete a webhook subscription
 */
router.delete(
  '/:webhookId',
  verifyTokenMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { webhookId } = req.params;

      const result = await deleteNylasWebhook(webhookId);

      res.status(200).json(result);
    } catch (error: any) {
      console.error('[WEBHOOK] Delete error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * POST /webhooks/sync/:companyId
 * Sync webhooks with Nylas API
 */
router.post(
  '/sync/:companyId',
  verifyTokenMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyId } = req.params;

      const result = await syncWebhooksWithNylas(companyId);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[WEBHOOK] Sync error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

/**
 * GET /webhooks/cache/stats/:companyId
 * Get cache statistics
 */
router.get(
  '/cache/stats/:companyId',
  verifyTokenMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { companyId } = req.params;

      const stats = await NylasEventCache.getCacheStats(companyId);

      res.status(200).json({
        success: true,
        stats,
      });
    } catch (error: any) {
      console.error('[WEBHOOK] Stats error:', error.message);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;
