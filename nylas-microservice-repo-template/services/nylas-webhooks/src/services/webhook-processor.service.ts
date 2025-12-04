/**
 * Webhook Processor Service
 *
 * Processes Nylas webhook events and forwards to main app
 */

import axios from 'axios';
import { config } from '../config.js';
import crypto from 'crypto';

// ==========================================
// Type Definitions
// ==========================================

export interface WebhookEvent {
  id: string;
  type: string;
  specversion: string;
  source: string;
  time: string;
  data: {
    object: any;
    application_id?: string;
    grant_id?: string;
  };
}

export interface WebhookPayload {
  deltas: WebhookEvent[];
}

// ==========================================
// Webhook Signature Verification
// ==========================================

/**
 * Verify Nylas webhook signature
 * Uses HMAC-SHA256 with webhook secret
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature || !secret) {
    console.warn('[WEBHOOK] Signature verification skipped (no signature or secret)');
    return true; // Allow if not configured (development mode)
  }

  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    return signature === expectedSignature;
  } catch (error: any) {
    console.error('[WEBHOOK] Signature verification error:', error.message);
    return false;
  }
}

// ==========================================
// Event Processing
// ==========================================

/**
 * Process a webhook event
 * Routes to appropriate handler based on event type
 */
export async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  const { type, data } = event;

  console.log('[WEBHOOK] Processing event:', {
    id: event.id,
    type: event.type,
    grantId: data.grant_id,
    timestamp: event.time,
  });

  try {
    // Route to appropriate handler
    switch (type) {
      case 'message.created':
        await handleMessageCreated(event);
        break;

      case 'message.updated':
        await handleMessageUpdated(event);
        break;

      case 'thread.created':
        await handleThreadCreated(event);
        break;

      case 'event.created':
        await handleEventCreated(event);
        break;

      case 'event.updated':
        await handleEventUpdated(event);
        break;

      case 'event.deleted':
        await handleEventDeleted(event);
        break;

      case 'contact.created':
        await handleContactCreated(event);
        break;

      case 'contact.updated':
        await handleContactUpdated(event);
        break;

      case 'grant.expired':
        await handleGrantExpired(event);
        break;

      default:
        console.warn('[WEBHOOK] Unknown event type:', type);
        await forwardToMainApp(event);
    }
  } catch (error: any) {
    console.error('[WEBHOOK] Event processing error:', error.message);
    throw error;
  }
}

// ==========================================
// Event Handlers
// ==========================================

async function handleMessageCreated(event: WebhookEvent): Promise<void> {
  console.log('[WEBHOOK] New message received:', event.data.object.id);
  await forwardToMainApp(event);
}

async function handleMessageUpdated(event: WebhookEvent): Promise<void> {
  console.log('[WEBHOOK] Message updated:', event.data.object.id);
  await forwardToMainApp(event);
}

async function handleThreadCreated(event: WebhookEvent): Promise<void> {
  console.log('[WEBHOOK] New thread created:', event.data.object.id);
  await forwardToMainApp(event);
}

async function handleEventCreated(event: WebhookEvent): Promise<void> {
  console.log('[WEBHOOK] Calendar event created:', event.data.object.id);
  await forwardToMainApp(event);
}

async function handleEventUpdated(event: WebhookEvent): Promise<void> {
  console.log('[WEBHOOK] Calendar event updated:', event.data.object.id);
  await forwardToMainApp(event);
}

async function handleEventDeleted(event: WebhookEvent): Promise<void> {
  console.log('[WEBHOOK] Calendar event deleted:', event.data.object.id);
  await forwardToMainApp(event);
}

async function handleContactCreated(event: WebhookEvent): Promise<void> {
  console.log('[WEBHOOK] Contact created:', event.data.object.id);
  await forwardToMainApp(event);
}

async function handleContactUpdated(event: WebhookEvent): Promise<void> {
  console.log('[WEBHOOK] Contact updated:', event.data.object.id);
  await forwardToMainApp(event);
}

async function handleGrantExpired(event: WebhookEvent): Promise<void> {
  console.log('[WEBHOOK] Grant expired:', event.data.grant_id);
  await forwardToMainApp(event);

  // Could also handle locally (mark account as inactive in database)
}

// ==========================================
// Forward to Main App
// ==========================================

/**
 * Forward webhook event to main Express app for further processing
 */
async function forwardToMainApp(event: WebhookEvent): Promise<void> {
  try {
    const response = await axios.post(
      `${config.mainAppUrl}/api/webhooks/nylas/process`,
      event,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': 'nylas-webhooks-service',
        },
        timeout: 5000,
      }
    );

    console.log('[WEBHOOK] Forwarded to main app:', {
      eventId: event.id,
      status: response.status,
    });
  } catch (error: any) {
    console.error('[WEBHOOK] Failed to forward to main app:', {
      eventId: event.id,
      error: error.message,
    });

    // Don't throw - webhook is already processed
    // Main app can handle eventual consistency
  }
}

// ==========================================
// Batch Processing
// ==========================================

/**
 * Process multiple webhook events in batch
 */
export async function processBatchWebhooks(payload: WebhookPayload): Promise<{
  processed: number;
  failed: number;
  errors: Array<{ eventId: string; error: string }>;
}> {
  const results = {
    processed: 0,
    failed: 0,
    errors: [] as Array<{ eventId: string; error: string }>,
  };

  // Process events sequentially to maintain order
  for (const event of payload.deltas) {
    try {
      await processWebhookEvent(event);
      results.processed++;
    } catch (error: any) {
      results.failed++;
      results.errors.push({
        eventId: event.id,
        error: error.message,
      });
    }
  }

  return results;
}
