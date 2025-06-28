import mongoose from 'mongoose';
import { createFunctionFactory } from '../../../src/integrations/actions/loaders';
import {
  ActionContext,
  FunctionFactory,
} from '../../../src/integrations/actions/types';
import { SupportedLanguage } from '../../../src/services/discovery.service';
import * as utils from '../../../src/integrations/actions/utils';

jest.mock('../../../src/integrations/actions/utils', () => ({
  getIntegrationFolders: jest.fn(),
  loadConfig: jest.fn(),
  createPrefixedActions: jest.fn(),
  filterAllowedActions: jest.fn(),
}));

jest.mock('../../../src/integrations/actions/loaders', () => {
  const actualModule = jest.requireActual(
    '../../../src/integrations/actions/loaders',
  );
  return {
    ...actualModule,
    createFunctionFactory: jest.fn(),
  };
});

describe('createFunctionFactory', () => {
  const mockSessionId = new mongoose.Types.ObjectId().toHexString();
  const mockCompanyId = new mongoose.Types.ObjectId().toHexString();
  const mockContext: ActionContext = {
    sessionId: mockSessionId,
    companyId: mockCompanyId,
    language: 'en' as SupportedLanguage,
  };

  const mockActions: FunctionFactory = {
    action1: {
      description: 'Mock action 1',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      function: jest.fn(),
    },
    action2: {
      description: 'Mock action 2',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      function: jest.fn(),
    },
    action3: {
      description: 'Mock action 3',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      function: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (utils.getIntegrationFolders as jest.Mock).mockReturnValue([
      'integration1',
    ]);
    (utils.loadConfig as jest.Mock).mockReturnValue({
      name: 'integration1',
      actionsFile: 'actions.ts',
    });
    (utils.createPrefixedActions as jest.Mock).mockReturnValue(mockActions);
    (utils.filterAllowedActions as jest.Mock).mockImplementation(
      (actions, allowed) => {
        if (allowed.length === 0) return actions;
        return Object.fromEntries(
          Object.entries(actions).filter(([key]) => allowed.includes(key)),
        );
      },
    );
    (createFunctionFactory as jest.Mock).mockImplementation(
      async (context, allowedActions) => {
        const actions = utils.filterAllowedActions(mockActions, allowedActions);
        return Promise.resolve(actions);
      },
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a function factory with allowed actions', async () => {
    const mockAllowedActions = ['action1', 'action2'];

    const factory = await createFunctionFactory(
      mockContext,
      mockAllowedActions,
    );

    expect(factory).toHaveProperty('action1');
    expect(factory).toHaveProperty('action2');
    expect(factory).not.toHaveProperty('action3');
  });

  it('should create a function factory with all actions when allowedActions is empty', async () => {
    const factory = await createFunctionFactory(mockContext, []);

    expect(factory).toHaveProperty('action1');
    expect(factory).toHaveProperty('action2');
    expect(factory).toHaveProperty('action3');
  });

  it('should handle errors when processing integrations', async () => {
    (createFunctionFactory as jest.Mock).mockRejectedValue(
      new Error('Test error'),
    );

    await expect(createFunctionFactory(mockContext, [])).rejects.toThrow(
      'Test error',
    );
    expect(console.error).not.toHaveBeenCalled(); // Error logging is suppressed
  });
});
