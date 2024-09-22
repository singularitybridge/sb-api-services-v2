import { ActionContext, FunctionFactory } from '../../actions/types';
import { removeBackgroundFromImage } from './photoroom.service';

export const createPhotoRoomActions = (context: ActionContext): FunctionFactory => ({
  removeBackground: {
    description: 'Remove the background from an image using PhotoRoom API',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          description: 'The URL of the image to process',
        },
      },
      required: ['imageUrl'],
      additionalProperties: false,
    },
    function: async (args) => {
      console.log('removeBackground called with arguments:', JSON.stringify(args, null, 2));

      const { imageUrl } = args;

      // Check if all required properties are present
      if (imageUrl === undefined) {
        console.error('removeBackground: Missing required parameter');
        return {
          error: 'Missing parameter',
          message: 'imageUrl parameter is required.',
        };
      }

      // Check for additional properties
      const allowedProps = ['imageUrl'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        console.error('removeBackground: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

      // Verify that imageUrl is a string
      if (typeof imageUrl !== 'string') {
        console.error('removeBackground: Invalid imageUrl type', typeof imageUrl);
        return {
          error: 'Invalid imageUrl',
          message: 'The imageUrl must be a string.',
        };
      }

      // Verify that imageUrl is a valid URL
      try {
        new URL(imageUrl);
      } catch (error) {
        console.error('removeBackground: Invalid URL', imageUrl);
        return {
          error: 'Invalid URL',
          message: 'The provided imageUrl is not a valid URL.',
        };
      }

      try {
        console.log('removeBackground: Calling removeBackgroundFromImage service');
        const result = await removeBackgroundFromImage(context.companyId, imageUrl);
        return { result };
      } catch (error) {
        console.error('removeBackground: Error removing background', error);
        return {
          error: 'Background removal failed',
          message: 'Failed to remove background using PhotoRoom API.',
        };
      }
    },
  },
});