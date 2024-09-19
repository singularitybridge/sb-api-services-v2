import { Session } from '../models/Session';
import { ContentTypeService } from '../services/content-type.service';
import { ActionContext, FunctionFactory } from './types';
import mongoose from 'mongoose';

export const createContentTypeActions = (context: ActionContext): FunctionFactory => ({
  createContentType: {
    description: 'Create a new content type',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The name of the content type' },
        fields: { 
          type: 'array', 
          description: 'The fields of the content type',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The name of the field' },
              type: { type: 'string', description: 'The type of the field' },
              required: { type: 'boolean', description: 'Whether the field is required' },
            },
            required: ['name', 'type']
          }
        },
      },
      required: ['name', 'fields'],
    },
    function: async (args: { name: string; fields: Array<{ name: string; type: string; required?: boolean }> }) => {
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          return { success: false, description: 'Invalid session' };
        }
        const contentType = await ContentTypeService.createContentType({ 
          name: args.name, 
          fields: args.fields,
          companyId: new mongoose.Types.ObjectId(session.companyId)
        });
        return {
          success: true,
          description: 'Content type created successfully',
          data: contentType,
        };
      } catch (error) {
        console.error('Error creating content type:', error);
        return { success: false, description: 'Failed to create content type' };
      }
    },
  },

  getContentTypes: {
    description: 'Get all content types for the company',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    function: async () => {
      try {
        const contentTypes = await ContentTypeService.getAllContentTypes();
        return {
          success: true,
          description: 'Content types retrieved successfully',
          data: contentTypes,
        };
      } catch (error) {
        console.error('Error getting content types:', error);
        return { success: false, description: 'Failed to retrieve content types' };
      }
    },
  },

  updateContentType: {
    description: 'Update an existing content type',
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: { type: 'string', description: 'The ID of the content type to update' },
        name: { type: 'string', description: 'The new name of the content type (optional)' },
        fields: { 
          type: 'array', 
          description: 'The updated fields of the content type (optional)',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'The name of the field' },
              type: { type: 'string', description: 'The type of the field' },
              required: { type: 'boolean', description: 'Whether the field is required' },
            },
            required: ['name', 'type']
          }
        },
      },
      required: ['contentTypeId'],
    },
    function: async (args: { contentTypeId: string; name?: string; fields?: Array<{ name: string; type: string; required?: boolean }> }) => {
      try {
        const updatedContentType = await ContentTypeService.updateContentType(args.contentTypeId, { 
          name: args.name, 
          fields: args.fields 
        });
        if (!updatedContentType) {
          return { success: false, description: 'Content type not found' };
        }
        return {
          success: true,
          description: 'Content type updated successfully',
          data: updatedContentType,
        };
      } catch (error) {
        console.error('Error updating content type:', error);
        return { success: false, description: 'Failed to update content type' };
      }
    },
  },

  deleteContentType: {
    description: 'Delete a content type',
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: { type: 'string', description: 'The ID of the content type to delete' },
      },
      required: ['contentTypeId'],
    },
    function: async (args: { contentTypeId: string }) => {
      try {
        const result = await ContentTypeService.deleteContentType(args.contentTypeId);
        if (result) {
          return {
            success: true,
            description: 'Content type deleted successfully',
          };
        } else {
          return {
            success: false,
            description: 'Content type not found or could not be deleted',
          };
        }
      } catch (error) {
        console.error('Error deleting content type:', error);
        return { success: false, description: 'Failed to delete content type' };
      }
    },
  },
});