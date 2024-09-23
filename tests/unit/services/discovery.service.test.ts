import { discoveryService } from '../../../src/integrations/discovery.service';
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');

describe('Discovery Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (fs.readdirSync as jest.Mock).mockReturnValue(['testIntegration']);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  const mockConfig = {
    name: 'Test Integration',
    icon: 'test-icon',
    apiKeyName: 'test_api_key',
    actionCreator: 'createTestActions',
    actionsFile: 'test.actions.ts'
  };

  const mockActions = {
    createTestActions: () => ({
      testAction: {
        description: 'Test action description',
        parameters: {
          type: 'object',
          properties: {
            testParam: {
              type: 'string',
              description: 'A test parameter'
            }
          },
          required: ['testParam']
        },
        function: jest.fn()
      }
    })
  };

  const mockTranslations = {
    serviceName: 'Test Service',
    testAction: {
      actionTitle: 'Test Action Title',
      description: 'Translated test action description'
    }
  };

  it('should discover actions from integrations', async () => {
    jest.mock('../../../src/integrations/testIntegration/integration.config.json', () => mockConfig, { virtual: true });
    jest.mock('../../../src/integrations/testIntegration/test.actions.ts', () => mockActions, { virtual: true });
    jest.mock('../../../src/integrations/testIntegration/translations/en.json', () => mockTranslations, { virtual: true });

    const actions = await discoveryService.discoverActions();

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      id: 'testIntegration.testAction',
      serviceName: 'Test Service',
      actionTitle: 'Test Action Title',
      description: 'Translated test action description',
      icon: 'test-icon',
      service: 'testIntegration',
      parameters: mockActions.createTestActions().testAction.parameters
    });
  });

  it('should handle missing translations', async () => {
    jest.mock('../../../src/integrations/testIntegration/integration.config.json', () => mockConfig, { virtual: true });
    jest.mock('../../../src/integrations/testIntegration/test.actions.ts', () => mockActions, { virtual: true });
    (fs.existsSync as jest.Mock).mockImplementation((path) => !path.includes('translations'));

    const actions = await discoveryService.discoverActions();

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      id: 'testIntegration.testAction',
      serviceName: 'Test Integration',
      actionTitle: 'testAction',
      description: 'Test action description',
      icon: 'test-icon',
      service: 'testIntegration',
      parameters: mockActions.createTestActions().testAction.parameters
    });
  });

  it('should handle errors when loading integration config', async () => {
    (fs.existsSync as jest.Mock).mockImplementation((path) => !path.includes('integration.config.json'));

    const actions = await discoveryService.discoverActions();

    expect(actions).toHaveLength(0);
  });

  it('should handle errors when loading actions file', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    jest.mock('../../../src/integrations/testIntegration/integration.config.json', () => mockConfig, { virtual: true });
    jest.doMock('../../../src/integrations/testIntegration/test.actions.ts', () => {
      throw new Error('Failed to load actions file');
    }, { virtual: true });

    // Clear the module cache to ensure our mock is used
    jest.resetModules();

    const actions = await discoveryService.discoverActions();

    expect(actions).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to process'),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});