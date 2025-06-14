import { Session } from '../models/Session';
import * as ContentService from '../services/content.service';
import { ActionContext, FunctionFactory, StandardActionResult } from '../integrations/actions/types';
import { IContentItem } from '../models/ContentItem';

// Define data types for StandardActionResult payloads
type CreateContentData = IContentItem;
type GetContentData = IContentItem[];
type UpdateContentData = IContentItem;
type DeleteContentData = { message: string }; // Or simply use 'undefined' if no specific data needed

export const createContentActions = (
  context: ActionContext,
): FunctionFactory => ({
  createContentItem: {
    description: 'Create a new content item',
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: {
          type: 'string',
          description: 'The ID of the content type',
        },
        data: {
          type: 'object',
          description: 'The content data of the item',
          additionalProperties: true,
        },
        artifactKey: {
          type: 'string',
          description: 'The artifact key to group multiple content items',
        },
      },
      required: ['contentTypeId', 'data', 'artifactKey'],
    },
    function: async (args: { contentTypeId: string; data: any; artifactKey: string }): Promise<StandardActionResult<CreateContentData>> => {
      const session = await Session.findById(context.sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }

      if (!args.data || typeof args.data !== 'object') {
        throw new Error('Invalid data provided: Data must be a non-null object');
      }

      try {
        // Assuming ContentService.createContentItem throws on internal error or returns IContentItem
        // If it can return { error: string, details: any }, that needs to be handled by throwing
        const result = await ContentService.createContentItem(
          session.companyId,
          args.contentTypeId,
          args.data,
          args.artifactKey,
        );
        
        // Check if the service returned an error structure instead of throwing
        if (typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string') {
           throw new Error(`Failed to create content item: ${result.error} ${result.details ? JSON.stringify(result.details) : ''}`);
        }

        return {
          success: true,
          message: 'Content item created successfully',
          data: result as CreateContentData, // Cast to ensure type alignment
        };
      } catch (error) {
        console.error('Error creating content item:', error);
        // Re-throw the error to be caught by the global error handler
        throw new Error(error instanceof Error ? error.message : 'Failed to create content item due to an unknown error');
      }
    },
  },

  getContentItems: {
    description: 'Get all content items for the company',
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: {
          type: 'string',
          description: 'The ID of the content type to filter by (optional)',
        },
        artifactKey: {
          type: 'string',
          description: 'The artifact key to filter by (optional)',
        },
        orderBy: {
          type: 'string',
          description: 'The field to order by (optional)',
        },
        limit: {
          type: 'number',
          description: 'The maximum number of items to return (optional)',
        },
        skip: {
          type: 'number',
          description: 'The number of items to skip (optional)',
        },
      },
      required: [],
    },
    function: async (args: {
      contentTypeId?: string;
      artifactKey?: string;
      orderBy?: string;
      limit?: number;
      skip?: number;
    }): Promise<StandardActionResult<GetContentData>> => {
      const session = await Session.findById(context.sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }
      try {
        const contentItems = await ContentService.getContentItems(
          session.companyId,
          args.contentTypeId,
          args.artifactKey,
          args.orderBy,
          args.limit,
          args.skip,
        );
        return {
          success: true,
          message: 'Content items retrieved successfully',
          data: contentItems,
        };
      } catch (error) {
        console.error('Error getting content items:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to retrieve content items');
      }
    },
  },

  getContentItemsByArtifactKey: {
    description: 'Get content items by artifact key',
    parameters: {
      type: 'object',
      properties: {
        artifactKey: {
          type: 'string',
          description: 'The artifact key to filter by',
        },
        contentTypeId: {
          type: 'string',
          description: 'The ID of the content type to filter by (optional)',
        },
        orderBy: {
          type: 'string',
          description: 'The field to order by (optional)',
        },
        limit: {
          type: 'number',
          description: 'The maximum number of items to return (optional)',
        },
        skip: {
          type: 'number',
          description: 'The number of items to skip (optional)',
        },
      },
      required: ['artifactKey'],
    },
    function: async (args: {
      artifactKey: string;
      contentTypeId?: string;
      orderBy?: string;
      limit?: number;
      skip?: number;
    }): Promise<StandardActionResult<GetContentData>> => {
      const session = await Session.findById(context.sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }
      try {
        const contentItems = await ContentService.getContentItemsByArtifactKey(
          session.companyId,
          args.artifactKey,
          args.contentTypeId,
          args.orderBy,
          args.limit,
          args.skip,
        );
        return {
          success: true,
          message: 'Content items retrieved successfully by artifact key',
          data: contentItems,
        };
      } catch (error) {
        console.error('Error getting content items by artifact key:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to retrieve content items by artifact key');
      }
    },
  },

  updateContentItem: {
    description: 'Update an existing content item',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: 'The ID of the content item to update',
        },
        data: { type: 'object', description: 'The data to update' },
        artifactKey: {
          type: 'string',
          description: 'The new artifact key (optional)',
        },
      },
      required: ['itemId', 'data'],
    },
    function: async (args: { itemId: string; data: any; artifactKey?: string }): Promise<StandardActionResult<UpdateContentData>> => {
      const session = await Session.findById(context.sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }
      try {
        const result = await ContentService.updateContentItem(
          args.itemId,
          session.companyId,
          args.data,
          args.artifactKey || '', // Pass empty string if undefined, service might handle it
        );
        
        if (typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string') {
          throw new Error(`Failed to update content item: ${result.error} ${result.details ? JSON.stringify(result.details) : ''}`);
        }
        return {
          success: true,
          message: 'Content item updated successfully',
          data: result as UpdateContentData,
        };
      } catch (error) {
        console.error('Error updating content item:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to update content item');
      }
    },
  },

  deleteContentItem: {
    description: 'Delete a content item',
    parameters: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: 'The ID of the content item to delete',
        },
      },
      required: ['itemId'],
    },
    function: async (args: { itemId: string }): Promise<StandardActionResult<DeleteContentData>> => {
      const session = await Session.findById(context.sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }
      try {
        const wasDeleted = await ContentService.deleteContentItem(
          args.itemId,
          session.companyId,
        );
        if (wasDeleted) {
          return {
            success: true,
            message: 'Content item deleted successfully',
            data: { message: 'Content item deleted successfully' } 
          };
        } else {
          // If service returns false, it implies a failure that wasn't an exception (e.g., item not found)
          throw new Error('Content item not found or could not be deleted.');
        }
      } catch (error) {
        console.error('Error deleting content item:', error);
        throw new Error(error instanceof Error ? error.message : 'Failed to delete content item');
      }
    },
  },
});
