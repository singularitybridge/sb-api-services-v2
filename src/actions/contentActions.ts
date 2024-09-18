import { Session } from '../models/Session';
import * as ContentService from '../services/content.service';
import { ActionContext, FunctionFactory } from './types';

export const createContentActions = (context: ActionContext): FunctionFactory => ({
  createContentItem: {
    description: 'Create a new content item',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The title of the content item' },
        contentType: { type: 'string', description: 'The type of the content item' },
        content: { type: 'object', description: 'The content of the item' },
        metadata: { type: 'object', description: 'Additional metadata for the content item' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags for the content item' },
      },
      required: ['title', 'contentType', 'content'],
    },
    function: async (args: { title: string; contentType: string; content: any; metadata?: any; tags?: string[] }) => {
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          return { success: false, description: 'Invalid session' };
        }
        const contentItem = await ContentService.createContentItem(session.companyId, args);
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
      properties: {},
      required: [],
    },
    function: async () => {
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          return { success: false, description: 'Invalid session' };
        }
        const contentItems = await ContentService.getContentItems(session.companyId);
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
        updateData: { type: 'object', description: 'The data to update' },
      },
      required: ['itemId', 'updateData'],
    },
    function: async (args: { itemId: string; updateData: any }) => {
      try {
        const session = await Session.findById(context.sessionId);
        if (!session) {
          return { success: false, description: 'Invalid session' };
        }
        const updatedItem = await ContentService.updateContentItem(session.companyId, args.itemId, args.updateData);
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
        await ContentService.deleteContentItem(session.companyId, args.itemId);
        return {
          success: true,
          description: 'Content item deleted successfully',
        };
      } catch (error) {
        console.error('Error deleting content item:', error);
        return { success: false, description: 'Failed to delete content item' };
      }
    },
  },
});