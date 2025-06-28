import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types'; // Corrected path for FunctionFactory
import { sendEmail as sendEmailService } from './sendgrid.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

interface SendEmailArgs {
  to: string;
  subject: string;
  text: string;
  html: string;
}

// R type for StandardActionResult<R>
interface SendEmailResponseData {
  message?: string; // Service returns a message on success
}

// S type for serviceCall lambda's response
interface ServiceCallLambdaResponse {
  success: boolean;
  data?: SendEmailResponseData;
  error?: string;
  description?: string; // For executeAction if success is false
}

const SERVICE_NAME = 'sendGridService';

export const createSendGridActions = (
  context: ActionContext,
): FunctionFactory => ({
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
    function: async (
      args: SendEmailArgs,
    ): Promise<StandardActionResult<SendEmailResponseData>> => {
      const { to, subject, text, html } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        throw new ActionValidationError(
          'The provided email address is not valid.',
        );
      }
      if (typeof subject !== 'string' || subject.trim().length === 0) {
        throw new ActionValidationError(
          'The subject must be a non-empty string.',
        );
      }
      if (typeof text !== 'string' || text.trim().length === 0) {
        throw new ActionValidationError(
          'The text content must be a non-empty string.',
        );
      }
      if (typeof html !== 'string' || html.trim().length === 0) {
        throw new ActionValidationError(
          'The HTML content must be a non-empty string.',
        );
      }

      return executeAction<SendEmailResponseData, ServiceCallLambdaResponse>(
        'sendEmail',
        async (): Promise<ServiceCallLambdaResponse> => {
          // sendEmailService returns: { success: boolean; message?: string; error?: string }
          const serviceResult = await sendEmailService(context.companyId!, {
            to,
            subject,
            text,
            html,
          });
          return {
            success: serviceResult.success,
            data: serviceResult.success
              ? { message: serviceResult.message }
              : undefined,
            description: serviceResult.error,
            error: serviceResult.error,
          };
        },
        {
          serviceName: SERVICE_NAME,
          // Default dataExtractor (res => res.data) will work
        },
      );
    },
  },
});
