import { performCurlRequest } from '../curl.service';
import axios from 'axios';
import { ActionContext } from '../../actions/types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('performCurlRequest', () => {
  const mockContext = {} as ActionContext;
  const baseOptions = {
    url: 'https://api.example.com',
    method: 'GET' as const,
    headers: {},
    body: '',
    timeout: 5000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle normal responses within default character limit', async () => {
    const shortResponse = 'x'.repeat(400);
    const mockResponse = {
      status: 200,
      data: shortResponse,
      headers: { 'content-type': 'text/plain' },
      statusText: 'OK',
    };

    mockedAxios.request.mockResolvedValueOnce(mockResponse);

    const result = await performCurlRequest(mockContext, baseOptions);

    expect(result.truncated).toBe(false);
    expect(result.data).toBe(shortResponse);
  });

  it('should not truncate responses within default 64k character limit', async () => {
    const response = 'x'.repeat(64000);
    const mockResponse = {
      status: 200,
      data: response,
      headers: { 'content-type': 'text/plain' },
      statusText: 'OK',
    };

    mockedAxios.request.mockResolvedValueOnce(mockResponse);

    const result = await performCurlRequest(mockContext, baseOptions);

    expect(result.truncated).toBe(false);
    expect(result.data).toBe(response);
  });

  it('should truncate string responses when exceeding max_response_chars', async () => {
    const longString = 'x'.repeat(2000);
    const mockResponse = {
      status: 200,
      data: longString,
      headers: { 'content-type': 'text/plain' },
      statusText: 'OK',
    };

    mockedAxios.request.mockResolvedValueOnce(mockResponse);

    const result = await performCurlRequest(mockContext, {
      ...baseOptions,
      max_response_chars: 1000,
    });

    expect(result.truncated).toBe(true);
    expect(typeof result.data).toBe('string');
    expect(result.data.length).toBeLessThanOrEqual(1000 + '... [truncated]'.length);
    expect(result.data).toContain('[truncated]');
  });

  it('should truncate JSON responses when exceeding max_response_chars', async () => {
    const largeObject = {
      data: 'x'.repeat(1000),
      moreData: 'y'.repeat(1000),
    };
    const mockResponse = {
      status: 200,
      data: largeObject,
      headers: { 'content-type': 'application/json' },
      statusText: 'OK',
    };

    mockedAxios.request.mockResolvedValueOnce(mockResponse);

    const result = await performCurlRequest(mockContext, {
      ...baseOptions,
      max_response_chars: 1000,
    });

    expect(result.truncated).toBe(true);
    expect(typeof result.data).toBe('string');
    expect(result.data.length).toBeLessThanOrEqual(1000 + '... [truncated]'.length);
  });

  it('should handle errors properly', async () => {
    mockedAxios.request.mockRejectedValueOnce(new Error('Network error'));

    const result = await performCurlRequest(mockContext, baseOptions);

    expect(result).toEqual({
      status: 500,
      data: null,
      headers: {},
      error: 'Request failed: Network error',
      truncated: false,
    });
  });

  it('should include truncation information in error responses', async () => {
    const largeErrorResponse = {
      status: 400,
      data: { error: 'x'.repeat(2000) },
      headers: { 'content-type': 'application/json' },
      statusText: 'Bad Request',
    };

    mockedAxios.request.mockResolvedValueOnce(largeErrorResponse);

    const result = await performCurlRequest(mockContext, {
      ...baseOptions,
      max_response_chars: 1000,
    });

    expect(result.status).toBe(400);
    expect(result.truncated).toBe(true);
    expect(result.error).toContain('Response was truncated');
  });

  it('should not truncate responses under specified max_response_chars', async () => {
    const shortString = 'x'.repeat(500);
    const mockResponse = {
      status: 200,
      data: shortString,
      headers: { 'content-type': 'text/plain' },
      statusText: 'OK',
    };

    mockedAxios.request.mockResolvedValueOnce(mockResponse);

    const result = await performCurlRequest(mockContext, {
      ...baseOptions,
      max_response_chars: 1000,
    });

    expect(result.truncated).toBe(false);
    expect(result.data).toBe(shortString);
  });
});
