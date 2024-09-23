import * as fs from 'fs';
import * as path from 'path';
import { ActionContext, FunctionDefinition, FunctionFactory, sanitizeFunctionName, createFunctionFactory, executeFunctionCall } from '../../../src/integrations/actions/factory';
import { discoveryService } from '../../../src/integrations/discovery.service';

jest.mock('fs');
jest.mock('path');
jest.mock('../../../src/integrations/discovery.service');
jest.mock('../../../src/services/template.service', () => ({
  processTemplate: jest.fn((template) => Promise.resolve(template)),
}));

export const mockContext: ActionContext = { sessionId: 'test-session', companyId: 'test-company' };

export const mockFunctionDefinition: FunctionDefinition = {
  description: 'Remove the background from an image using PhotoRoom API',
  parameters: {
    type: 'object',
    properties: {
      imageUrl: {
        type: 'string',
        description: 'The URL of the image to process',
      },
    },
    required: ['imageUrl'],
    additionalProperties: false,
  },
  function: jest.fn(),
};

beforeEach(() => {
  jest.resetAllMocks();
  (fs.readdirSync as jest.Mock).mockReturnValue(['photoroom', 'perplexity']);
  (fs.existsSync as jest.Mock).mockReturnValue(true);
  (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
});