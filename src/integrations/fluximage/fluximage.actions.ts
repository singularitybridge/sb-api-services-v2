import { ActionContext, FunctionFactory } from '../actions/types';
import { generateFluxImage } from './fluximage.service';

interface FluxImageArgs {
  prompt: string;
  width?: number;
  height?: number;
}

export const createFluxImageActions = (context: ActionContext): FunctionFactory => ({
  generateFluxImage: {
    description: 'Generate an image using Flux AI. The width and height should be multiples of 8.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Text input required to guide the image generation'
        },
        width: {
          type: 'number',
          description: 'The width of the generated image in pixels (256 to 1280). Must be a multiple of 8.',
        },
        height: {
          type: 'number',
          description: 'The height of the generated image in pixels (256 to 1280). Must be a multiple of 8.',
        }
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    function: async (args: FluxImageArgs) => {
      

      const { prompt, width, height } = args;

      // Verify that prompt is a string
      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        console.error('generateFluxImage: Invalid prompt', prompt);
        return {
          error: 'Invalid prompt',
          message: 'The prompt must be a non-empty string.',
        };
      }

      // Verify width and height if provided
      if (width !== undefined && (typeof width !== 'number' || width < 256 || width > 1280 || width % 8 !== 0)) {
        console.error('generateFluxImage: Invalid width', width);
        return {
          error: 'Invalid width',
          message: 'The width must be a number between 256 and 1280 and a multiple of 8.',
        };
      }

      if (height !== undefined && (typeof height !== 'number' || height < 256 || height > 1280 || height % 8 !== 0)) {
        console.error('generateFluxImage: Invalid height', height);
        return {
          error: 'Invalid height',
          message: 'The height must be a number between 256 and 1280 and a multiple of 8.',
        };
      }

      try {
        console.log('generateFluxImage: Calling generateFluxImage service');
        const imageUrl = await generateFluxImage(context.companyId, { prompt, width, height });
        return { imageUrl };
      } catch (error) {
        console.error('generateFluxImage: Error generating image', error);
        return {
          error: 'Image generation failed',
          message: 'Failed to generate the image using Flux AI.',
        };
      }
    },
  },
});