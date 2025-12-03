/**
 * Nylas Webhook Service
 *
 * Functional service for managing Nylas webhook subscriptions
 * Handles creation, deletion, and status tracking of webhooks
 */

import axios from 'axios';
import crypto from 'crypto';
import { NylasWebhook, INylasWebhook } from '../models/NylasWebhook';
import { NylasAccount } from '../models/NylasAccount';
import { Types } from 'mongoose';

const NYLAS_API_URL = 'https://api.us.nylas.com';

// ==========================================
// Types
// ==========================================

export interface WebhookSubscription {
  id: string;
  webhookUrl: string;
  triggers: string[];
  webhookSecret?: string;
  status: string;
}

export interface CreateWebhookParams {
  companyId: string;
  nylasAccountId: string;
  triggerTypes: string[];
  webhookUrl: string;
}

export interface WebhookNotification {
  id: string;
  type: string;
  data: any;
  timestamp: number;
}

// ==========================================
// Helper: Get API Key
// ==========================================

const getApiKey = async (): Promise<string> => {
  const apiKey = process.env.NYLAS_API_KEY;
  if (!apiKey) {
    throw new Error('NYLAS_API_KEY not configured');
  }
  return apiKey;
};

// ==========================================
// Pure Functions
// ==========================================

/**
 * Generate HMAC signature for webhook validation
 */
export const generateWebhookSignature = (
  payload: string,
  secret: string
): string => {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
};

/**
 * Verify webhook signature
 */
export const verifyWebhookSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  const expectedSignature = generateWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};

/**
 * Generate secure webhook secret
 */
const generateWebhookSecret = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// ==========================================
// Nylas API Functions
// ==========================================

/**
 * Create webhook subscription via Nylas API
 */
export const createNylasWebhook = async (
  params: CreateWebhookParams
): Promise<{ success: boolean; webhook?: INylasWebhook; error?: string }> => {
  try {
    // 1. Get Nylas account details
    const nylasAccount = await NylasAccount.findOne({
      _id: new Types.ObjectId(params.nylasAccountId),
      companyId: new Types.ObjectId(params.companyId),
      status: 'active',
    });

    if (!nylasAccount) {
      return { success: false, error: 'Nylas account not found or inactive' };
    }

    // 2. Check if webhook already exists
    const existing = await NylasWebhook.findOne({
      nylasAccountId: new Types.ObjectId(params.nylasAccountId),
      status: 'active',
    });

    if (existing) {
      return {
        success: true,
        webhook: existing,
      };
    }

    // 3. Generate webhook secret
    const webhookSecret = generateWebhookSecret();

    // 4. Create webhook via Nylas API
    const apiKey = await getApiKey();
    const url = `${NYLAS_API_URL}/v3/webhooks`;

    const response = await axios.post(
      url,
      {
        webhook_url: params.webhookUrl,
        triggers: params.triggerTypes,
        webhook_secret: webhookSecret,
        description: `Webhook for grant ${nylasAccount.nylasGrantId}`,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const webhookData = response.data.data;

    // 5. Save to database
    const webhook = await NylasWebhook.create({
      companyId: new Types.ObjectId(params.companyId),
      nylasAccountId: new Types.ObjectId(params.nylasAccountId),
      webhookId: webhookData.id,
      triggerTypes: params.triggerTypes,
      webhookUrl: params.webhookUrl,
      webhookSecret,
      status: 'active',
      metadata: {
        createdVia: 'auto',
      },
    });

    console.log(`[WEBHOOK] Created webhook ${webhookData.id} for grant ${nylasAccount.nylasGrantId}`);

    return { success: true, webhook };
  } catch (error: any) {
    console.error('[WEBHOOK] Error creating webhook:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to create webhook',
    };
  }
};

/**
 * Delete webhook subscription
 */
export const deleteNylasWebhook = async (
  webhookId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // 1. Get webhook from database
    const webhook = await NylasWebhook.findOne({ webhookId });

    if (!webhook) {
      return { success: false, error: 'Webhook not found' };
    }

    // 2. Delete from Nylas API
    const apiKey = await getApiKey();
    const url = `${NYLAS_API_URL}/v3/webhooks/${webhookId}`;

    await axios.delete(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    // 3. Update database status
    webhook.status = 'inactive';
    await webhook.save();

    console.log(`[WEBHOOK] Deleted webhook ${webhookId}`);

    return { success: true };
  } catch (error: any) {
    console.error('[WEBHOOK] Error deleting webhook:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to delete webhook',
    };
  }
};

/**
 * List all webhooks from Nylas API
 */
export const listNylasWebhooks = async (): Promise<WebhookSubscription[]> => {
  try {
    const apiKey = await getApiKey();
    const url = `${NYLAS_API_URL}/v3/webhooks`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return response.data.data || [];
  } catch (error: any) {
    console.error('[WEBHOOK] Error listing webhooks:', error.message);
    return [];
  }
};

/**
 * Sync database with Nylas webhooks
 */
export const syncWebhooksWithNylas = async (
  companyId: string
): Promise<{
  synced: number;
  created: number;
  deactivated: number;
}> => {
  try {
    // 1. Get webhooks from Nylas API
    const nylasWebhooks = await listNylasWebhooks();

    // 2. Get webhooks from database
    const dbWebhooks = await NylasWebhook.find({
      companyId: new Types.ObjectId(companyId),
    });

    let synced = 0;
    let created = 0;
    let deactivated = 0;

    // 3. Mark missing webhooks as inactive
    for (const dbWebhook of dbWebhooks) {
      const existsInNylas = nylasWebhooks.some(
        (nw) => nw.id === dbWebhook.webhookId
      );

      if (!existsInNylas && dbWebhook.status === 'active') {
        dbWebhook.status = 'inactive';
        await dbWebhook.save();
        deactivated++;
      } else if (existsInNylas) {
        synced++;
      }
    }

    return { synced, created, deactivated };
  } catch (error: any) {
    console.error('[WEBHOOK] Error syncing webhooks:', error.message);
    return { synced: 0, created: 0, deactivated: 0 };
  }
};

// ==========================================
// Auto-Setup Functions
// ==========================================

/**
 * Setup webhook for a Nylas account (if not exists)
 */
export const setupWebhookForAccount = async (
  companyId: string,
  nylasAccountId: string
): Promise<{ success: boolean; webhook?: INylasWebhook; error?: string }> => {
  const webhookUrl = process.env.NYLAS_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      success: false,
      error: 'NYLAS_WEBHOOK_URL not configured',
    };
  }

  // Default trigger types for calendar + email
  const triggerTypes = [
    'calendar.created',
    'calendar.updated',
    'calendar.deleted',
    'message.created',
    'message.updated',
    'message.opened',
  ];

  return createNylasWebhook({
    companyId,
    nylasAccountId,
    triggerTypes,
    webhookUrl,
  });
};

/**
 * Setup webhooks for all active Nylas accounts in a company
 */
export const setupWebhooksForCompany = async (
  companyId: string
): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> => {
  try {
    const nylasAccounts = await NylasAccount.find({
      companyId: new Types.ObjectId(companyId),
      status: 'active',
    });

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const account of nylasAccounts) {
      const result = await setupWebhookForAccount(
        companyId,
        account._id.toString()
      );

      if (result.success) {
        success++;
      } else {
        failed++;
        errors.push(
          `${account.emailAddress}: ${result.error}`
        );
      }
    }

    return { success, failed, errors };
  } catch (error: any) {
    console.error('[WEBHOOK] Error setting up webhooks for company:', error.message);
    return {
      success: 0,
      failed: 0,
      errors: [error.message],
    };
  }
};
