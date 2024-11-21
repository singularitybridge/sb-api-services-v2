import { ActionContext, FunctionFactory } from '../actions/types';
import { removeBackgroundFromImage } from './photoroom.service';

interface RemoveBackgroundArgs {
  imageUrl: string;
  filename?: string;
}

export const createPhotoRoomActions = (
  context: ActionContext,
): FunctionFactory => ({
  removeBackground: {
    description: 'Remove the background from an image using PhotoRoom API and upload the result',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          description: 'The URL of the image to process',
        },
        filename: {
          type: 'string',
          description: 'Optional custom filename for the processed image',
        },
      },
      required: ['imageUrl'],
      additionalProperties: false,
    },
    function: async (args: RemoveBackgroundArgs) => {
      const { imageUrl, filename } = args;

      // Check if all required properties are present
      if (imageUrl === undefined) {
        return {
          error: 'Missing parameter',
          message: 'imageUrl parameter is required.',
        };
      }

      // Check for additional properties
      const allowedProps = ['imageUrl', 'filename'];
      const extraProps = Object.keys(args).filter(
        (prop) => !allowedProps.includes(prop),
      );
      if (extraProps.length > 0) {
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(
            ', ',
          )}`,
        };
      }

      // Verify that imageUrl is a non-empty string
      if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
        return {
          error: 'Invalid imageUrl',
          message: 'The imageUrl must be a non-empty string.',
        };
      }

      // Verify that imageUrl is a valid URL
      try {
        new URL(imageUrl);
      } catch (error) {        
        return {
          error: 'Invalid URL',
          message: 'The provided imageUrl is not a valid URL.',
        };
      }

      // Verify that filename is a non-empty string if provided
      if (filename !== undefined && (typeof filename !== 'string' || filename.trim().length === 0)) {
        return {
          error: 'Invalid filename',
          message: 'The filename must be a non-empty string.',
        };
      }

      try {
        const processedImageUrl = await removeBackgroundFromImage(
          context.companyId,
          { imageUrl, filename }
        );
        return {
          success: true,
          message: 'Background removed and image uploaded successfully',
          data: {
            imageUrl: processedImageUrl,
          },
        };
      } catch (error) {
        console.error('removeBackground: Error processing image', error);
        return {
          success: false,
          message: 'Failed to process image using PhotoRoom API',
          error: (error as Error).message,
        };
      }
    },
  },
});
