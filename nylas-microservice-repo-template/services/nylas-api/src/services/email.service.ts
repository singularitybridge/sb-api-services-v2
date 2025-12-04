/**
 * Email Service for Nylas Microservice
 *
 * Thin wrapper around Nylas Messages API (v3)
 * All business logic and database operations handled by main app
 */

import axios from 'axios';
import { config } from '../config.js';

const NYLAS_API_URL = config.nylas.apiUrl;

// ==========================================
// Type Definitions
// ==========================================

export interface EmailParticipant {
  name?: string;
  email: string;
}

export interface EmailAttachment {
  id?: string;
  filename?: string;
  content_type?: string;
  size?: number;
  content_id?: string;
}

export interface EmailMessage {
  id: string;
  grant_id?: string;
  thread_id?: string;
  subject?: string;
  from?: EmailParticipant[];
  to?: EmailParticipant[];
  cc?: EmailParticipant[];
  bcc?: EmailParticipant[];
  reply_to?: EmailParticipant[];
  date?: number;
  unread?: boolean;
  starred?: boolean;
  snippet?: string;
  body?: string;
  attachments?: EmailAttachment[];
  folders?: string[];
  labels?: string[];
  created_at?: number;
}

export interface SendEmailRequest {
  grantId: string;
  to: EmailParticipant[];
  subject: string;
  body: string;
  cc?: EmailParticipant[];
  bcc?: EmailParticipant[];
  reply_to?: EmailParticipant[];
  attachments?: Array<{
    filename: string;
    content_type: string;
    content: string; // base64 encoded
  }>;
}

export interface SearchEmailsRequest {
  grantId: string;
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  unread?: boolean;
  starred?: boolean;
  limit?: number;
  offset?: number;
}

// ==========================================
// Send Email
// ==========================================

/**
 * Send an email
 */
export async function sendEmail(params: SendEmailRequest): Promise<EmailMessage> {
  const { grantId, to, subject, body, cc, bcc, reply_to, attachments } = params;

  const emailData: any = {
    to,
    subject,
    body,
  };

  if (cc && cc.length > 0) emailData.cc = cc;
  if (bcc && bcc.length > 0) emailData.bcc = bcc;
  if (reply_to && reply_to.length > 0) emailData.reply_to = reply_to;
  if (attachments && attachments.length > 0) emailData.attachments = attachments;

  try {
    const response = await axios.post(
      `${NYLAS_API_URL}/v3/grants/${grantId}/messages/send`,
      emailData,
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      `Failed to send email: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// Search/List Emails
// ==========================================

/**
 * Search or list emails
 */
export async function searchEmails(params: SearchEmailsRequest): Promise<EmailMessage[]> {
  const { grantId, query, from, to, subject, unread, starred, limit = 50, offset = 0 } = params;

  try {
    const queryParams = new URLSearchParams();
    if (query) queryParams.set('search_query_native', query);
    if (from) queryParams.set('from', from);
    if (to) queryParams.set('to', to);
    if (subject) queryParams.set('subject', subject);
    if (unread !== undefined) queryParams.set('unread', unread.toString());
    if (starred !== undefined) queryParams.set('starred', starred.toString());
    if (limit) queryParams.set('limit', limit.toString());
    if (offset) queryParams.set('offset', offset.toString());

    const url = `${NYLAS_API_URL}/v3/grants/${grantId}/messages?${queryParams.toString()}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${config.nylas.clientSecret}`,
      },
    });

    return response.data.data || [];
  } catch (error: any) {
    throw new Error(
      `Failed to search emails: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// Get Email
// ==========================================

/**
 * Get a specific email by ID
 */
export async function getEmail(grantId: string, messageId: string): Promise<EmailMessage> {
  try {
    const response = await axios.get(
      `${NYLAS_API_URL}/v3/grants/${grantId}/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
        },
      }
    );

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      `Failed to get email: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// Update Email (Mark as Read/Unread, Star, etc.)
// ==========================================

/**
 * Update email properties (read status, starred, folders, labels)
 */
export async function updateEmail(
  grantId: string,
  messageId: string,
  updates: {
    unread?: boolean;
    starred?: boolean;
    folders?: string[];
    labels?: string[];
  }
): Promise<EmailMessage> {
  try {
    const response = await axios.put(
      `${NYLAS_API_URL}/v3/grants/${grantId}/messages/${messageId}`,
      updates,
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data;
  } catch (error: any) {
    throw new Error(
      `Failed to update email: ${error.response?.data?.message || error.message}`
    );
  }
}

// ==========================================
// Delete Email (Trash)
// ==========================================

/**
 * Move email to trash
 */
export async function trashEmail(grantId: string, messageId: string): Promise<void> {
  try {
    await axios.delete(
      `${NYLAS_API_URL}/v3/grants/${grantId}/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.nylas.clientSecret}`,
        },
      }
    );
  } catch (error: any) {
    throw new Error(
      `Failed to trash email: ${error.response?.data?.message || error.message}`
    );
  }
}
