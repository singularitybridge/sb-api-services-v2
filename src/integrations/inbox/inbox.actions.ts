import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import {
  getInboxMessages as getInboxMessagesService,
  sendMessageToInbox as sendMessageToInboxService,
  updateInboxMessageStatus as updateInboxMessageStatusService,
} from './inbox.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';
import { IInbox } from '../../models/Inbox'; // Corrected import

const SERVICE_NAME = 'inboxService';

// Define shapes for service call lambdas (S type for executeAction)
// This is the structure the lambda passed to executeAction should return.
// executeAction's default dataExtractor will take S.data to be R.
interface ServiceLambdaResponse<R_Payload = any> {
  success: boolean;
  data?: R_Payload; // This should match the R type of StandardActionResult
  error?: string; // For service's original error message
  description?: string; // For executeAction to use if success is false
}

export const createInboxActions = (
  context: ActionContext,
): FunctionFactory => ({
  sendMessageToInbox: {
    description: 'Send a message to the inbox for human review or response',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to send to the inbox',
        },
        type: {
          type: 'string',
          enum: ['human_agent_request', 'human_agent_response', 'notification'],
          description: 'The type of the inbox message',
          default: 'human_agent_request',
        },
      },
      required: ['message'],
      additionalProperties: false,
    },
    function: async (params: {
      message: string;
      type?: 'human_agent_request' | 'human_agent_response' | 'notification';
    }): Promise<StandardActionResult<{ message: string }>> => {
      if (!context.sessionId || !context.companyId) {
        throw new ActionValidationError(
          'Session ID and Company ID are required.',
        );
      }
      if (!params.message) {
        throw new ActionValidationError('Message parameter is required.');
      }

      // R type for StandardActionResult is { message: string }
      // S type (lambda's return) should be ServiceLambdaResponse<{ message: string }>
      return executeAction<
        { message: string },
        ServiceLambdaResponse<{ message: string }>
      >(
        'sendMessageToInbox',
        async (): Promise<ServiceLambdaResponse<{ message: string }>> => {
          // inbox.service.sendMessageToInbox returns: { success: boolean; data?: string; error?: string }
          const serviceResult = await sendMessageToInboxService(
            context.sessionId!,
            context.companyId!,
            params,
          );
          return {
            success: serviceResult.success,
            // Ensure S.data matches R
            data: serviceResult.success
              ? { message: serviceResult.data as string }
              : undefined,
            description: serviceResult.error, // executeAction uses this if success is false
            error: serviceResult.error,
          };
        },
        { serviceName: SERVICE_NAME }, // Default dataExtractor (res => res.data) will work
      );
    },
  },

  getInboxMessages: {
    description: 'Retrieve inbox messages for the company',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<StandardActionResult<IInbox[]>> => {
      if (!context.companyId) {
        throw new ActionValidationError('Company ID is required.');
      }
      // R type is IInbox[]
      // S type is ServiceLambdaResponse<IInbox[]>
      // inbox.service.getInboxMessages returns: { success: boolean; data?: IInbox[]; error?: string }
      return executeAction<IInbox[], ServiceLambdaResponse<IInbox[]>>(
        'getInboxMessages',
        async (): Promise<ServiceLambdaResponse<IInbox[]>> => {
          const serviceResult = await getInboxMessagesService(
            context.companyId!,
          );
          return {
            success: serviceResult.success,
            data: serviceResult.data, // Already matches R
            description: serviceResult.error,
            error: serviceResult.error,
          };
        },
        { serviceName: SERVICE_NAME }, // Default dataExtractor
      );
    },
  },

  updateInboxMessageStatus: {
    description: 'Update the status of an inbox message',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        messageId: {
          type: 'string',
          description: 'The ID of the inbox message to update',
        },
        status: {
          type: 'string',
          enum: ['open', 'in_progress', 'closed'],
          description: 'The new status of the inbox message',
        },
      },
      required: ['messageId', 'status'],
      additionalProperties: false,
    },
    function: async (params: {
      messageId: string;
      status: 'open' | 'in_progress' | 'closed';
    }): Promise<StandardActionResult<IInbox>> => {
      if (!params.messageId || !params.status) {
        throw new ActionValidationError(
          'messageId and status parameters are required.',
        );
      }
      // R type is IInbox
      // S type is ServiceLambdaResponse<IInbox>
      // inbox.service.updateInboxMessageStatus returns: { success: boolean; data?: IInbox; error?: string }
      return executeAction<IInbox, ServiceLambdaResponse<IInbox>>(
        'updateInboxMessageStatus',
        async (): Promise<ServiceLambdaResponse<IInbox>> => {
          const serviceResult = await updateInboxMessageStatusService(
            params.messageId,
            params.status,
          );
          return {
            success: serviceResult.success,
            data: serviceResult.data, // Already matches R
            description: serviceResult.error,
            error: serviceResult.error,
          };
        },
        { serviceName: SERVICE_NAME }, // Default dataExtractor
      );
    },
  },
});
