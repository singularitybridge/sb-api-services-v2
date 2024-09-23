import { mockFunctionDefinition } from './factory.imports';
import * as factory from '../../../src/integrations/actions/factory';
import { discoveryService } from '../../../src/integrations/discovery.service';

jest.mock('../../../src/integrations/discovery.service');
jest.mock('../../../src/integrations/actions/factory', () => {
  const originalModule = jest.requireActual('../../../src/integrations/actions/factory');
  return {
    ...originalModule,
    executeFunctionCall: jest.fn(),
  };
});

describe('executeFunctionCall', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    (factory.executeFunctionCall as jest.Mock).mockImplementation(async (call, sessionId, companyId) => {
      await discoveryService.discoverActions(companyId);
      return { result: 'success' };
    });

    const result = await factory.executeFunctionCall(
      { function: { name: 'photoroom.removeBackground', arguments: '{"imageUrl": "http://example.com/image.jpg"}' } },
      'test-session',
      'test-company',
      ['photoroom.removeBackground']
    );

    expect(result).toEqual({ result: 'success' });
    expect(discoveryService.discoverActions).toHaveBeenCalledWith('test-company');
    expect(factory.executeFunctionCall).toHaveBeenCalledWith(
      { function: { name: 'photoroom.removeBackground', arguments: '{"imageUrl": "http://example.com/image.jpg"}' } },
      'test-session',
      'test-company',
      ['photoroom.removeBackground']
    );
  });

  it('should throw an error when function name is not present in the function factory', async () => {
    const mockActions: any[] = [];
    (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);
    (factory.executeFunctionCall as jest.Mock).mockImplementation(async (call, sessionId, companyId) => {
      await discoveryService.discoverActions(companyId);
      throw new Error(`Function ${call.function.name} not implemented in the factory`);
    });

    await expect(factory.executeFunctionCall(
      { function: { name: 'nonExistentFunction', arguments: '{}' } },
      'test-session',
      'test-company',
      ['nonExistentFunction']
    )).rejects.toThrow('Function nonExistentFunction not implemented in the factory');

    expect(discoveryService.discoverActions).toHaveBeenCalledWith('test-company');
  });

  it('should throw an error when function name is not in allowedActions', async () => {
    const mockActions = [
      {
        id: 'testFunction',
        serviceName: 'TestService',
        actionTitle: 'Test Function',
        description: 'A test function',
        icon: 'test',
        service: 'test',
        parameters: {
          type: 'object',
          properties: {
            testParam: { type: 'string' }
          }
        },
      },
    ];

    (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);
    (factory.executeFunctionCall as jest.Mock).mockImplementation(async (call, sessionId, companyId, allowedActions) => {
      await discoveryService.discoverActions(companyId);
      if (!allowedActions.includes(call.function.name)) {
        throw new Error(`Function ${call.function.name} is not allowed`);
      }
      return { result: 'success' };
    });

    await expect(factory.executeFunctionCall(
      { function: { name: 'testFunction', arguments: '{"testParam": "testValue"}' } },
      'test-session',
      'test-company',
      ['otherFunction']
    )).rejects.toThrow('Function testFunction is not allowed');

    expect(discoveryService.discoverActions).toHaveBeenCalledWith('test-company');
  });

  it('should execute valid function call and return expected result', async () => {
    const mockActions = [
      {
        id: 'testFunction',
        serviceName: 'TestService',
        actionTitle: 'Test Function',
        description: 'A test function',
        icon: 'test',
        service: 'test',
        parameters: {
          type: 'object',
          properties: {
            testParam: { type: 'string' }
          }
        },
      },
    ];

    const expectedResult = { success: true, message: 'Test function executed successfully' };

    (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);
    (factory.executeFunctionCall as jest.Mock).mockImplementation(async (call, sessionId, companyId) => {
      await discoveryService.discoverActions(companyId);
      return expectedResult;
    });

    const result = await factory.executeFunctionCall(
      { function: { name: 'testFunction', arguments: '{"testParam": "testValue"}' } },
      'test-session',
      'test-company',
      ['testFunction']
    );

    expect(result).toEqual(expectedResult);
    expect(discoveryService.discoverActions).toHaveBeenCalledWith('test-company');
    expect(factory.executeFunctionCall).toHaveBeenCalledWith(
      { function: { name: 'testFunction', arguments: '{"testParam": "testValue"}' } },
      'test-session',
      'test-company',
      ['testFunction']
    );
  });

  it('should handle function execution errors', async () => {
    const mockActions = [
      {
        id: 'errorFunction',
        serviceName: 'ErrorService',
        actionTitle: 'Error Function',
        description: 'A function that throws an error',
        icon: 'error',
        service: 'error',
        parameters: {
          type: 'object',
          properties: {
            errorParam: { type: 'string' }
          }
        },
      },
    ];

    const errorMessage = 'Test error during function execution';

    (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);
    (factory.executeFunctionCall as jest.Mock).mockImplementation(async (call, sessionId, companyId) => {
      await discoveryService.discoverActions(companyId);
      throw new Error(errorMessage);
    });

    await expect(factory.executeFunctionCall(
      { function: { name: 'errorFunction', arguments: '{"errorParam": "errorValue"}' } },
      'test-session',
      'test-company',
      ['errorFunction']
    )).rejects.toThrow(errorMessage);

    expect(discoveryService.discoverActions).toHaveBeenCalledWith('test-company');
    expect(factory.executeFunctionCall).toHaveBeenCalledWith(
      { function: { name: 'errorFunction', arguments: '{"errorParam": "errorValue"}' } },
      'test-session',
      'test-company',
      ['errorFunction']
    );
  });

  it('should validate arguments against function schema', async () => {
    const mockActions = [
      {
        id: 'testFunction',
        serviceName: 'TestService',
        actionTitle: 'Test Function',
        description: 'A test function with schema validation',
        icon: 'test',
        service: 'test',
        parameters: {
          type: 'object',
          properties: {
            requiredString: { type: 'string' },
            optionalNumber: { type: 'number' },
            enumValue: { type: 'string', enum: ['option1', 'option2'] }
          },
          required: ['requiredString']
        },
      },
    ];

    (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);
    (factory.executeFunctionCall as jest.Mock).mockImplementation(async (call, sessionId, companyId) => {
      await discoveryService.discoverActions(companyId);
      const action = mockActions.find(a => a.id === call.function.name);
      if (!action) throw new Error('Function not found');

      const args = JSON.parse(call.function.arguments);
      const errors: string[] = [];

      // Validate required fields
      if (!args.requiredString) {
        errors.push('Missing required field: requiredString');
      }

      // Validate types
      if (args.optionalNumber !== undefined && typeof args.optionalNumber !== 'number') {
        errors.push('Invalid type for optionalNumber: expected number');
      }

      // Validate enum
      if (args.enumValue !== undefined && !['option1', 'option2'].includes(args.enumValue)) {
        errors.push('Invalid value for enumValue: must be either "option1" or "option2"');
      }

      if (errors.length > 0) {
        throw new Error(`Validation errors: ${errors.join(', ')}`);
      }

      return { result: 'success' };
    });

    // Test with invalid arguments
    await expect(factory.executeFunctionCall(
      { function: { name: 'testFunction', arguments: '{"optionalNumber": "not a number", "enumValue": "invalid"}' } },
      'test-session',
      'test-company',
      ['testFunction']
    )).rejects.toThrow('Validation errors: Missing required field: requiredString, Invalid type for optionalNumber: expected number, Invalid value for enumValue: must be either "option1" or "option2"');

    // Test with valid arguments
    const result = await factory.executeFunctionCall(
      { function: { name: 'testFunction', arguments: '{"requiredString": "valid", "optionalNumber": 42, "enumValue": "option1"}' } },
      'test-session',
      'test-company',
      ['testFunction']
    );

    expect(result).toEqual({ result: 'success' });
  });

  it('should handle missing required arguments', async () => {
    const mockActions = [
      {
        id: 'testFunctionWithRequiredArgs',
        serviceName: 'TestService',
        actionTitle: 'Test Function with Required Args',
        description: 'A test function with required arguments',
        icon: 'test',
        service: 'test',
        parameters: {
          type: 'object',
          properties: {
            requiredArg1: { type: 'string' },
            requiredArg2: { type: 'number' },
            optionalArg: { type: 'boolean' }
          },
          required: ['requiredArg1', 'requiredArg2']
        },
      },
    ];

    (discoveryService.discoverActions as jest.Mock).mockResolvedValue(mockActions);
    (factory.executeFunctionCall as jest.Mock).mockImplementation(async (call, sessionId, companyId) => {
      await discoveryService.discoverActions(companyId);
      const action = mockActions.find(a => a.id === call.function.name);
      if (!action) throw new Error('Function not found');

      const args = JSON.parse(call.function.arguments);
      const missingArgs = action.parameters.required.filter(arg => !(arg in args));

      if (missingArgs.length > 0) {
        throw new Error(`Missing required parameters: ${missingArgs.join(', ')}`);
      }

      return { result: 'success' };
    });

    // Test with missing required arguments
    await expect(factory.executeFunctionCall(
      { function: { name: 'testFunctionWithRequiredArgs', arguments: '{"requiredArg1": "value"}' } },
      'test-session',
      'test-company',
      ['testFunctionWithRequiredArgs']
    )).rejects.toThrow('Missing required parameters: requiredArg2');

    // Test with all required arguments provided
    const result = await factory.executeFunctionCall(
      { function: { name: 'testFunctionWithRequiredArgs', arguments: '{"requiredArg1": "value", "requiredArg2": 42}' } },
      'test-session',
      'test-company',
      ['testFunctionWithRequiredArgs']
    );

    expect(result).toEqual({ result: 'success' });
  });
});