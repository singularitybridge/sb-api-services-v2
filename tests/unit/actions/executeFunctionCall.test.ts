import { executeFunctionCall, createFunctionFactory } from '../../../src/integrations/actions/factory';
import { processTemplate } from '../../../src/services/template.service';
import { ActionContext, FunctionFactory, FunctionDefinition } from '../../../src/integrations/actions/types';

jest.mock('../../../src/integrations/actions/factory', () => ({
  ...jest.requireActual('../../../src/integrations/actions/factory'),
  createFunctionFactory: jest.fn(),
}));

jest.mock('../../../src/services/template.service', () => ({
  processTemplate: jest.fn(),
}));

describe('executeFunctionCall', () => {
  const mockSessionId = 'testSession';
  const mockCompanyId = 'testCompany';
  const mockAllowedActions = ['testAction'];

  beforeEach(() => {
    jest.clearAllMocks();
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

    (createFunctionFactory as jest.Mock).mockResolvedValue(mockFunctionFactory);
    (processTemplate as jest.Mock).mockImplementation((value) => Promise.resolve(value));

    const result = await executeFunctionCall(mockCall, mockSessionId, mockCompanyId, mockAllowedActions);

    expect(createFunctionFactory).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: mockSessionId, companyId: mockCompanyId }),
      mockAllowedActions
    );
    expect(processTemplate).toHaveBeenCalledWith('value1', mockSessionId);
    expect(mockFunctionFactory.testAction.function).toHaveBeenCalledWith({ param1: 'value1' });
    expect(result).toEqual({ result: 'Test result' });
  });

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

    (createFunctionFactory as jest.Mock).mockResolvedValue(mockFunctionFactory);
    (processTemplate as jest.Mock).mockImplementation((value) => Promise.resolve(value));

    const result = await executeFunctionCall(mockCall, mockSessionId, mockCompanyId, mockAllowedActions);

    expect(createFunctionFactory).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: mockSessionId, companyId: mockCompanyId }),
      mockAllowedActions
    );
    expect(processTemplate).toHaveBeenCalledWith('value1', mockSessionId);
    expect(mockFunctionFactory.errorAction.function).toHaveBeenCalledWith({ param1: 'value1' });
    expect(result).toEqual({
      error: expect.objectContaining({
        message: 'Test error',
        name: 'Error',
        stack: expect.any(String),
      }),
    });
  });

  it('should return an error for non-existent functions', async () => {
    const mockCall = {
      function: {
        name: 'nonExistentAction',
        arguments: JSON.stringify({}),
      },
    };

    const mockFunctionFactory: FunctionFactory = {};

    (createFunctionFactory as jest.Mock).mockResolvedValue(mockFunctionFactory);

    const result = await executeFunctionCall(mockCall, mockSessionId, mockCompanyId, mockAllowedActions);

    expect(createFunctionFactory).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: mockSessionId, companyId: mockCompanyId }),
      mockAllowedActions
    );
    expect(result).toEqual({
      error: { message: 'Function nonExistentAction not implemented in the factory' },
    });
  });
});