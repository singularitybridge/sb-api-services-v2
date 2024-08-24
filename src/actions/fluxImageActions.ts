import { ActionContext, FunctionFactory } from './types';
import { generateFluxImage } from '../services/flux.image.service';

export const createFluxImageActions = (context: ActionContext): FunctionFactory => ({
  generateFluxImage: {
    description: 'Generate an image using Flux AI',
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
          description: 'The width of the generated image in pixels (256 to 1280)',
        },
        height: {
          type: 'number',
          description: 'The height of the generated image in pixels (256 to 1280)',
        }
      },
      required: ['prompt', 'width', 'height'],
      additionalProperties: false,
    },
    function: async (args) => {
      console.log('generateFluxImage called with arguments:', JSON.stringify(args, null, 2));

      const { prompt, width, height } = args;

      // Check if all required properties are present
      if (prompt === undefined) {
        console.error('generateFluxImage: Missing required parameter');
        return {
          error: 'Missing parameter',
          message: 'The prompt parameter is required.',
        };
      }

      // Check for additional properties
      const allowedProps = ['prompt', 'width', 'height'];
      const extraProps = Object.keys(args).filter(prop => !allowedProps.includes(prop));
      if (extraProps.length > 0) {
        console.error('generateFluxImage: Additional properties found', extraProps);
        return {
          error: 'Invalid parameters',
          message: `Additional properties are not allowed: ${extraProps.join(', ')}`,
        };
      }

      // Verify that prompt is a string
      if (typeof prompt !== 'string') {
        console.error('generateFluxImage: Invalid prompt type', typeof prompt);
        return {
          error: 'Invalid prompt',
          message: 'The prompt must be a string.',
        };
      }

      // Verify width and height if provided
      if (width !== undefined && (typeof width !== 'number' || width < 256 || width > 1280)) {
        console.error('generateFluxImage: Invalid width', width);
        return {
          error: 'Invalid width',
          message: 'The width must be a number between 256 and 1280.',
        };
      }

      if (height !== undefined && (typeof height !== 'number' || height < 256 || height > 1280)) {
        console.error('generateFluxImage: Invalid height', height);
        return {
          error: 'Invalid height',
          message: 'The height must be a number between 256 and 1280.',
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