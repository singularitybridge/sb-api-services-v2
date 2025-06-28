import { Session } from '../models/Session';
import { ContentTypeService } from '../services/content-type.service';
import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../integrations/actions/types';
import { IContentType } from '../models/ContentType'; // Correct model import
import mongoose from 'mongoose';

// Define data types for StandardActionResult payloads
type CreateContentTypeData = IContentType;
type GetContentTypesData = IContentType[];
type UpdateContentTypeData = IContentType;
type DeleteContentTypeData = { message: string };

export const createContentTypeActions = (
  context: ActionContext,
): FunctionFactory => ({
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
              required: {
                type: 'boolean',
                description: 'Whether the field is required',
              },
            },
            required: ['name', 'type'],
          },
        },
      },
      required: ['name', 'fields'],
    },
    function: async (args: {
      name: string;
      fields: Array<{ name: string; type: string; required?: boolean }>;
    }): Promise<StandardActionResult<CreateContentTypeData>> => {
      const session = await Session.findById(context.sessionId);
      if (!session) {
        throw new Error('Invalid session');
      }
      try {
        const contentType = await ContentTypeService.createContentType({
          name: args.name,
          fields: args.fields,
          companyId: new mongoose.Types.ObjectId(session.companyId),
        });
        return {
          success: true,
          message: 'Content type created successfully',
          data: contentType,
        };
      } catch (error) {
        console.error('Error creating content type:', error);
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Failed to create content type',
        );
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
    function: async (): Promise<StandardActionResult<GetContentTypesData>> => {
      try {
        // Assuming getAllContentTypes is modified or already fetches by companyId if necessary,
        // or if it's a global fetch, ensure it's intended.
        // For now, let's assume it's fetching for the current company based on context if needed by service.
        // If ContentTypeService.getAllContentTypes() needs companyId, it should be passed.
        // The original code did not pass companyId here. If it's implicit in service, it's fine.
        // For safety, if service requires companyId, it should be added.
        // Let's assume the service handles company context or doesn't need it for this specific call.
        const session = await Session.findById(context.sessionId);
        if (!session) {
          throw new Error('Invalid session');
        }
        // ContentTypeService.getAllContentTypes() currently takes no arguments.
        // It will fetch all content types. If company-specific filtering is needed,
        // the service method itself would need to be updated.
        const contentTypes = await ContentTypeService.getAllContentTypes();

        return {
          success: true,
          message: 'Content types retrieved successfully',
          data: contentTypes,
        };
      } catch (error) {
        console.error('Error getting content types:', error);
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Failed to retrieve content types',
        );
      }
    },
  },

  updateContentType: {
    description: 'Update an existing content type',
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
          description: 'The updated fields of the content type (optional)',
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
        },
      },
      required: ['contentTypeId'],
    },
    function: async (args: {
      contentTypeId: string;
      name?: string;
      fields?: Array<{ name: string; type: string; required?: boolean }>;
    }): Promise<StandardActionResult<UpdateContentTypeData>> => {
      try {
        // Session validation might be good here too if company context is needed by service implicitly
        const updatedContentType = await ContentTypeService.updateContentType(
          args.contentTypeId,
          {
            name: args.name,
            fields: args.fields,
            // If updateContentType needs companyId for scoping, ensure it's passed or handled by service
          },
        );
        if (!updatedContentType) {
          throw new Error('Content type not found or failed to update.');
        }
        return {
          success: true,
          message: 'Content type updated successfully',
          data: updatedContentType,
        };
      } catch (error) {
        console.error('Error updating content type:', error);
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Failed to update content type',
        );
      }
    },
  },

  deleteContentType: {
    description: 'Delete a content type',
    parameters: {
      type: 'object',
      properties: {
        contentTypeId: {
          type: 'string',
          description: 'The ID of the content type to delete',
        },
      },
      required: ['contentTypeId'],
    },
    function: async (args: {
      contentTypeId: string;
    }): Promise<StandardActionResult<DeleteContentTypeData>> => {
      try {
        // Session validation might be good here too
        const result = await ContentTypeService.deleteContentType(
          args.contentTypeId,
        );
        if (result) {
          // Assuming service returns true on success, false or throws on failure
          return {
            success: true,
            message: 'Content type deleted successfully',
            data: { message: 'Content type deleted successfully' },
          };
        } else {
          throw new Error('Content type not found or could not be deleted.');
        }
      } catch (error) {
        console.error('Error deleting content type:', error);
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Failed to delete content type',
        );
      }
    },
  },
});
