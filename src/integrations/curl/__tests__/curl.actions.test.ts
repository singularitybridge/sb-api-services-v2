import { ActionContext, FunctionFactory } from '../../actions/types';
import { createCurlActions, CurlActionResponse } from '../curl.actions';

// Mock the context
const mockContext: ActionContext = {
  sessionId: 'test-session',
  companyId: 'test-company'
};

// Mock the curl service
jest.mock('../curl.service', () => ({
  performCurlRequest: jest.fn().mockImplementation(async (context, options) => {
    // Return a mock response that matches CurlActionResponse
    return {
      status: 200,
      data: { success: true },
      headers: { 'content-type': 'application/json' },
      truncated: false
    };
  })
}));

describe('curl.actions', () => {
  const curlActions = createCurlActions(mockContext);
  const performCurlRequest = curlActions.performCurlRequest.function;

  it('should handle string JSON body correctly', async () => {
    const jsonBody = '{"key": "value"}';
    const result = await performCurlRequest({
      url: 'https://api.example.com',
      method: 'POST',
      body: jsonBody
    }) as CurlActionResponse;

    expect(result.status).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.headers).toBeDefined();
  });

  it('should handle object body correctly', async () => {
    const objectBody = { key: 'value' };
    const result = await performCurlRequest({
      url: 'https://api.example.com',
      method: 'POST',
      body: objectBody
    }) as CurlActionResponse;

    expect(result.status).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.headers).toBeDefined();
  });

  it('should handle requests without body', async () => {
    const result = await performCurlRequest({
      url: 'https://api.example.com',
      method: 'GET'
    }) as CurlActionResponse;

    expect(result.status).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.headers).toBeDefined();
  });

  it('should validate URL format', async () => {
    const result = await performCurlRequest({
      url: 'invalid-url',
      method: 'GET'
    }) as CurlActionResponse;

    expect(result.status).toBe(400);
    expect(result.error).toContain('Invalid URL');
  });

  it('should handle custom headers', async () => {
    const result = await performCurlRequest({
      url: 'https://api.example.com',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer token',
        'Custom-Header': 'custom-value'
      },
      body: { key: 'value' }
    }) as CurlActionResponse;

    expect(result.status).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.headers).toBeDefined();
  });

  it('should handle errors gracefully', async () => {
    // Mock implementation for error case
    require('../curl.service').performCurlRequest.mockImplementationOnce(async () => {
      throw new Error('Network error');
    });

    const result = await performCurlRequest({
      url: 'https://non-existent-domain-12345.com',
      method: 'GET'
    }) as CurlActionResponse;

    expect(result.status).toBe(500);
    expect(result.error).toBeDefined();
  });
});
