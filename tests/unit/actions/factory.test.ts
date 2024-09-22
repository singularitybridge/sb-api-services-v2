import { createFunctionFactory, executeFunctionCall } from '../../../src/actions/factory';
import { ActionContext, FunctionFactory, FunctionDefinition } from '../../../src/actions/types';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');
jest.mock('../../../src/services/template.service', () => ({
  processTemplate: jest.fn((template) => Promise.resolve(template)),
}));

describe('Action Factory', () => {
  const mockContext: ActionContext = { sessionId: 'test-session', companyId: 'test-company' };

  beforeEach(() => {
    jest.resetAllMocks();
    (fs.readdirSync as jest.Mock).mockReturnValue(['photoroom']);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  const mockFunctionDefinition: FunctionDefinition = {
    description: 'Remove the background from an image',
    parameters: {
      type: 'object',
      properties: {
        imageUrl: {
          type: 'string',
          description: 'URL of the image to process',
        },
      },
      required: ['imageUrl'],
    },
    function: jest.fn(),
  };

  describe('createFunctionFactory', () => {
    it('should load actions from integrations', async () => {
      const mockConfig = {
        name: 'PhotoRoom',
        icon: 'image',
        apiKeyName: 'photoroom_api_key',
        actionCreator: 'createPhotoRoomActions',
        actionsFile: 'photoroom.actions.ts'
      };
      jest.mock('../../../src/integrations/photoroom/integration.config.json', () => mockConfig, { virtual: true });

      const mockActions = {
        createPhotoRoomActions: () => ({
          removeBackground: mockFunctionDefinition
        })
      };
      jest.mock('../../../src/integrations/photoroom/photoroom.actions.ts', () => mockActions, { virtual: true });

      const factory = await createFunctionFactory(mockContext, ['photoroom.removeBackground']);

      expect(factory).toHaveProperty('photoroom.removeBackground');
      expect(factory['photoroom.removeBackground']).toEqual(mockFunctionDefinition);
    });

    it('should filter actions based on allowed actions', async () => {
      const mockConfig = {
        name: 'PhotoRoom',
        icon: 'image',
        apiKeyName: 'photoroom_api_key',
        actionCreator: 'createPhotoRoomActions',
        actionsFile: 'photoroom.actions.ts'
      };
      jest.mock('../../../src/integrations/photoroom/integration.config.json', () => mockConfig, { virtual: true });

      const mockActions = {
        createPhotoRoomActions: () => ({
          removeBackground: mockFunctionDefinition,
          anotherAction: { ...mockFunctionDefinition, description: 'Another action' }
        })
      };
      jest.mock('../../../src/integrations/photoroom/photoroom.actions.ts', () => mockActions, { virtual: true });

      const factory = await createFunctionFactory(mockContext, ['photoroom.removeBackground']);

      expect(factory).toHaveProperty('photoroom.removeBackground');
      expect(factory).not.toHaveProperty('photoroom.anotherAction');
    });
  });

  describe('executeFunctionCall', () => {
    it('should execute the correct function', async () => {
      const mockFunction = jest.fn().mockResolvedValue('test result');
      const mockFactory: FunctionFactory = {
        'photoroom.removeBackground': {
          ...mockFunctionDefinition,
          function: mockFunction,
        },
      };
      jest.spyOn(global, 'createFunctionFactory' as any).mockResolvedValue(mockFactory);

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
      jest.spyOn(global, 'createFunctionFactory' as any).mockResolvedValue({});

      await expect(executeFunctionCall(
        { function: { name: 'nonExistentFunction', arguments: '{}' } },
        'test-session',
        'test-company',
        ['nonExistentFunction']
      )).rejects.toThrow('Function nonExistentFunction not implemented in the factory');
    });
  });
});