import mongoose from 'mongoose';
import { createFunctionFactory } from '../../../src/integrations/actions/loaders';
import { ActionContext, FunctionFactory } from '../../../src/integrations/actions/types';
import * as utils from '../../../src/integrations/actions/utils';

jest.mock('../../../src/integrations/actions/utils', () => ({
  getIntegrationFolders: jest.fn(),
  loadConfig: jest.fn(),
  createPrefixedActions: jest.fn(),
  filterAllowedActions: jest.fn(),
}));

describe('createFunctionFactory', () => {
  const mockSessionId = new mongoose.Types.ObjectId().toHexString();
  const mockCompanyId = new mongoose.Types.ObjectId().toHexString();
  const mockContext: ActionContext = {
    sessionId: mockSessionId,
    companyId: mockCompanyId,
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
    (utils.getIntegrationFolders as jest.Mock).mockReturnValue(['integration1']);
    (utils.loadConfig as jest.Mock).mockReturnValue({ name: 'integration1', actionsFile: 'actions.ts' });
    (utils.createPrefixedActions as jest.Mock).mockReturnValue(mockActions);
    (utils.filterAllowedActions as jest.Mock).mockImplementation((actions, allowed) => {
      if (allowed.length === 0) return actions;
      return Object.fromEntries(
        Object.entries(actions).filter(([key]) => allowed.includes(key))
      );
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should create a function factory with allowed actions', async () => {
    const mockAllowedActions = ['action1', 'action2'];

    const factory = await createFunctionFactory(mockContext, mockAllowedActions);

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
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (utils.loadConfig as jest.Mock).mockReturnValue(null); // Simulate a failed config load

    const factory = await createFunctionFactory(mockContext, []);

    expect(factory).toEqual({});
    expect(console.error).not.toHaveBeenCalled(); // Error logging is done in loadActionModule, which we're not reaching
  });
});