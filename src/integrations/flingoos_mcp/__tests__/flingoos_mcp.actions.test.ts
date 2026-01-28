import { validateConnection } from '../flingoos_mcp.actions';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('flingoos_mcp.actions - validateConnection', () => {
  const mockApiKey = 'fmcp_test_xxxxxxxxxxxxxxxxxxxx';
  const mockBaseUrl = 'https://mcp.diligent4.com';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return error when API key is missing', async () => {
    const result = await validateConnection({});

    expect(result.success).toBe(false);
    expect(result.error).toBe('Flingoos MCP API key is not configured');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should successfully validate connection', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        contexts: [],
        total_count: 42,
        project_count: 10,
        session_count: 32,
      }),
    });

    const result = await validateConnection({
      flingoos_mcp_api_key: mockApiKey,
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Connected successfully to Flingoos MCP. Found 42 contexts.');
    expect(mockFetch).toHaveBeenCalledWith(
      `${mockBaseUrl}/api/contexts?limit=1`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Authorization': `Bearer ${mockApiKey}`,
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('should return error for 401 unauthorized', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    const result = await validateConnection({
      flingoos_mcp_api_key: mockApiKey,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid API key. Please check your Flingoos MCP credentials.');
  });

  it('should return error for 403 forbidden', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: 'Forbidden' }),
    });

    const result = await validateConnection({
      flingoos_mcp_api_key: mockApiKey,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Access denied. Please check your API key permissions.');
  });

  it('should return error for other HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal server error' }),
    });

    const result = await validateConnection({
      flingoos_mcp_api_key: mockApiKey,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection failed: Internal server error');
  });

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('fetch failed: network error'));

    const result = await validateConnection({
      flingoos_mcp_api_key: mockApiKey,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unable to reach Flingoos MCP API');
  });

  it('should handle generic errors', async () => {
    mockFetch.mockRejectedValue(new Error('Something went wrong'));

    const result = await validateConnection({
      flingoos_mcp_api_key: mockApiKey,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Something went wrong');
  });

  it('should handle malformed JSON responses', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    const result = await validateConnection({
      flingoos_mcp_api_key: mockApiKey,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection failed: HTTP 400');
  });

  it('should handle response with no total_count', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ contexts: [] }),
    });

    const result = await validateConnection({
      flingoos_mcp_api_key: mockApiKey,
    });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Connected successfully to Flingoos MCP. Found 0 contexts.');
  });
});
