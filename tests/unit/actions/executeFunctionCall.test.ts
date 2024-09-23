import { mockFunctionDefinition } from './factory.imports';
import { executeFunctionCall } from '../../../src/integrations/actions/factory';
import { discoveryService } from '../../../src/integrations/discovery.service';

jest.mock('../../../src/integrations/discovery.service');

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