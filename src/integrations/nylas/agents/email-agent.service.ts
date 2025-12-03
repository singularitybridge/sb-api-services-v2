/**
 * Email Agent - Nylas Email/Messages API Operations
 *
 * Handles ALL Nylas Email API operations with "on behalf of" sending.
 * Part of the three-agent architecture (Contacts, Calendar, Email).
 *
 * Responsibilities:
 * - Meeting invitation emails
 * - Update and cancellation notifications
 * - HTML email template generation
 * - Bulk sending for large groups (15+ participants)
 */

import { findUserGrantOrThrow } from '../services/company-calendar.service';
import { sendEmailForGrant } from '../nylas-multi-user.service';
import type { MeetingPayload } from './calendar-agent.service';
import { calculateDuration, formatDateTime } from './calendar-agent.service';

// ==========================================
// Email Sending Operations
// ==========================================

/**
 * Send meeting invitation email using organizer's grant
 *
 * @param payload - Meeting payload with all details
 * @returns Updated payload with email details
 */
export const sendMeetingInviteForUser = async (
  payload: MeetingPayload
): Promise<MeetingPayload> => {
  const organizerAccount = await findUserGrantOrThrow(
    payload.company_id,
    payload.organizer.email
  );

  console.log(
    `[Email Agent] Sending meeting invite from ${payload.organizer.email} to ${payload.participants.length} participants`
  );

  const emailBody = generateInviteEmail(payload);

  const message = await sendEmailForGrant(organizerAccount.nylasGrantId, {
    to: payload.participants.map((p) => ({
      name: p.name,
      email: p.email,
    })),
    subject: payload.subject,
    body: emailBody,
  });

  console.log(
    `[Email Agent] Invite sent: Message ID ${message.id}, Thread ID ${message.thread_id}`
  );

  return {
    ...payload,
    email: {
      message_id: message.id,
      thread_id: message.thread_id,
      sent_at: new Date().toISOString(),
    },
    meta: {
      ...payload.meta,
      status: 'sent',
    },
  };
};

/**
 * Send meeting update email
 *
 * @param payload - Meeting payload
 * @param changes - Description of what changed
 * @returns Updated payload
 */
export const sendMeetingUpdateForUser = async (
  payload: MeetingPayload,
  changes: {
    old_time?: { start: string; end: string };
    old_location?: { type: string; join_url?: string };
  }
): Promise<MeetingPayload> => {
  const organizerAccount = await findUserGrantOrThrow(
    payload.company_id,
    payload.organizer.email
  );

  console.log(
    `[Email Agent] Sending meeting update from ${payload.organizer.email}`
  );

  const emailBody = generateUpdateEmail(payload, changes);

  const message = await sendEmailForGrant(organizerAccount.nylasGrantId, {
    to: payload.participants.map((p) => ({
      name: p.name,
      email: p.email,
    })),
    subject: `Updated: ${payload.subject}`,
    body: emailBody,
  });

  return {
    ...payload,
    email: {
      message_id: message.id,
      thread_id: message.thread_id,
      sent_at: new Date().toISOString(),
    },
  };
};

/**
 * Send meeting cancellation email
 *
 * @param payload - Meeting payload
 * @param reason - Optional cancellation reason
 * @returns Updated payload
 */
export const sendMeetingCancellationForUser = async (
  payload: MeetingPayload,
  reason?: string
): Promise<MeetingPayload> => {
  const organizerAccount = await findUserGrantOrThrow(
    payload.company_id,
    payload.organizer.email
  );

  console.log(
    `[Email Agent] Sending meeting cancellation from ${payload.organizer.email}`
  );

  const emailBody = generateCancellationEmail(payload, reason);

  const message = await sendEmailForGrant(organizerAccount.nylasGrantId, {
    to: payload.participants.map((p) => ({
      name: p.name,
      email: p.email,
    })),
    subject: `Cancelled: ${payload.subject}`,
    body: emailBody,
  });

  return {
    ...payload,
    email: {
      message_id: message.id,
      thread_id: message.thread_id,
      sent_at: new Date().toISOString(),
    },
    meta: {
      ...payload.meta,
      status: 'cancelled',
    },
  };
};

/**
 * Send bulk invites for large groups (15+ participants)
 *
 * @param companyId - MongoDB company ID
 * @param organizerEmail - Organizer's email
 * @param participants - Array of participants
 * @param subject - Email subject
 * @param body - Email body (HTML)
 * @returns Send statistics
 */
export const sendBulkInvites = async (
  companyId: string,
  organizerEmail: string,
  participants: Array<{ name: string; email: string }>,
  subject: string,
  body: string
): Promise<{ sent: number; failed: number; errors: string[] }> => {
  const organizerAccount = await findUserGrantOrThrow(
    companyId,
    organizerEmail
  );

  console.log(
    `[Email Agent] Sending bulk invites to ${participants.length} participants`
  );

  const results = await Promise.allSettled(
    participants.map((participant) =>
      sendEmailForGrant(organizerAccount.nylasGrantId, {
        to: [participant],
        subject,
        body,
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason?.message || 'Unknown error');

  console.log(
    `[Email Agent] Bulk send complete: ${sent} sent, ${failed} failed`
  );

  return { sent, failed, errors };
};

// ==========================================
// Email Template Generation (Pure Functions)
// ==========================================

/**
 * Generate HTML invitation email (Pure Function)
 *
 * @param payload - Meeting payload
 * @returns HTML email body
 */
export const generateInviteEmail = (payload: MeetingPayload): string => {
  const { subject, participants, time, location, organizer } = payload;

  const participantList = participants
    .map((p) => `<li>${p.name} (${p.email})</li>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4A90E2; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .details { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #4A90E2; }
        .button { display: inline-block; padding: 12px 24px; background: #4A90E2; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
        .participants { list-style: none; padding: 0; }
        .participants li { padding: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${subject}</h1>
        </div>
        <div class="content">
          <p>Hi everyone,</p>
          <p>${organizer.name} has invited you to a meeting.</p>

          <div class="details">
            <h3>Meeting Details</h3>
            <p><strong>When:</strong> ${formatDateTime(time.start, time.timezone)}</p>
            <p><strong>Duration:</strong> ${time.duration_minutes || calculateDuration(time.start, time.end)} minutes</p>
            ${
              location.type === 'video'
                ? `
              <p><strong>Join via:</strong> <a href="${location.join_url}">Video Conference</a></p>
              <a href="${location.join_url}" class="button">Join Meeting</a>
            `
                : location.type === 'physical'
                  ? `
              <p><strong>Location:</strong> ${location.physical_address}</p>
            `
                  : `
              <p><strong>Dial-in:</strong> ${location.dial_in}</p>
            `
            }
            ${payload.description ? `<p><strong>Agenda:</strong><br>${payload.description}</p>` : ''}
          </div>

          <div class="details">
            <h3>Participants</h3>
            <ul class="participants">
              ${participantList}
            </ul>
          </div>

          ${
            payload.calendar?.calendar_html_link
              ? `
            <p><a href="${payload.calendar.calendar_html_link}">View in Calendar</a></p>
          `
              : ''
          }

          <p>Looking forward to meeting with you!</p>
          <p>Best regards,<br>${organizer.name}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML update email (Pure Function)
 *
 * @param payload - Meeting payload
 * @param changes - What changed
 * @returns HTML email body
 */
export const generateUpdateEmail = (
  payload: MeetingPayload,
  changes: {
    old_time?: { start: string; end: string };
    old_location?: { type: string; join_url?: string };
  }
): string => {
  const { subject, time, location, organizer } = payload;

  const changesList = [];
  if (changes.old_time) {
    changesList.push(
      `<li><strong>Time changed:</strong> From ${formatDateTime(changes.old_time.start, time.timezone)} to ${formatDateTime(time.start, time.timezone)}</li>`
    );
  }
  if (changes.old_location) {
    changesList.push(
      `<li><strong>Location changed:</strong> From ${changes.old_location.type} to ${location.type}</li>`
    );
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FF9800; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .details { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #FF9800; }
        .changes { background: #FFF3E0; padding: 15px; margin: 10px 0; border-left: 4px solid #FF9800; }
        .button { display: inline-block; padding: 12px 24px; background: #FF9800; color: white; text-decoration: none; border-radius: 4px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Meeting Updated</h1>
        </div>
        <div class="content">
          <p>Hi everyone,</p>
          <p>${organizer.name} has updated the meeting: <strong>${subject}</strong></p>

          <div class="changes">
            <h3>What Changed</h3>
            <ul>
              ${changesList.join('')}
            </ul>
          </div>

          <div class="details">
            <h3>New Meeting Details</h3>
            <p><strong>When:</strong> ${formatDateTime(time.start, time.timezone)}</p>
            <p><strong>Duration:</strong> ${time.duration_minutes || calculateDuration(time.start, time.end)} minutes</p>
            ${
              location.type === 'video'
                ? `
              <p><strong>Join via:</strong> <a href="${location.join_url}">Video Conference</a></p>
              <a href="${location.join_url}" class="button">Join Meeting</a>
            `
                : location.type === 'physical'
                  ? `
              <p><strong>Location:</strong> ${location.physical_address}</p>
            `
                  : `
              <p><strong>Dial-in:</strong> ${location.dial_in}</p>
            `
            }
          </div>

          ${
            payload.calendar?.calendar_html_link
              ? `
            <p><a href="${payload.calendar.calendar_html_link}">View Updated Event</a></p>
          `
              : ''
          }

          <p>Best regards,<br>${organizer.name}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate HTML cancellation email (Pure Function)
 *
 * @param payload - Meeting payload
 * @param reason - Optional reason
 * @returns HTML email body
 */
export const generateCancellationEmail = (
  payload: MeetingPayload,
  reason?: string
): string => {
  const { subject, time, organizer } = payload;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #F44336; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .details { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #F44336; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Meeting Cancelled</h1>
        </div>
        <div class="content">
          <p>Hi everyone,</p>
          <p>${organizer.name} has cancelled the meeting: <strong>${subject}</strong></p>

          <div class="details">
            <h3>Cancelled Meeting Details</h3>
            <p><strong>Was scheduled for:</strong> ${formatDateTime(time.start, time.timezone)}</p>
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          </div>

          <p>This event has been removed from your calendar.</p>
          <p>Best regards,<br>${organizer.name}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
