import { ActionContext, FunctionFactory } from './types';
import { sendEmail } from '../services/sendgrid.service';

export const createSendGridActions = (context: ActionContext): FunctionFactory => ({
  sendEmail: {
    description: 'Send an email using SendGrid',
    strict: false,
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
    function: async (args) => {
      console.log('sendEmail called with arguments:', JSON.stringify(args, null, 2));

      const { to, subject, text, html } = args;

      // Check if all required properties are present
      if (to === undefined || subject === undefined || text === undefined || html === undefined) {
        console.error('sendEmail: Missing required parameters');
        return {
          error: 'Missing parameters',
          message: 'to, subject, text, and html parameters are required.',
        };
      }

      // Check for additional properties
      const allowedProps = ['to', 'subject', 'text', 'html'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        console.error('sendEmail: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

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

      console.log('sendEmail: Calling sendEmail service with valid data');
      return await sendEmail(context.companyId, { to, subject, text, html });
    },
  },
});