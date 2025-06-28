import {
  ActionContext,
  FunctionFactory,
  StandardActionResult,
} from '../actions/types';
import { generateFluxImage as generateFluxImageService } from './fluximage.service';
import { executeAction, ExecuteActionOptions } from '../actions/executor';
import { ActionValidationError } from '../../utils/actionErrors';

interface FluxImageArgs {
  prompt: string;
  width?: number;
  height?: number;
  filename?: string;
}

// R type for StandardActionResult<R>
interface FluxImageResponseData {
  imageUrl: string;
}

// S type for serviceCall lambda's response
interface ServiceCallLambdaResponse {
  success: boolean;
  data: FluxImageResponseData;
  description?: string;
}

const SERVICE_NAME = 'fluxImageService';

export const createFluxImageActions = (
  context: ActionContext,
): FunctionFactory => ({
  generateFluxImage: {
    description:
      'Generate an image using Flux AI. The width and height should be multiples of 8.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Text input required to guide the image generation',
        },
        width: {
          type: 'number',
          description:
            'The width of the generated image in pixels (256 to 1280). Must be a multiple of 8.',
        },
        height: {
          type: 'number',
          description:
            'The height of the generated image in pixels (256 to 1280). Must be a multiple of 8.',
        },
        filename: {
          type: 'string',
          description: 'Optional custom filename for the generated image',
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    function: async (
      args: FluxImageArgs,
    ): Promise<StandardActionResult<FluxImageResponseData>> => {
      const { prompt, width, height, filename } = args;

      if (!context.companyId) {
        throw new ActionValidationError('Company ID is missing from context.');
      }

      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        throw new ActionValidationError(
          'The prompt must be a non-empty string.',
        );
      }

      if (
        width !== undefined &&
        (typeof width !== 'number' ||
          width < 256 ||
          width > 1280 ||
          width % 8 !== 0)
      ) {
        throw new ActionValidationError(
          'The width must be a number between 256 and 1280 and a multiple of 8.',
        );
      }

      if (
        height !== undefined &&
        (typeof height !== 'number' ||
          height < 256 ||
          height > 1280 ||
          height % 8 !== 0)
      ) {
        throw new ActionValidationError(
          'The height must be a number between 256 and 1280 and a multiple of 8.',
        );
      }

      return executeAction<FluxImageResponseData, ServiceCallLambdaResponse>(
        'generateFluxImage',
        async (): Promise<ServiceCallLambdaResponse> => {
          const imageUrl = await generateFluxImageService(context.companyId!, {
            prompt,
            width,
            height,
            filename,
          });
          return { success: true, data: { imageUrl } };
        },
        {
          serviceName: SERVICE_NAME,
          // Default dataExtractor (res => res.data) will work
        },
      );
    },
  },
});
