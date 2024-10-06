import mongoose from 'mongoose';
import * as factoryModule from '../../../src/integrations/actions/loaders';
import { executeFunctionCall } from '../../../src/integrations/actions/executors';
import { processTemplate } from '../../../src/services/template.service';
import { ActionContext, FunctionFactory, FunctionDefinition } from '../../../src/integrations/actions/types';
import * as integrationService from '../../../src/services/integration.service';
import * as publishersModule from '../../../src/integrations/actions/publishers';

// Mock the template service
jest.mock('../../../src/services/template.service', () => ({
  processTemplate: jest.fn(),
}));

// Mock the session service
jest.mock('../../../src/services/session.service', () => ({
  getSessionById: jest.fn().mockResolvedValue({ 
    id: 'mockSessionId',
    userId: 'mockUserId',
    companyId: 'mockCompanyId',
    language: 'en',
  }),
}));

// Mock the integration service
jest.mock('../../../src/services/integration.service', () => ({
  discoverActionById: jest.fn(),
}));

// Mock the publishers module
jest.mock('../../../src/integrations/actions/publishers', () => ({
  publishActionMessage: jest.fn(),
}));

describe('executeFunctionCall', () => {
  const mockSessionId = new mongoose.Types.ObjectId().toHexString();
  const mockCompanyId = new mongoose.Types.ObjectId().toHexString();
  const mockAllowedActions = ['testAction', 'errorAction'];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(factoryModule, 'createFunctionFactory').mockImplementation(jest.fn());
    (integrationService.discoverActionById as jest.Mock).mockResolvedValue({
      id: 'testAction',
      serviceName: 'Mock Service',
      actionTitle: 'Test Action',
      description: 'Mock action description',
      icon: 'mock-icon',
      service: 'mock-service',
      parameters: {},
    });
    (publishersModule.publishActionMessage as jest.Mock).mockResolvedValue(undefined);
  });

  it('should execute a function call successfully', async () => {
    const mockCall = {
      function: {
        name: 'testAction',
        arguments: JSON.stringify({ param1: 'value1' }),
      },
    };

    const mockFunctionFactory: FunctionFactory = {
      testAction: {
        description: 'Test action',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
          },
          required: ['param1'],
        },
        function: jest.fn().mockResolvedValue('Test result'),
      } as FunctionDefinition,
    };

    (factoryModule.createFunctionFactory as jest.Mock).mockResolvedValue(mockFunctionFactory);
    (processTemplate as jest.Mock).mockImplementation((value) => Promise.resolve(value));

    const result = await executeFunctionCall(mockCall, mockSessionId, mockCompanyId, mockAllowedActions);

    expect(factoryModule.createFunctionFactory).toHaveBeenCalledWith(
      expect.objectContaining<ActionContext>({ sessionId: mockSessionId, companyId: mockCompanyId }),
      mockAllowedActions
    );
    expect(processTemplate).toHaveBeenCalledWith('value1', mockSessionId);
    expect(mockFunctionFactory.testAction.function).toHaveBeenCalledWith({ param1: 'value1' });
    expect(integrationService.discoverActionById).toHaveBeenCalledWith('testAction', 'en');
    expect(publishersModule.publishActionMessage).toHaveBeenCalled();
    expect(result).toEqual({ result: 'Test result' });
  }, 10000);

  it('should handle errors during function execution', async () => {
    const mockCall = {
      function: {
        name: 'errorAction',
        arguments: JSON.stringify({ param1: 'value1' }),
      },
    };

    const mockError = new Error('Test error');
    const mockFunctionFactory: FunctionFactory = {
      errorAction: {
        description: 'Error action',
        parameters: {
          type: 'object',
          properties: {
            param1: { type: 'string' },
          },
          required: ['param1'],
        },
        function: jest.fn().mockRejectedValue(mockError),
      } as FunctionDefinition,
    };

    (factoryModule.createFunctionFactory as jest.Mock).mockResolvedValue(mockFunctionFactory);
    (processTemplate as jest.Mock).mockImplementation((value) => Promise.resolve(value));

    const result = await executeFunctionCall(mockCall, mockSessionId, mockCompanyId, mockAllowedActions);

    expect(factoryModule.createFunctionFactory).toHaveBeenCalledWith(
      expect.objectContaining<ActionContext>({ sessionId: mockSessionId, companyId: mockCompanyId }),
      mockAllowedActions
    );
    expect(processTemplate).toHaveBeenCalledWith('value1', mockSessionId);
    expect(mockFunctionFactory.errorAction.function).toHaveBeenCalledWith({ param1: 'value1' });
    expect(integrationService.discoverActionById).toHaveBeenCalledWith('errorAction', 'en');
    expect(publishersModule.publishActionMessage).toHaveBeenCalled();
    expect(result).toEqual({
      error: expect.objectContaining({
        message: 'Test error',
        name: 'Error',
        stack: expect.any(String),
      }),
    });
  }, 10000);

  it('should return an error for non-existent functions', async () => {
    const mockCall = {
      function: {
        name: 'nonExistentAction',
        arguments: JSON.stringify({}),
      },
    };

    const mockFunctionFactory: FunctionFactory = {};

    (factoryModule.createFunctionFactory as jest.Mock).mockResolvedValue(mockFunctionFactory);

    const result = await executeFunctionCall(mockCall, mockSessionId, mockCompanyId, mockAllowedActions);

    expect(factoryModule.createFunctionFactory).toHaveBeenCalledWith(
      expect.objectContaining<ActionContext>({ sessionId: mockSessionId, companyId: mockCompanyId }),
      mockAllowedActions
    );
    // Removed the expectation for discoverActionById as it's not called for non-existent functions
    expect(result).toEqual({
      error: { message: 'Function nonExistentAction not implemented in the factory' },
    });
  }, 10000);
});