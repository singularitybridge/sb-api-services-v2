import { discoveryService, SupportedLanguage } from '../../../src/integrations/discovery.service';
import fs from 'fs';
import path from 'path';

jest.mock('fs');
jest.mock('path');

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
  en: {
    serviceName: 'Test Service',
    testAction: {
      actionTitle: 'Test Action Title',
      description: 'Translated test action description'
    }
  },
  he: {
    serviceName: 'שירות בדיקה',
    testAction: {
      actionTitle: 'כותרת פעולת בדיקה',
      description: 'תיאור פעולת בדיקה מתורגם'
    }
  }
};

describe('Discovery Service', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (fs.readdirSync as jest.Mock).mockReturnValue(['testIntegration']);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
  });

  const setupMocks = (language: 'en' | 'he' = 'en') => {
    jest.mock('../../../src/integrations/testIntegration/integration.config.json', () => mockConfig, { virtual: true });
    jest.mock('../../../src/integrations/testIntegration/test.actions.ts', () => mockActions, { virtual: true });
    jest.mock(`../../../src/integrations/testIntegration/translations/${language}.json`, () => mockTranslations[language], { virtual: true });
  };

  describe('Basic functionality', () => {
    it('should discover actions with valid integrations and default language', async () => {
      setupMocks();
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
  });

  describe('Error handling', () => {
    it('should handle missing translations', async () => {
      setupMocks();
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

    it('should handle unsupported language', async () => {
      setupMocks();
      (fs.existsSync as jest.Mock).mockImplementation((path) => !path.includes('fr.json'));

      const actions = await discoveryService.discoverActions('fr' as SupportedLanguage);

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

  describe('Multiple integrations', () => {
    it('should discover actions with multiple integrations', async () => {
      const mockConfigAnother = {
        name: 'Another Integration',
        icon: 'another-icon',
        apiKeyName: 'another_api_key',
        actionCreator: 'createAnotherActions',
        actionsFile: 'another.actions.ts'
      };

      const mockActionsAnother = {
        createAnotherActions: () => ({
          anotherAction: {
            description: 'Another action description',
            parameters: {
              type: 'object',
              properties: {
                anotherParam: {
                  type: 'string',
                  description: 'Another parameter'
                }
              },
              required: ['anotherParam']
            },
            function: jest.fn()
          }
        })
      };

      const mockTranslationsAnother = {
        serviceName: 'Another Service',
        anotherAction: {
          actionTitle: 'Another Action Title',
          description: 'Translated another action description'
        }
      };

      (fs.readdirSync as jest.Mock).mockReturnValue(['testIntegration', 'anotherIntegration']);
      setupMocks();
      jest.mock('../../../src/integrations/anotherIntegration/integration.config.json', () => mockConfigAnother, { virtual: true });
      jest.mock('../../../src/integrations/anotherIntegration/another.actions.ts', () => mockActionsAnother, { virtual: true });
      jest.mock('../../../src/integrations/anotherIntegration/translations/en.json', () => mockTranslationsAnother, { virtual: true });

      const actions = await discoveryService.discoverActions();

      expect(actions).toHaveLength(2);
      expect(actions[0]).toEqual({
        id: 'testIntegration.testAction',
        serviceName: 'Test Service',
        actionTitle: 'Test Action Title',
        description: 'Translated test action description',
        icon: 'test-icon',
        service: 'testIntegration',
        parameters: mockActions.createTestActions().testAction.parameters
      });
      expect(actions[1]).toEqual({
        id: 'anotherIntegration.anotherAction',
        serviceName: 'Another Service',
        actionTitle: 'Another Action Title',
        description: 'Translated another action description',
        icon: 'another-icon',
        service: 'anotherIntegration',
        parameters: mockActionsAnother.createAnotherActions().anotherAction.parameters
      });
    });
  });

  describe('Language support', () => {
    it('should discover actions with different supported languages', async () => {
      setupMocks('en');
      setupMocks('he');

      const actionsEn = await discoveryService.discoverActions('en');
      const actionsHe = await discoveryService.discoverActions('he');

      expect(actionsEn).toHaveLength(1);
      expect(actionsEn[0]).toEqual({
        id: 'testIntegration.testAction',
        serviceName: 'Test Service',
        actionTitle: 'Test Action Title',
        description: 'Translated test action description',
        icon: 'test-icon',
        service: 'testIntegration',
        parameters: mockActions.createTestActions().testAction.parameters
      });

      expect(actionsHe).toHaveLength(1);
      expect(actionsHe[0]).toEqual({
        id: 'testIntegration.testAction',
        serviceName: 'שירות בדיקה',
        actionTitle: 'כותרת פעולת בדיקה',
        description: 'תיאור פעולת בדיקה מתורגם',
        icon: 'test-icon',
        service: 'testIntegration',
        parameters: mockActions.createTestActions().testAction.parameters
      });
    });
  });
});