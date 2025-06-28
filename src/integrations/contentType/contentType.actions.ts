import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { ContentTypeIntegrationService } from './content-type.service';
import { IContentType } from '../../models/ContentType';
import { Types } from 'mongoose';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import {
  ActionValidationError,
  ActionServiceError,
} from '../../utils/actionErrors';

const SERVICE_NAME = 'contentTypeService';

// Define R types for StandardActionResult<R>
interface MessageData {
  message: string;
}

// Define S type (service call lambda's response) for executeAction
interface ServiceLambdaResponse<R_Payload = any> {
  success: boolean;
  data?: R_Payload;
  error?: string; // For service's original error message, if any
  description?: string; // For executeAction to use if success is false
}

export const createContentTypeActions = (
  context: ActionContext,
): FunctionFactory => ({
  createContentType: {
    description: 'Create a new content type',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name of the content type' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The name of the field' },
              type: { type: 'string', description: 'The type of the field' },
              required: {
                type: 'boolean',
                description: 'Whether the field is required',
              },
            },
            required: ['name', 'type'],
          },
          description: 'The fields of the content type',
        },
      },
      required: ['name', 'fields'],
      additionalProperties: false,
    },
    function: async (args: {
      name: string;
      fields: Array<{ name: string; type: string; required?: boolean }>;
    }): Promise<StandardActionResult<IContentType>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      if (!args.name || !args.fields)
        throw new ActionValidationError('Name and fields are required.');

      return executeAction<IContentType, ServiceLambdaResponse<IContentType>>(
        'createContentType',
        async () => {
          const contentTypeData: Partial<IContentType> = {
            ...args,
            companyId: new Types.ObjectId(context.companyId!),
          };
          const contentType =
            await ContentTypeIntegrationService.createContentType(
              contentTypeData,
            );
          return { success: true, data: contentType };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  getContentTypes: {
    description: 'Get all content types for the company',
    strict: true,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
    function: async (): Promise<StandardActionResult<IContentType[]>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      return executeAction<
        IContentType[],
        ServiceLambdaResponse<IContentType[]>
      >(
        'getContentTypes',
        async () => {
          const contentTypes =
            await ContentTypeIntegrationService.getAllContentTypes(
              context.companyId!,
            );
          return { success: true, data: contentTypes };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  updateContentType: {
    description: 'Update an existing content type',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: {
          type: 'string',
          description: 'The ID of the content type to update',
        },
        name: {
          type: 'string',
          description: 'The new name of the content type (optional)',
        },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The name of the field' },
              type: { type: 'string', description: 'The type of the field' },
              required: {
                type: 'boolean',
                description: 'Whether the field is required',
              },
            },
            required: ['name', 'type'],
          },
          description: 'The updated fields of the content type (optional)',
        },
      },
      required: ['contentTypeId'],
      additionalProperties: false,
    },
    function: async (args: {
      contentTypeId: string;
      name?: string;
      fields?: Array<{ name: string; type: string; required?: boolean }>;
    }): Promise<StandardActionResult<IContentType>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      if (!args.contentTypeId)
        throw new ActionValidationError('contentTypeId is required.');

      return executeAction<IContentType, ServiceLambdaResponse<IContentType>>(
        'updateContentType',
        async () => {
          const { contentTypeId, ...updateData } = args;
          const contentType =
            await ContentTypeIntegrationService.updateContentType(
              contentTypeId,
              context.companyId!,
              updateData,
            );
          if (!contentType) {
            throw new ActionServiceError(
              'Content type not found or update failed.',
              { serviceName: SERVICE_NAME },
            );
          }
          return { success: true, data: contentType };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },

  deleteContentType: {
    description: 'Delete a content type',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: {
          type: 'string',
          description: 'The ID of the content type to delete',
        },
      },
      required: ['contentTypeId'],
      additionalProperties: false,
    },
    function: async (args: {
      contentTypeId: string;
    }): Promise<StandardActionResult<MessageData>> => {
      if (!context.companyId)
        throw new ActionValidationError('Company ID is missing.');
      if (!args.contentTypeId)
        throw new ActionValidationError('contentTypeId is required.');

      return executeAction<MessageData, ServiceLambdaResponse<MessageData>>(
        'deleteContentType',
        async () => {
          const result = await ContentTypeIntegrationService.deleteContentType(
            args.contentTypeId,
            context.companyId!,
          );
          if (!result) {
            throw new ActionServiceError(
              'Content type not found or delete failed.',
              { serviceName: SERVICE_NAME },
            );
          }
          return {
            success: true,
            data: { message: 'Content type deleted successfully.' },
          };
        },
        { serviceName: SERVICE_NAME },
      );
    },
  },
});
