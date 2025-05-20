import { ActionContext, FunctionFactory } from '../../actions/types';
import { createCurlActions, CurlActionResponse } from '../curl.actions';
import { SupportedLanguage } from '../../../services/discovery.service';

// Mock the context
const mockContext: ActionContext = {
  sessionId: 'test-session',
  companyId: 'test-company',
  language: 'en' as SupportedLanguage
};

// Mock the curl service
jest.mock('../curl.service', () => ({
  performCurlRequest: jest.fn(),
}));

// After jest.mock, we can get a reference to the mock function.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { performCurlRequest: mockPerformCurlRequestFromService } = require('../curl.service') as { performCurlRequest: jest.Mock };


describe('curl.actions', () => {
  const curlActions = createCurlActions(mockContext);
  // This is the function we are testing from curl.actions.ts
  const performCurlAction = curlActions.performCurlRequest.function;

  beforeEach(() => {
    // Reset the mock before each test
    mockPerformCurlRequestFromService.mockReset();
  });

  it('should successfully call the service and return its response', async () => {
    const mockServiceResponse = {
      status: 200,
      data: { message: 'Success' },
      headers: { 'x-test-header': 'value' },
      truncated: false
    };
    mockPerformCurlRequestFromService.mockResolvedValue(mockServiceResponse);

    const result = await performCurlAction({
      curlCommand: 'curl https://api.example.com/data'
    }) as CurlActionResponse & { success?: boolean };

    expect(mockPerformCurlRequestFromService).toHaveBeenCalledWith(mockContext, 'curl https://api.example.com/data');
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ message: 'Success' });
    expect(result.headers).toEqual({ 'x-test-header': 'value' });
    expect(result.success).toBe(true);
    expect(result.truncated).toBe(false); // Updated expectation
  });

  it('should handle non-2xx status codes from service and set success to false', async () => {
    const mockServiceResponse = {
      status: 404,
      data: { error: 'Not Found' },
      headers: {},
      error: 'Service returned 404',
      truncated: false
    };
    mockPerformCurlRequestFromService.mockResolvedValue(mockServiceResponse);

    const result = await performCurlAction({
      curlCommand: 'curl https://api.example.com/nonexistent'
    }) as CurlActionResponse & { success?: boolean };

    expect(result.status).toBe(404);
    expect(result.data).toEqual({ error: 'Not Found' });
    expect(result.error).toBe('Service returned 404');
    expect(result.success).toBe(false);
  });
  
  it('should propagate error response from service for invalid URL or command', async () => {
    // This test assumes curl.service.ts is responsible for parsing curlCommand
    // and would return an error structure if the command is invalid (e.g., bad URL).
    const mockServiceErrorResponse = {
      status: 400,
      data: null,
      headers: {},
      error: 'Invalid command or URL in service',
      truncated: false
    };
    mockPerformCurlRequestFromService.mockResolvedValue(mockServiceErrorResponse);

    const result = await performCurlAction({
      curlCommand: 'curl invalid-url-or-command'
    }) as CurlActionResponse & { success?: boolean };

    expect(result.status).toBe(400);
    expect(result.error).toBe('Invalid command or URL in service');
    expect(result.success).toBe(false);
  });
  
  it('should handle truncation if maxResponseChars is provided and data is a string', async () => {
    const longData = 'a'.repeat(100);
    const mockServiceResponse = {
      status: 200,
      data: longData,
      headers: {},
      truncated: false
    };
    mockPerformCurlRequestFromService.mockResolvedValue(mockServiceResponse);

    const result = await performCurlAction({
      curlCommand: 'curl https://api.example.com/longdata',
      maxResponseChars: 50
    }) as CurlActionResponse & { success?: boolean };

    expect(result.status).toBe(200);
    expect(result.data).toBe('a'.repeat(50));
    expect(result.truncated).toBe(true);
    expect(result.success).toBe(true);
  });

  it('should not truncate if data is not a string, even if maxResponseChars is provided', async () => {
    const objectData = { message: 'a'.repeat(100) };
    const mockServiceResponse = {
      status: 200,
      data: objectData,
      headers: {},
      truncated: false
    };
    mockPerformCurlRequestFromService.mockResolvedValue(mockServiceResponse);

    const result = await performCurlAction({
      curlCommand: 'curl https://api.example.com/objectdata',
      maxResponseChars: 50
    }) as CurlActionResponse & { success?: boolean };
    
    expect(result.data).toEqual(objectData);
    expect(result.truncated).toBe(false); // Updated expectation
    expect(result.success).toBe(true);
  });

  it('should handle errors thrown by the service gracefully', async () => {
    // Mock the service to throw an error
    mockPerformCurlRequestFromService.mockRejectedValueOnce(new Error('Network connection failed'));

    const result = await performCurlAction({
      curlCommand: 'curl https://non-existent-domain-12345.com'
    }) as CurlActionResponse & { success?: boolean };

    // Check the structured error response from curl.actions.ts's catch block
    expect(result.status).toBe(500);
    expect(result.error).toBe('Network connection failed');
    expect(result.data).toBeNull();
    expect(result.success).toBe(false);
    expect(result.truncated).toBe(false);
  });
});
