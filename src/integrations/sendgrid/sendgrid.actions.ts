import { ActionContext, FunctionFactory } from '../../integrations/actions/types';
import { sendEmail } from './sendgrid.service';

interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const createSendGridActions = (context: ActionContext): FunctionFactory => ({
  sendEmail: {
    description: 'Send an email using SendGrid',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'The recipient email address',
        },
        subject: {
          type: 'string',
          description: 'The subject of the email',
        },
        text: {
          type: 'string',
          description: 'The plain text content of the email',
        },
        html: {
          type: 'string',
          description: 'The HTML content of the email',
        },
      },
      required: ['to', 'subject', 'text', 'html'],
      additionalProperties: false,
    },
    function: async (args: SendEmailArgs) => {
      console.log('sendEmail called with arguments:', JSON.stringify(args, null, 2));

      const { to, subject, text, html } = args;

      // Verify that 'to' is a valid email address
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        console.error('sendEmail: Invalid email address', to);
        return {
          error: 'Invalid email address',
          message: 'The provided email address is not valid.',
        };
      }

      // Verify that subject, text, and html are non-empty strings
      if (typeof subject !== 'string' || subject.trim().length === 0) {
        console.error('sendEmail: Invalid subject', subject);
        return {
          error: 'Invalid subject',
          message: 'The subject must be a non-empty string.',
        };
      }

      if (typeof text !== 'string' || text.trim().length === 0) {
        console.error('sendEmail: Invalid text content', text);
        return {
          error: 'Invalid text content',
          message: 'The text content must be a non-empty string.',
        };
      }

      if (typeof html !== 'string' || html.trim().length === 0) {
        console.error('sendEmail: Invalid html content', html);
        return {
          error: 'Invalid HTML content',
          message: 'The HTML content must be a non-empty string.',
        };
      }

      try {
        console.log('sendEmail: Calling sendEmail service');
        const result = await sendEmail(context.companyId, { to, subject, text, html });
        return result;
      } catch (error) {
        console.error('sendEmail: Error sending email', error);
        return {
          error: 'Email sending failed',
          message: 'Failed to send the email using SendGrid API.',
        };
      }
    },
  },
});