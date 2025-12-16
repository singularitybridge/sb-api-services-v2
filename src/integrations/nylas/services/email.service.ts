/**
 * Nylas Email Service
 *
 * Handles email operations via V3 microservice proxy
 */

import axios from 'axios';
import { NylasEmail, NylasEmailRecipient } from '../types';
import { resolveGrantId } from '../utils/grant-resolver';

const V3_SERVICE_URL = process.env.NYLAS_V3_SERVICE_URL || 'https://sb-api-services-v3-53926697384.us-central1.run.app';

/**
 * Get emails via V3 microservice
 */
export async function getEmails(
  companyId: string,
  options: { limit?: number; unread?: boolean; userEmail?: string } = {},
): Promise<NylasEmail[]> {
  const { limit = 10, unread, userEmail } = options;
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS EMAIL] Getting emails via V3:', { limit, unread, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/email/messages`, {
      params: {
        grantId,
        limit,
        ...(unread !== undefined && { unread }),
      },
      timeout: 15000,
    });

    return response.data?.data || [];
  } catch (error: any) {
    console.error('[NYLAS EMAIL ERROR] getEmails:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to get emails');
  }
}

/**
 * Get single email by ID via V3 microservice
 */
export async function getEmailById(
  companyId: string,
  messageId: string,
  userEmail?: string,
): Promise<NylasEmail> {
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS EMAIL] Getting email by ID via V3:', { messageId, grantId: grantId.substring(0, 8) + '...' });

  try {
    const response = await axios.get(`${V3_SERVICE_URL}/api/v1/nylas/email/messages/${messageId}`, {
      params: { grantId },
      timeout: 10000,
    });

    return response.data?.data || response.data;
  } catch (error: any) {
    console.error('[NYLAS EMAIL ERROR] getEmailById:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to get email');
  }
}

/**
 * Send email via V3 microservice
 */
export async function sendEmail(
  companyId: string,
  params: {
    to: string | string[];
    subject: string;
    body: string;
    cc?: string | string[];
    bcc?: string | string[];
    userEmail?: string;
  },
): Promise<{ id: string; thread_id: string }> {
  const { to, subject, body, cc, bcc, userEmail } = params;
  const grantId = await resolveGrantId(companyId, userEmail);

  console.log('[NYLAS EMAIL] Sending email via V3:', { to, subject, grantId: grantId.substring(0, 8) + '...' });

  // Format recipients
  const toRecipients = Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }];
  const ccRecipients = cc ? (Array.isArray(cc) ? cc.map((email) => ({ email })) : [{ email: cc }]) : undefined;
  const bccRecipients = bcc ? (Array.isArray(bcc) ? bcc.map((email) => ({ email })) : [{ email: bcc }]) : undefined;

  try {
    const response = await axios.post(`${V3_SERVICE_URL}/api/v1/nylas/email/messages/send`, {
      grantId,
      to: toRecipients,
      subject,
      body,
      cc: ccRecipients,
      bcc: bccRecipients,
    }, {
      timeout: 30000,
    });

    return response.data?.data || response.data;
  } catch (error: any) {
    console.error('[NYLAS EMAIL ERROR] sendEmail:', error.response?.data || error.message);
    throw new Error(error.response?.data?.error || error.message || 'Failed to send email');
  }
}
