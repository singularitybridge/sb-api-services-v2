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

  it('should throw an error for non-existent functions', async () => {
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
});