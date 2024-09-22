import { discoveryService } from '../../../src/integrations/discovery.service';
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');

describe('Discovery Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should discover actions from integrations', async () => {
    // Mock file system
    (fs.readdirSync as jest.Mock).mockReturnValue(['testIntegration']);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

    // Mock integration config
    const mockConfig = {
      name: 'Test Integration',
      icon: 'test-icon',
      apiKeyName: 'test_api_key',
      actionCreator: 'createTestActions',
      actionsFile: 'test.actions.ts'
    };
    jest.mock('../../../src/integrations/testIntegration/integration.config.json', () => mockConfig, { virtual: true });

    // Mock actions file
    const mockActions = {
      createTestActions: () => ({
        testAction: {
          description: 'Test action description',
          parameters: {},
          function: jest.fn()
        }
      })
    };
    jest.mock('../../../src/integrations/testIntegration/test.actions.ts', () => mockActions, { virtual: true });

    // Mock translations
    const mockTranslations = {
      serviceName: 'Test Service',
      testAction: {
        actionTitle: 'Test Action Title',
        description: 'Translated test action description'
      }
    };
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
      parameters: {}
    });
  });

  it('should handle missing translations', async () => {
    // Similar setup as above, but without translations
    (fs.readdirSync as jest.Mock).mockReturnValue(['testIntegration']);
    (fs.existsSync as jest.Mock).mockImplementation((path) => !path.includes('translations'));
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));

    const mockConfig = {
      name: 'Test Integration',
      icon: 'test-icon',
      apiKeyName: 'test_api_key',
      actionCreator: 'createTestActions',
      actionsFile: 'test.actions.ts'
    };
    jest.mock('../../../src/integrations/testIntegration/integration.config.json', () => mockConfig, { virtual: true });

    const mockActions = {
      createTestActions: () => ({
        testAction: {
          description: 'Test action description',
          parameters: {},
          function: jest.fn()
        }
      })
    };
    jest.mock('../../../src/integrations/testIntegration/test.actions.ts', () => mockActions, { virtual: true });

    const actions = await discoveryService.discoverActions();

    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual({
      id: 'testIntegration.testAction',
      serviceName: 'Test Integration',
      actionTitle: 'testAction',
      description: 'Test action description',
      icon: 'test-icon',
      service: 'testIntegration',
      parameters: {}
    });
  });

  // Add more tests as needed
});