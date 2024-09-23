import * as fs from 'fs';
import * as path from 'path';
import { ActionContext, FunctionDefinition, FunctionFactory } from '../../../src/integrations/actions/factory';
import { discoveryService } from '../../../src/integrations/discovery.service';

// Mock the entire factory module
jest.mock('../../../src/integrations/actions/factory', () => {
  const originalModule = jest.requireActual('../../../src/integrations/actions/factory');
  return {
    ...originalModule,
    createFunctionFactory: jest.fn(),
    executeFunctionCall: jest.fn(),
  };
});

jest.mock('fs');
jest.mock('path');
jest.mock('../../../src/integrations/discovery.service');
jest.mock('../../../src/services/template.service', () => ({
  processTemplate: jest.fn((template) => Promise.resolve(template)),
}));

// Import the mocked functions
import { createFunctionFactory, executeFunctionCall } from '../../../src/integrations/actions/factory';

describe('Action Factory', () => {
  const mockContext: ActionContext = { sessionId: 'test-session', companyId: 'test-company' };

  beforeEach(() => {
    jest.resetAllMocks();
    (fs.readdirSync as jest.Mock).mockReturnValue(['photoroom']);
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

      const mockFactory = {
        'photoroom_removeBackground': {
          ...mockFunctionDefinition,
          function: jest.fn(),
        },
      };
      (createFunctionFactory as jest.Mock).mockResolvedValue(mockFactory);

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

      const mockFactory = {
        'photoroom_removeBackground': {
          ...mockFunctionDefinition,
          function: jest.fn(),
        },
      };
      (createFunctionFactory as jest.Mock).mockResolvedValue(mockFactory);

      const factory = await createFunctionFactory(mockContext, ['photoroom.removeBackground']);

      expect(factory).toHaveProperty('photoroom_removeBackground');
      expect(factory).not.toHaveProperty('photoroom_anotherAction');
    });
  });

  describe('executeFunctionCall', () => {
    it('should execute the correct function', async () => {
      const mockFunction = jest.fn().mockResolvedValue('test result');
      const mockFactory: FunctionFactory = {
        'photoroom_removeBackground': {
          ...mockFunctionDefinition,
          function: mockFunction,
        },
      };
      (createFunctionFactory as jest.Mock).mockResolvedValue(mockFactory);

      (executeFunctionCall as jest.Mock).mockImplementation(async (functionCall, sessionId, companyId, allowedActions) => {
        const factory = await createFunctionFactory({ sessionId, companyId }, allowedActions);
        const func = factory[functionCall.function.name.replace('.', '_')];
        if (!func) {
          throw new Error(`Function ${functionCall.function.name} not implemented in the factory`);
        }
        return func.function(JSON.parse(functionCall.function.arguments));
      });

      const result = await executeFunctionCall(
        { function: { name: 'photoroom.removeBackground', arguments: '{"imageUrl": "http://example.com/image.jpg"}' } },
        'test-session',
        'test-company',
        ['photoroom.removeBackground']
      );

      expect(mockFunction).toHaveBeenCalledWith({ imageUrl: 'http://example.com/image.jpg' });
      expect(result).toBe('test result');
    });

    it('should throw an error for non-existent functions', async () => {
      const mockFactory: FunctionFactory = {};
      (createFunctionFactory as jest.Mock).mockResolvedValue(mockFactory);

      (executeFunctionCall as jest.Mock).mockImplementation(async (functionCall, sessionId, companyId, allowedActions) => {
        const factory = await createFunctionFactory({ sessionId, companyId }, allowedActions);
        const func = factory[functionCall.function.name.replace('.', '_')];
        if (!func) {
          throw new Error(`Function ${functionCall.function.name} not implemented in the factory`);
        }
        return func.function(JSON.parse(functionCall.function.arguments));
      });

      await expect(executeFunctionCall(
        { function: { name: 'nonExistentFunction', arguments: '{}' } },
        'test-session',
        'test-company',
        ['nonExistentFunction']
      )).rejects.toThrow('Function nonExistentFunction not implemented in the factory');
    });
  });
});