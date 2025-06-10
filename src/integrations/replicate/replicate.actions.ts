import { ActionContext, FunctionFactory } from '../actions/types';
import { runReplicateModel } from './replicate.service';

interface ReplicateModelWithStringInputArgs {
  model: string;
  inputJsonString: string; // Changed from 'input' to 'inputJsonString' and type to string
  outputType?: 'image' | 'text' | 'json';
  filename?: string;
}

interface ReplicateImageModelWithStringInputArgs {
  model: string;
  inputJsonString: string; // Changed for consistency
  filename?: string;
}

export const createReplicateActions = (context: ActionContext): FunctionFactory => ({
  runReplicateModel: {
    description: 'Run any model on Replicate. Input must be a JSON string. Handles image outputs by uploading to storage.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'The Replicate model identifier (e.g., "owner/model-name" or "owner/model-name:version-id").',
        },
        inputJsonString: { // Changed from 'input'
          type: 'string',
          description: 'A JSON string representing the input object for the specified model.',
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
      required: ['model', 'inputJsonString'], // Changed from 'input'
      additionalProperties: false,
    },
    function: async (args: ReplicateModelWithStringInputArgs) => {
      const { model, inputJsonString, outputType, filename } = args;
      let inputObject: Record<string, any>;

      if (typeof model !== 'string' || model.trim().length === 0) {
        throw new Error('Invalid model identifier: Must be a non-empty string.');
      }
      try {
        inputObject = JSON.parse(inputJsonString);
      } catch (e) {
        throw new Error('Invalid inputJsonString: Must be a valid JSON string.');
      }
      if (typeof inputObject !== 'object' || inputObject === null) {
        // This case should ideally be caught by JSON.parse, but as a safeguard
        throw new Error('Parsed inputJsonString did not result in a valid object.');
      }

      try {
        const result = await runReplicateModel(context.companyId, { model, input: inputObject, filename });

        // If outputType is explicitly 'image', or if it's undefined AND the result is a string
        // (which we assume is the GCS URL from our service for an image),
        // then structure the output for an image.
        // The service's runReplicateModel already converts Replicate image URLs to GCS URLs (strings).
        if (outputType === 'image' || (!outputType && typeof result === 'string' && (result.startsWith('http://') || result.startsWith('https://')))) {
          // Return the GCS URL for the image
          return { success: true, data: result };
        } else {
          // For other types (text, json) or if result is not a string URL when outputType is not 'image'
          return { success: true, data: result };
        }
      } catch (error: any) {
        console.error('runReplicateModel: Error running model', error.message);
        // Error is already formatted by the service, re-throw it
        throw error;
      }
    },
  },
  runReplicateImageModel: {
    description: 'Run an image-generating or image-processing model on Replicate. Input must be a JSON string. The image output will be uploaded to storage.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description: 'The Replicate model identifier for an image model.',
        },
        inputJsonString: { // Changed from 'input'
          type: 'string',
          description: 'A JSON string representing the input object for the image model.',
        },
        filename: {
          type: 'string',
          description: 'Optional: Custom filename for the generated/processed image when uploading to storage.',
        },
      },
      required: ['model', 'inputJsonString'], // Changed from 'input'
      additionalProperties: false,
    },
    function: async (args: ReplicateImageModelWithStringInputArgs) => {
      const { model, inputJsonString, filename } = args;
      let inputObject: Record<string, any>;

      if (typeof model !== 'string' || model.trim().length === 0) {
        throw new Error('Invalid model identifier: Must be a non-empty string.');
      }
      try {
        inputObject = JSON.parse(inputJsonString);
      } catch (e) {
        throw new Error('Invalid inputJsonString: Must be a valid JSON string.');
      }
      if (typeof inputObject !== 'object' || inputObject === null) {
        throw new Error('Parsed inputJsonString did not result in a valid object.');
      }
      
      try {
        // This action specifically expects an image output that will be uploaded.
        // The runReplicateModel service function already handles this logic.
        const imageUrl = await runReplicateModel(context.companyId, { model, input: inputObject, filename });
        return { success: true, data: { imageUrl } };
      } catch (error: any) {
        console.error('runReplicateImageModel: Error running image model', error.message);
        throw error;
      }
    },
  },
});
