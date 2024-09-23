import * as fs from 'fs';
import * as path from 'path';
import { ActionContext, FunctionDefinition, FunctionFactory, sanitizeFunctionName, createFunctionFactory, executeFunctionCall } from '../../../src/integrations/actions/factory';
import { discoveryService } from '../../../src/integrations/discovery.service';

jest.mock('fs');
jest.mock('path');
jest.mock('../../../src/integrations/discovery.service');
jest.mock('../../../src/services/template.service', () => ({
  processTemplate: jest.fn((template) => Promise.resolve(template)),
}));

describe('Action Factory', () => {
  const mockContext: ActionContext = { sessionId: 'test-session', companyId: 'test-company' };

  beforeEach(() => {
    jest.resetAllMocks();
    (fs.readdirSync as jest.Mock).mockReturnValue(['photoroom', 'perplexity']);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  const mockFunctionDefinition: FunctionDefinition = {
    description: 'Remove the background from an image using PhotoRoom API',
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
    function: jest.fn(),
  };

  describe('createFunctionFactory', () => {
    it('should load actions from integrations', async () => {
      const mockActions = [
        {
          id: 'photoroom.removeBackground',
          serviceName: 'PhotoRoom',
          actionTitle: 'Remove Background',
          description: 'Remove the background from an image using PhotoRoom API',
          icon: 'image',
          service: 'photoroom',
          parameters: mockFunctionDefinition.parameters,
        },
      ];

      (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);

      const factory = await createFunctionFactory(mockContext, ['photoroom.removeBackground']);

      expect(factory).toHaveProperty('photoroom_removeBackground');
      expect(factory['photoroom_removeBackground']).toMatchObject({
        description: 'Remove the background from an image using PhotoRoom API',
        parameters: mockFunctionDefinition.parameters,
      });
      expect(typeof factory['photoroom_removeBackground'].function).toBe('function');
    });

    it('should filter actions based on allowed actions', async () => {
      const mockActions = [
        {
          id: 'photoroom.removeBackground',
          serviceName: 'PhotoRoom',
          actionTitle: 'Remove Background',
          description: 'Remove the background from an image using PhotoRoom API',
          icon: 'image',
          service: 'photoroom',
          parameters: mockFunctionDefinition.parameters,
        },
        {
          id: 'photoroom.anotherAction',
          serviceName: 'PhotoRoom',
          actionTitle: 'Another Action',
          description: 'Another action description',
          icon: 'image',
          service: 'photoroom',
          parameters: {},
        },
      ];

      (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);

      const factory = await createFunctionFactory(mockContext, ['photoroom.removeBackground']);

      expect(factory).toHaveProperty('photoroom_removeBackground');
      expect(factory).not.toHaveProperty('photoroom_anotherAction');
    });

    it('should load actions with valid integrations and allowed actions', async () => {
      const mockActions = [
        {
          id: 'perplexity.perplexitySearch',
          serviceName: 'Perplexity',
          actionTitle: 'Perplexity Search',
          description: 'Perform a search using the Perplexity API',
          icon: 'search',
          service: 'perplexity',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query',
              },
              model: {
                type: 'string',
                description: 'The Perplexity model to use for the search',
              },
            },
            required: ['model', 'query'],
            additionalProperties: false,
          },
        },
      ];

      (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);

      const factory = await createFunctionFactory(mockContext, ['perplexity.perplexitySearch']);

      expect(factory).toHaveProperty('perplexity_perplexitySearch');
      expect(factory['perplexity_perplexitySearch']).toMatchObject({
        description: 'Perform a search using the Perplexity API',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query',
            },
            model: {
              type: 'string',
              description: 'The Perplexity model to use for the search',
            },
          },
          required: ['model', 'query'],
          additionalProperties: false,
        },
      });
      expect(typeof factory['perplexity_perplexitySearch'].function).toBe('function');

      // Verify that only the allowed action is loaded
      expect(Object.keys(factory)).toHaveLength(1);
      expect(Object.keys(factory)[0]).toBe('perplexity_perplexitySearch');
    });
  });

  describe('executeFunctionCall', () => {
    it('should execute the correct function', async () => {
      const mockActions = [
        {
          id: 'photoroom.removeBackground',
          serviceName: 'PhotoRoom',
          actionTitle: 'Remove Background',
          description: 'Remove the background from an image using PhotoRoom API',
          icon: 'image',
          service: 'photoroom',
          parameters: mockFunctionDefinition.parameters,
        },
      ];

      (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);

      const result = await executeFunctionCall(
        { function: { name: 'photoroom.removeBackground', arguments: '{"imageUrl": "http://example.com/image.jpg"}' } },
        'test-session',
        'test-company',
        ['photoroom.removeBackground']
      );

      expect(result).toBeDefined();
    });

    it('should throw an error for non-existent functions', async () => {
      const mockActions: any[] = [];
      (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);

      await expect(executeFunctionCall(
        { function: { name: 'nonExistentFunction', arguments: '{}' } },
        'test-session',
        'test-company',
        ['nonExistentFunction']
      )).rejects.toThrow('Function nonExistentFunction not implemented in the factory');
    });
  });

  describe('sanitizeFunctionName', () => {
    it('should return the same name when input contains only alphanumeric characters', () => {
      const input = 'validFunctionName';
      const result = sanitizeFunctionName(input);
      expect(result).toBe('validFunctionName');
    });

    it('should replace special characters with underscores', () => {
      const input = 'invalid-function$name!';
      const result = sanitizeFunctionName(input);
      expect(result).toBe('invalid_function_name');
    });

    it('should replace spaces with underscores', () => {
      const input = 'function name with spaces';
      const result = sanitizeFunctionName(input);
      expect(result).toBe('function_name_with_spaces');
    });

    it('should return an empty string when input is empty', () => {
      const input = '';
      const result = sanitizeFunctionName(input);
      expect(result).toBe('');
    });

    it('should handle non-ASCII characters correctly', () => {
      const input = 'função-ñame';
      const result = sanitizeFunctionName(input);
      expect(result).toBe('funcao_name');
    });

    it('should remove leading and trailing underscores', () => {
      const input = '_function_name_';
      const result = sanitizeFunctionName(input);
      expect(result).toBe('function_name');
    });
  });
});