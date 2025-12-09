/**
 * Invitation Email Service
 *
 * Sends invitation emails to team members via the Nylas V3 microservice.
 * Generates OAuth URLs for Nylas Hosted Authentication so users can
 * connect their email/calendar accounts.
 */

import axios from 'axios';
import { sendEmail } from '../integrations/nylas/nylas.service';

const V3_SERVICE_URL = process.env.NYLAS_V3_SERVICE_URL || 'https://sb-api-services-v3-53926697384.us-central1.run.app';
const V2_BASE_URL = process.env.V2_BASE_URL || 'https://api.agentportal.ai';

export interface InviteData {
  _id: string;
  email: string;
  companyId: string;
  invitedBy: string;
  inviteToken: string;
  expiresAt: Date;
}

export interface SendInvitationParams {
  invite: InviteData;
  inviterName: string;
  companyName: string;
  companyId: string;
}

export class InvitationEmailService {
  /**
   * Generate Nylas OAuth URL via V3 microservice
   */
  static async generateNylasAuthUrl(invite: InviteData): Promise<string> {
    try {
      // Construct state object with invite info
      const stateData = {
        inviteToken: invite.inviteToken,
        companyId: invite.companyId,
        email: invite.email,
      };

      // Base64url encode the state
      const state = Buffer.from(JSON.stringify(stateData))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Call V3 to generate the auth URL
      const response = await axios.post(`${V3_SERVICE_URL}/api/v1/nylas/auth/initiate`, {
        redirectUri: `${V3_SERVICE_URL}/api/v1/nylas/auth/callback`,
        state,
        loginHint: invite.email,
        scopes: ['mail.read', 'mail.send', 'calendar', 'contacts'],
      }, {
        timeout: 10000,
      });

      if (response.data?.authUrl) {
        console.log(`[invitation-email] Generated auth URL for ${invite.email}`);
        return response.data.authUrl;
      }

      throw new Error('No auth URL returned from V3');
    } catch (error: any) {
      console.error('[invitation-email] Failed to generate auth URL:', error.message);
      // Fall back to a frontend-based URL if V3 fails
      return this.generateFrontendAuthUrl(invite);
    }
  }

  /**
   * Generate a frontend-based auth URL as fallback
   */
  static generateFrontendAuthUrl(invite: InviteData): string {
    const baseUrl = process.env.FRONTEND_URL || 'https://portal.agentportal.ai';
    return `${baseUrl}/connect-email?token=${invite.inviteToken}`;
  }

  /**
   * Generate HTML email content
   */
  static generateEmailHtml(
    inviterName: string,
    companyName: string,
    authUrl: string,
    expiresAt: Date,
  ): string {
    const expiryDate = expiresAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect Your Email Account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Connect Your Email Account</h1>
  </div>

  <div style="background: #f9f9f9; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px;">Hi there,</p>

    <p style="font-size: 16px;"><strong>${inviterName}</strong> has invited you to connect your email account to <strong>${companyName}</strong>'s AI assistant.</p>

    <p style="font-size: 16px;">By connecting your account, the AI assistant will be able to:</p>

    <ul style="font-size: 16px; padding-left: 20px;">
      <li>Read and manage your emails</li>
      <li>Access your calendar and schedule meetings</li>
      <li>View and manage your contacts</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${authUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; display: inline-block;">
        Connect Your Account
      </a>
    </div>

    <p style="font-size: 14px; color: #666;">This invitation expires on <strong>${expiryDate}</strong>.</p>

    <p style="font-size: 14px; color: #666;">If you didn't expect this invitation, you can safely ignore this email.</p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">

    <p style="font-size: 12px; color: #999; text-align: center;">
      Sent by ${companyName} via Agent Portal<br>
      <a href="${authUrl}" style="color: #667eea;">Click here</a> if the button above doesn't work
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text email content
   */
  static generateEmailText(
    inviterName: string,
    companyName: string,
    authUrl: string,
    expiresAt: Date,
  ): string {
    const expiryDate = expiresAt.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `
Connect Your Email Account

Hi there,

${inviterName} has invited you to connect your email account to ${companyName}'s AI assistant.

By connecting your account, the AI assistant will be able to:
- Read and manage your emails
- Access your calendar and schedule meetings
- View and manage your contacts

Click the link below to connect your account:
${authUrl}

This invitation expires on ${expiryDate}.

If you didn't expect this invitation, you can safely ignore this email.

---
Sent by ${companyName} via Agent Portal
    `.trim();
  }

  /**
   * Send an invitation email via Nylas
   */
  static async sendInvitationEmail(params: SendInvitationParams): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const { invite, inviterName, companyName, companyId } = params;

    try {
      // Generate the auth URL
      const authUrl = await this.generateNylasAuthUrl(invite);

      // Generate email content
      const htmlBody = this.generateEmailHtml(
        inviterName,
        companyName,
        authUrl,
        invite.expiresAt,
      );

      // Send the email via Nylas (uses V3 microservice)
      const result = await sendEmail(companyId, {
        to: invite.email,
        subject: `${inviterName} invited you to connect your email to ${companyName}`,
        body: htmlBody,
      });

      console.log(`[invitation-email] Sent invitation to ${invite.email}, messageId: ${result.id}`);

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error: any) {
      console.error(`[invitation-email] Failed to send invitation to ${invite.email}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Resend an invitation email
   */
  static async resendInvitationEmail(params: SendInvitationParams): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    const { invite, inviterName, companyName, companyId } = params;

    try {
      // Generate fresh auth URL
      const authUrl = await this.generateNylasAuthUrl(invite);

      // Generate email content with "reminder" messaging
      const htmlBody = this.generateEmailHtml(
        inviterName,
        companyName,
        authUrl,
        invite.expiresAt,
      ).replace(
        'has invited you to connect',
        'sent you a reminder to connect',
      );

      // Send the email via Nylas
      const result = await sendEmail(companyId, {
        to: invite.email,
        subject: `Reminder: Connect your email to ${companyName}`,
        body: htmlBody,
      });

      console.log(`[invitation-email] Resent invitation to ${invite.email}, messageId: ${result.id}`);

      return {
        success: true,
        messageId: result.id,
      };
    } catch (error: any) {
      console.error(`[invitation-email] Failed to resend invitation to ${invite.email}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
