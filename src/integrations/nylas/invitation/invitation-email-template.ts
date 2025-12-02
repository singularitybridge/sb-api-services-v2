import { IInvite } from '../../../models/Invite';

export interface InviteEmailParams {
  invitee: {
    email: string;
    name?: string;
  };
  inviter: {
    name: string;
    email: string;
  };
  company: {
    name: string;
  };
  oauthUrl: string;
  inviteToken: string;
  expiresAt: Date;
  personalMessage?: string;
}

/**
 * Generate HTML email content for team invitation
 * Includes both platform invite and OAuth connection link
 */
export function generateInviteEmailContent(params: InviteEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const {
    invitee,
    inviter,
    company,
    oauthUrl,
    expiresAt,
    personalMessage,
  } = params;

  const inviteeName = invitee.name || invitee.email.split('@')[0];
  const expirationDate = expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `${inviter.name} invited you to join ${company.name}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px 40px; text-align: center;">
              <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: 600;">
                You're Invited!
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <p style="margin: 0; color: #333333; font-size: 16px; line-height: 1.5;">
                Hi ${inviteeName},
              </p>
            </td>
          </tr>

          <!-- Personal Message (if provided) -->
          ${personalMessage ? `
          <tr>
            <td style="padding: 0 40px 20px 40px;">
              <div style="background-color: #f8f9fa; border-left: 4px solid #4F46E5; padding: 16px; border-radius: 4px;">
                <p style="margin: 0; color: #555555; font-size: 15px; line-height: 1.6; font-style: italic;">
                  "${personalMessage}"
                </p>
                <p style="margin: 8px 0 0 0; color: #777777; font-size: 14px;">
                  — ${inviter.name}
                </p>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Main Message -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">
                <strong>${inviter.name}</strong> has invited you to join <strong>${company.name}</strong> on our platform.
              </p>
              <p style="margin: 0; color: #555555; font-size: 15px; line-height: 1.6;">
                To get started, you'll need to connect your Google account. This allows you to manage contacts, calendars, and emails seamlessly through our platform.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 30px 40px;" align="center">
              <table role="presentation" style="border-collapse: collapse;">
                <tr>
                  <td style="border-radius: 6px; background-color: #4F46E5;">
                    <a href="${oauthUrl}"
                       style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px;">
                      Connect Your Google Account
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alternative Link -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <p style="margin: 0; color: #777777; font-size: 13px; text-align: center; line-height: 1.5;">
                Or copy and paste this link into your browser:<br>
                <a href="${oauthUrl}" style="color: #4F46E5; word-break: break-all;">
                  ${oauthUrl}
                </a>
              </p>
            </td>
          </tr>

          <!-- What Happens Next -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px;">
                <h3 style="margin: 0 0 12px 0; color: #1a1a1a; font-size: 16px; font-weight: 600;">
                  What happens next?
                </h3>
                <ol style="margin: 0; padding-left: 20px; color: #555555; font-size: 14px; line-height: 1.8;">
                  <li>Click the button above to start the authorization process</li>
                  <li>Sign in with your Google account</li>
                  <li>Grant access to your contacts, calendar, and email</li>
                  <li>You'll be redirected to the platform to complete setup</li>
                </ol>
              </div>
            </td>
          </tr>

          <!-- Expiration Notice -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="border-top: 1px solid #e5e5e5; padding-top: 20px;">
                <p style="margin: 0; color: #999999; font-size: 13px; text-align: center;">
                  ⏰ This invitation expires on ${expirationDate}
                </p>
              </div>
            </td>
          </tr>

          <!-- Security Notice -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <p style="margin: 0; color: #999999; font-size: 12px; text-align: center; line-height: 1.5;">
                🔒 Your data is secure. We use OAuth 2.0 to safely connect your Google account.<br>
                You can revoke access at any time from your Google Account settings.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; color: #777777; font-size: 13px; text-align: center;">
                Questions? Contact us at <a href="mailto:support@example.com" style="color: #4F46E5; text-decoration: none;">support@example.com</a>
              </p>
              <p style="margin: 0; color: #999999; font-size: 12px; text-align: center;">
                ${company.name} • Team Collaboration Platform
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `
You're Invited to Join ${company.name}!

Hi ${inviteeName},

${personalMessage ? `"${personalMessage}"\n— ${inviter.name}\n\n` : ''}

${inviter.name} has invited you to join ${company.name} on our platform.

To get started, you'll need to connect your Google account. This allows you to manage contacts, calendars, and emails seamlessly through our platform.

Connect Your Google Account:
${oauthUrl}

What happens next?
1. Click the link above to start the authorization process
2. Sign in with your Google account
3. Grant access to your contacts, calendar, and email
4. You'll be redirected to the platform to complete setup

⏰ This invitation expires on ${expirationDate}

🔒 Your data is secure. We use OAuth 2.0 to safely connect your Google account.
You can revoke access at any time from your Google Account settings.

---
Questions? Contact us at support@example.com
${company.name} • Team Collaboration Platform
  `.trim();

  return {
    subject,
    html,
    text,
  };
}
