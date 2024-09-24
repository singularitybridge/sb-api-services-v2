import { mockContext, mockFunctionDefinition } from './factory.imports';
import { createFunctionFactory } from '../../../src/integrations/actions/factory';
import { discoveryService } from '../../../src/integrations/discovery.service';

jest.mock('../../../src/integrations/discovery.service');

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

  it('should handle empty allowed actions', async () => {
    const mockActions = [
      {
        id: 'someAction.action',
        serviceName: 'SomeService',
        actionTitle: 'Some Action',
        description: 'Description of some action',
        icon: 'icon',
        service: 'someService',
        parameters: {},
      },
    ];

    (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);

    const factory = await createFunctionFactory(mockContext, []);

    expect(factory).toEqual({});
    expect(Object.keys(factory)).toHaveLength(0);
  });
});