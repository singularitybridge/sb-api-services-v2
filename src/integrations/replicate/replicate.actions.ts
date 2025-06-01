import { ActionContext, FunctionFactory } from '../actions/types';
import { runReplicateModel } from './replicate.service';

interface ReplicateModelArgs {
  model: string;
  input: Record<string, any>;
  outputType?: 'image' | 'text' | 'json'; // Optional: to guide output handling if needed
  filename?: string; // For image outputs
}

export const createReplicateActions = (context: ActionContext): FunctionFactory => ({
  runReplicateModel: {
    description: 'Run any model on Replicate by providing the model identifier and input object. Handles image outputs by uploading to storage.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'The Replicate model identifier (e.g., "owner/model-name" or "owner/model-name:version-id").',
        },
        input: {
          type: 'object',
          description: 'A JSON object containing the input parameters for the specified model.',
          additionalProperties: true,
        },
        outputType: {
          type: 'string',
          enum: ['image', 'text', 'json'],
          description: 'Optional: Specify the expected output type to help guide processing. Defaults to "image" if output is a URL.',
        },
        filename: {
          type: 'string',
          description: 'Optional: If the output is an image, this will be used as the filename when uploading to storage.',
        },
      },
      required: ['model', 'input'],
      additionalProperties: false,
    },
    function: async (args: ReplicateModelArgs) => {
      const { model, input, filename } = args;

      if (typeof model !== 'string' || model.trim().length === 0) {
        throw new Error('Invalid model identifier: Must be a non-empty string.');
      }
      if (typeof input !== 'object' || input === null) {
        throw new Error('Invalid input: Must be a JSON object.');
      }

      try {
        const result = await runReplicateModel(context.companyId, { model, input, filename });
        return { success: true, data: result };
      } catch (error: any) {
        console.error('runReplicateModel: Error running model', error.message);
        // Error is already formatted by the service, re-throw it
        throw error;
      }
    },
  },
  runReplicateImageModel: {
    description: 'Run an image-generating or image-processing model on Replicate. The image output will be uploaded to storage.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'The Replicate model identifier for an image model.',
        },
        input: {
          type: 'object',
          description: 'A JSON object containing the input parameters for the image model.',
          additionalProperties: true,
        },
        filename: {
          type: 'string',
          description: 'Optional: Custom filename for the generated/processed image when uploading to storage.',
        },
      },
      required: ['model', 'input'],
      additionalProperties: false,
    },
    function: async (args: Omit<ReplicateModelArgs, 'outputType'>) => {
      const { model, input, filename } = args;

      if (typeof model !== 'string' || model.trim().length === 0) {
        throw new Error('Invalid model identifier: Must be a non-empty string.');
      }
      if (typeof input !== 'object' || input === null) {
        throw new Error('Invalid input: Must be a JSON object.');
      }

      try {
        // This action specifically expects an image output that will be uploaded.
        // The runReplicateModel service function already handles this logic.
        const imageUrl = await runReplicateModel(context.companyId, { model, input, filename });
        return { success: true, data: { imageUrl } };
      } catch (error: any) {
        console.error('runReplicateImageModel: Error running image model', error.message);
        throw error;
      }
    },
  },
});
