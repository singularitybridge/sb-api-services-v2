import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { removeBackgroundFromImage as removeBackgroundFromImageService } from './photoroom.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

interface RemoveBackgroundArgs {
  imageUrl: string;
  filename?: string;
  // No other properties allowed due to additionalProperties: false in schema
}

// R type for StandardActionResult<R>
interface RemoveBackgroundResponseData {
  imageUrl: string;
}

// S type for serviceCall lambda's response
interface ServiceCallLambdaResponse {
  success: boolean;
  data: RemoveBackgroundResponseData;
  description?: string;
}

const SERVICE_NAME = 'photoRoomService';

export const createPhotoRoomActions = (
  context: ActionContext,
): FunctionFactory => ({
  removeBackground: {
    description:
      'Remove the background from an image using PhotoRoom API and upload the result',
    strict: true, // This implies additionalProperties: false is handled by a higher layer
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
      additionalProperties: false, // Explicitly defined here
    },
    function: async (
      args: RemoveBackgroundArgs,
    ): Promise<StandardActionResult<RemoveBackgroundResponseData>> => {
      const { imageUrl, filename } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (imageUrl === undefined) {
        // Schema 'required' should catch this, but good for explicit check
        throw new ActionValidationError('imageUrl parameter is required.');
      }

      // Check for additional properties manually if strict mode isn't fully relied upon for arg shape
      const argKeys = Object.keys(args);
      if (
        argKeys.length > 2 ||
        !argKeys.every((key) => ['imageUrl', 'filename'].includes(key))
      ) {
        const allowedProps = ['imageUrl', 'filename'];
        const extraProps = argKeys.filter(
          (prop) => !allowedProps.includes(prop),
        );
        if (extraProps.length > 0) {
          throw new ActionValidationError(
            `Additional properties are not allowed: ${extraProps.join(', ')}`,
          );
        }
      }

      if (typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
        throw new ActionValidationError(
          'The imageUrl must be a non-empty string.',
        );
      }

      try {
        new URL(imageUrl);
      } catch (error) {
        throw new ActionValidationError(
          'The provided imageUrl is not a valid URL.',
        );
      }

      if (
        filename !== undefined &&
        (typeof filename !== 'string' || filename.trim().length === 0)
      ) {
        throw new ActionValidationError(
          'If provided, the filename must be a non-empty string.',
        );
      }

      return executeAction<
        RemoveBackgroundResponseData,
        ServiceCallLambdaResponse
      >(
        'removeBackground',
        async (): Promise<ServiceCallLambdaResponse> => {
          // removeBackgroundFromImageService throws on error or returns the processed image URL string
          const processedImageUrl = await removeBackgroundFromImageService(
            context.companyId!, // companyId is validated above
            { imageUrl, filename },
          );
          return { success: true, data: { imageUrl: processedImageUrl } };
        },
        {
          serviceName: SERVICE_NAME,
          // Default dataExtractor (res => res.data) will work
        },
      );
    },
  },
});
