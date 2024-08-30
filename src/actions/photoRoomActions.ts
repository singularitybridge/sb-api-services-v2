import { ActionContext, FunctionFactory } from './types';
import { photoRoomService } from '../services/photoroom.service';
import { googleStorageService } from '../services/google.storage.service';
import * as path from 'path';

export const createPhotoRoomActions = (context: ActionContext): FunctionFactory => ({
  removeBackground: {
    description: 'Remove the background from an image using PhotoRoom API',
    strict: false,
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

      // Check if the required property is present
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

      // Verify that imageUrl is a non-empty string
      if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
        console.error('removeBackground: Invalid imageUrl', imageUrl);
        return {
          error: 'Invalid imageUrl',
          message: 'The imageUrl must be a non-empty string.',
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

      console.log('removeBackground: Calling PhotoRoom service with valid data');
      try {
        const processedImage = await photoRoomService.removeBackground(context.companyId, imageUrl);
        
        // Generate a unique filename for the processed image
        const filename = `processed_${Date.now()}${path.extname(imageUrl)}`;
        
        // Save the processed image to Google Storage
        const uploadedImageUrl = await googleStorageService.uploadBuffer(context.companyId, filename, processedImage, 'image/png');
        
        return {
          success: true,
          message: 'Background removed successfully',
          data: {
            imageUrl: uploadedImageUrl,
          },
        };
      } catch (error) {
        console.error('Error removing background:', error);
        return {
          success: false,
          message: 'Failed to remove background',
          error: (error as Error).message,
        };
      }
    },
  },
});