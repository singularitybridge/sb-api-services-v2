import { ActionContext, FunctionFactory } from '../actions/types';
import { ContentTypeIntegrationService } from './content-type.service';
import { IContentType } from '../../models/ContentType';
import { Types } from 'mongoose';

export const createContentTypeActions = (context: ActionContext): FunctionFactory => ({
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
              required: { type: 'boolean', description: 'Whether the field is required' },
            },
            required: ['name', 'type'],
          },
          description: 'The fields of the content type' 
        },
      },
      required: ['name', 'fields'],
      additionalProperties: false,
    },
    function: async (args: { name: string; fields: Array<{ name: string; type: string; required?: boolean }> }) => {
      try {
        const contentTypeData: Partial<IContentType> = {
          ...args,
          companyId: new Types.ObjectId(context.companyId)
        };
        const contentType = await ContentTypeIntegrationService.createContentType(contentTypeData);
        return { 
          success: true, 
          description: 'Content type created successfully',
          data: contentType 
        };
      } catch (error) {
        console.error('Error creating content type:', error);
        return { success: false, description: 'Failed to create content type' };
      }
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
    function: async () => {
      try {
        const contentTypes = await ContentTypeIntegrationService.getAllContentTypes(context.companyId);
        return { 
          success: true, 
          description: 'Content types retrieved successfully',
          data: contentTypes 
        };
      } catch (error) {
        console.error('Error getting content types:', error);
        return { success: false, description: 'Failed to retrieve content types' };
      }
    },
  },

  updateContentType: {
    description: 'Update an existing content type',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: { type: 'string', description: 'The ID of the content type to update' },
        name: { type: 'string', description: 'The new name of the content type (optional)' },
        fields: { 
          type: 'array', 
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The name of the field' },
              type: { type: 'string', description: 'The type of the field' },
              required: { type: 'boolean', description: 'Whether the field is required' },
            },
            required: ['name', 'type'],
          },
          description: 'The updated fields of the content type (optional)' 
        },
      },
      required: ['contentTypeId'],
      additionalProperties: false,
    },
    function: async (args: { contentTypeId: string; name?: string; fields?: Array<{ name: string; type: string; required?: boolean }> }) => {
      try {
        const { contentTypeId, ...updateData } = args;
        const contentType = await ContentTypeIntegrationService.updateContentType(contentTypeId, context.companyId, updateData);
        if (!contentType) {
          return { success: false, description: 'Content type not found' };
        }
        return { 
          success: true, 
          description: 'Content type updated successfully',
          data: contentType 
        };
      } catch (error) {
        console.error('Error updating content type:', error);
        return { success: false, description: 'Failed to update content type' };
      }
    },
  },

  deleteContentType: {
    description: 'Delete a content type',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: { type: 'string', description: 'The ID of the content type to delete' },
      },
      required: ['contentTypeId'],
      additionalProperties: false,
    },
    function: async (args: { contentTypeId: string }) => {
      try {
        const result = await ContentTypeIntegrationService.deleteContentType(args.contentTypeId, context.companyId);
        if (!result) {
          return { success: false, description: 'Content type not found or could not be deleted' };
        }
        return { 
          success: true, 
          description: 'Content type deleted successfully' 
        };
      } catch (error) {
        console.error('Error deleting content type:', error);
        return { success: false, description: 'Failed to delete content type' };
      }
    },
  },
});