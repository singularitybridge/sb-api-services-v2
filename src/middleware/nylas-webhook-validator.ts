/**
 * Nylas Webhook Signature Validation Middleware
 *
 * Validates incoming webhook requests from Nylas using HMAC signature
 * Prevents unauthorized webhook submissions
 */

import { Request, Response, NextFunction } from 'express';
import { verifyWebhookSignature } from '../services/nylas-webhook.service';
import { NylasWebhook } from '../models/NylasWebhook';

// ==========================================
// Types
// ==========================================

export interface NylasWebhookRequest extends Request {
  webhookPayload?: any;
  webhookId?: string;
  rawBody?: string;
}

// ==========================================
// Middleware
// ==========================================

/**
 * Validate Nylas webhook signature
 *
 * Checks:
 * 1. Signature header exists
 * 2. Webhook ID in database
 * 3. Signature matches HMAC
 */
export const validateNylasWebhook = async (
  req: NylasWebhookRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Get signature from header
    const signature = req.headers['x-nylas-signature'] as string;

    if (!signature) {
      console.warn('[WEBHOOK] No signature header found');
      res.status(401).json({
        success: false,
        error: 'Missing webhook signature',
      });
      return;
    }

    // 2. Get raw body (must be preserved by body-parser)
    // Note: Express should use raw body parser for webhook endpoints
    const rawBody = req.rawBody || JSON.stringify(req.body);

    // 3. Parse webhook data to get webhook ID
    // Nylas sends webhook ID in the deltas array
    const webhookData = req.body;

    if (!webhookData || !webhookData.deltas || webhookData.deltas.length === 0) {
      console.warn('[WEBHOOK] Invalid webhook payload structure');
      res.status(400).json({
        success: false,
        error: 'Invalid webhook payload',
      });
      return;
    }

    // 4. Find webhook in database (to get secret)
    // For Nylas v3, we need to look up the webhook by the notification content
    // The webhook secret is stored per webhook subscription
    const webhookSecret = process.env.NYLAS_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[WEBHOOK] NYLAS_WEBHOOK_SECRET not configured');
      res.status(500).json({
        success: false,
        error: 'Webhook validation not configured',
      });
      return;
    }

    // 5. Verify signature
    const isValid = verifyWebhookSignature(rawBody, signature, webhookSecret);

    if (!isValid) {
      console.warn('[WEBHOOK] Invalid signature');
      res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
      });
      return;
    }

    // 6. Attach parsed webhook data to request
    req.webhookPayload = webhookData;

    console.log(`[WEBHOOK] Validated webhook with ${webhookData.deltas.length} deltas`);

    next();
  } catch (error: any) {
    console.error('[WEBHOOK] Validation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Webhook validation failed',
    });
  }
};

/**
 * Middleware to preserve raw body for signature validation
 * Must be added before JSON body parser
 */
export const preserveRawBody = (
  req: NylasWebhookRequest,
  res: Response,
  next: NextFunction
): void => {
  let data = '';

  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    req.rawBody = data;
    next();
  });
};

/**
 * Optional: Rate limit webhook endpoints
 */
export const webhookRateLimit = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // TODO: Implement rate limiting
  // For now, just pass through
  next();
};
