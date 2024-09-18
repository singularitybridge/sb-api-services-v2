import { Session } from '../models/Session';
import * as ContentService from '../services/content.service';
import { ActionContext, FunctionFactory } from './types';

export const createContentActions = (context: ActionContext): FunctionFactory => ({
  createContentItem: {
    description: 'Create a new content item',
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: { type: 'string', description: 'The ID of the content type' },
        data: { type: 'object', description: 'The content data of the item' },
      },
      required: ['contentTypeId', 'data'],
    },
    function: async (args: { contentTypeId: string; data: any }) => {
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          return { success: false, description: 'Invalid session' };
        }
        const contentItem = await ContentService.createContentItem(session.companyId, args.contentTypeId, args.data);
        return {
          success: true,
          description: 'Content item created successfully',
          data: contentItem,
        };
      } catch (error) {
        console.error('Error creating content item:', error);
        return { success: false, description: 'Failed to create content item' };
      }
    },
  },

  getContentItems: {
    description: 'Get all content items for the company',
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: { type: 'string', description: 'The ID of the content type to filter by (optional)' },
        orderBy: { type: 'string', description: 'The field to order by (optional)' },
        limit: { type: 'number', description: 'The maximum number of items to return (optional)' },
        skip: { type: 'number', description: 'The number of items to skip (optional)' },
      },
      required: [],
    },
    function: async (args: { contentTypeId?: string; orderBy?: string; limit?: number; skip?: number }) => {
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          return { success: false, description: 'Invalid session' };
        }
        const contentItems = await ContentService.getContentItems(
          session.companyId,
          args.contentTypeId,
          args.orderBy,
          args.limit,
          args.skip
        );
        return {
          success: true,
          description: 'Content items retrieved successfully',
          data: contentItems,
        };
      } catch (error) {
        console.error('Error getting content items:', error);
        return { success: false, description: 'Failed to retrieve content items' };
      }
    },
  },

  updateContentItem: {
    description: 'Update an existing content item',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'The ID of the content item to update' },
        data: { type: 'object', description: 'The data to update' },
      },
      required: ['itemId', 'data'],
    },
    function: async (args: { itemId: string; data: any }) => {
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          return { success: false, description: 'Invalid session' };
        }
        const updatedItem = await ContentService.updateContentItem(args.itemId, session.companyId, args.data);
        if (!updatedItem) {
          return { success: false, description: 'Content item not found' };
        }
        return {
          success: true,
          description: 'Content item updated successfully',
          data: updatedItem,
        };
      } catch (error) {
        console.error('Error updating content item:', error);
        return { success: false, description: 'Failed to update content item' };
      }
    },
  },

  deleteContentItem: {
    description: 'Delete a content item',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'The ID of the content item to delete' },
      },
      required: ['itemId'],
    },
    function: async (args: { itemId: string }) => {
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          return { success: false, description: 'Invalid session' };
        }
        const result = await ContentService.deleteContentItem(args.itemId, session.companyId);
        if (result) {
          return {
            success: true,
            description: 'Content item deleted successfully',
          };
        } else {
          return {
            success: false,
            description: 'Content item not found or could not be deleted',
          };
        }
      } catch (error) {
        console.error('Error deleting content item:', error);
        return { success: false, description: 'Failed to delete content item' };
      }
    },
  },
});