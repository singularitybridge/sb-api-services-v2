import {
  listContexts,
  searchContexts,
  getContext,
  modifyContext,
  generateContext,
} from '../flingoos_mcp.service';

// Mock the integration config service
jest.mock('../../../services/integration-config.service', () => ({
  getApiKeyWithFallback: jest.fn(),
}));

// Mock the session service
jest.mock('../../../services/session.service', () => ({
  getSessionById: jest.fn(),
}));

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Get references to the mocked functions
const { getApiKeyWithFallback } = require('../../../services/integration-config.service') as { getApiKeyWithFallback: jest.Mock };
const { getSessionById } = require('../../../services/session.service') as { getSessionById: jest.Mock };

describe('flingoos_mcp.service', () => {
  const mockSessionId = 'test-session-id';
  const mockCompanyId = 'test-company-id';
  const mockUserId = 'test-user-id';
  const mockApiKey = 'fmcp_test_xxxxxxxxxxxxxxxxxxxx';
  const baseUrl = 'https://mcp.diligent4.com';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    getApiKeyWithFallback.mockImplementation((companyId: string, integrationId: string, keyName: string) => {
      if (keyName === 'flingoos_mcp_api_key') return Promise.resolve(mockApiKey);
      return Promise.resolve(null);
    });
    
    getSessionById.mockResolvedValue({
      userId: mockUserId,
      companyId: mockCompanyId,
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  describe('listContexts', () => {
    it('should list contexts successfully', async () => {
      const mockResponse = {
        contexts: [
          { id: 'ctx1', kind: 'session', name: 'Test Workflow' },
          { id: 'ctx2', kind: 'project', name: 'Test Project' },
        ],
        total_count: 2,
        project_count: 1,
        session_count: 1,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await listContexts(mockSessionId, mockCompanyId, {});

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/contexts`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockApiKey}`,
            'X-Singularity-Company-Id': mockCompanyId,
            'X-Singularity-User-Id': mockUserId,
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include query parameters when provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ contexts: [], total_count: 0 }),
      });

      await listContexts(mockSessionId, mockCompanyId, {
        limit: 10,
        scope: 'mine',
        kind: 'session',
        session_type: 'workflow_recording',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('scope=mine'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('kind=session'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('session_type=workflow_recording'),
        expect.any(Object)
      );
    });

    it('should throw error when API key is missing', async () => {
      getApiKeyWithFallback.mockResolvedValue(null);

      await expect(listContexts(mockSessionId, mockCompanyId, {}))
        .rejects.toThrow('Flingoos MCP API key not configured');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'Invalid API key' }),
      });

      await expect(listContexts(mockSessionId, mockCompanyId, {}))
        .rejects.toThrow('Flingoos API error: Invalid API key');
    });
  });

  describe('searchContexts', () => {
    it('should search contexts successfully', async () => {
      const mockResponse = {
        query: 'invoice workflow',
        status: 'AUTO_SELECTED',
        instruction: 'Clear winner found',
        results: [{ id: 'ctx1', name: 'Invoice Workflow', score: 92 }],
        selected: { id: 'ctx1' },
        total_candidates: 10,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await searchContexts(mockSessionId, mockCompanyId, {
        q: 'invoice workflow',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/contexts/search?q=invoice+workflow'),
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when query is empty', async () => {
      await expect(searchContexts(mockSessionId, mockCompanyId, { q: '' }))
        .rejects.toThrow('Search query (q) is required');
    });

    it('should include optional parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await searchContexts(mockSessionId, mockCompanyId, {
        q: 'test',
        top_k: 10,
        min_confidence: 0.5,
        scope: 'public',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('top_k=10'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('min_confidence=0.5'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('scope=public'),
        expect.any(Object)
      );
    });
  });

  describe('getContext', () => {
    it('should get context by ID successfully', async () => {
      const mockResponse = {
        id: 'ctx1',
        kind: 'session',
        name: 'Test Workflow',
        content: { steps: [] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getContext(mockSessionId, mockCompanyId, { id: 'ctx1' });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/contexts/ctx1`,
        expect.any(Object)
      );
      expect(result).toEqual(mockResponse);
    });

    it('should include detail parameter', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await getContext(mockSessionId, mockCompanyId, { id: 'ctx1', detail: 'summary' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('detail=summary'),
        expect.any(Object)
      );
    });

    it('should throw error when ID is missing', async () => {
      await expect(getContext(mockSessionId, mockCompanyId, { id: '' }))
        .rejects.toThrow('Context ID is required');
    });

    it('should handle 404 errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Context not found' }),
      });

      await expect(getContext(mockSessionId, mockCompanyId, { id: 'nonexistent' }))
        .rejects.toThrow('Flingoos API error: Context not found');
    });
  });

  describe('modifyContext', () => {
    it('should modify context successfully', async () => {
      const mockResponse = {
        id: 'ctx1',
        kind: 'session',
        target_type: 'step',
        target_number: 3,
        change_prompt: 'Change click to double-click',
        preview: 'Step 3: Double-click...',
        saved: true,
        changes: ['action: click -> double-click'],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await modifyContext(mockSessionId, mockCompanyId, {
        id: 'ctx1',
        target_type: 'step',
        target_number: 3,
        change_prompt: 'Change click to double-click',
        auto_confirm: true,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/contexts/ctx1`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            target_type: 'step',
            target_number: 3,
            change_prompt: 'Change click to double-click',
            auto_confirm: true,
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when required fields are missing', async () => {
      await expect(modifyContext(mockSessionId, mockCompanyId, {
        id: '',
        target_type: 'step',
        change_prompt: 'test',
      })).rejects.toThrow('Context ID is required');

      await expect(modifyContext(mockSessionId, mockCompanyId, {
        id: 'ctx1',
        target_type: '' as any,
        change_prompt: 'test',
      })).rejects.toThrow('Target type is required');

      await expect(modifyContext(mockSessionId, mockCompanyId, {
        id: 'ctx1',
        target_type: 'step',
        change_prompt: '',
      })).rejects.toThrow('Change prompt is required');
    });
  });

  describe('generateContext', () => {
    it('should generate context successfully', async () => {
      const mockResponse = {
        status: 'accepted',
        session_id: 'new_ctx1',
        message: 'Context generation started',
        estimated_seconds: 45,
        output_type: 'workflow_recording',
        content_length: 500,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const content = 'Step 1: Open the app. Step 2: Click login. Step 3: Enter credentials.';
      const result = await generateContext(mockSessionId, mockCompanyId, {
        output_type: 'workflow_recording',
        content,
        name: 'Login Workflow',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/api/contexts/generate`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            output_type: 'workflow_recording',
            content,
            name: 'Login Workflow',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error when content is too short', async () => {
      await expect(generateContext(mockSessionId, mockCompanyId, {
        output_type: 'workflow_recording',
        content: 'Too short',
      })).rejects.toThrow('Content must be at least 50 characters');
    });

    it('should throw error when content is too long', async () => {
      const longContent = 'a'.repeat(50001);
      await expect(generateContext(mockSessionId, mockCompanyId, {
        output_type: 'workflow_recording',
        content: longContent,
      })).rejects.toThrow('Content must not exceed 50000 characters');
    });

    it('should throw error when output_type is missing', async () => {
      await expect(generateContext(mockSessionId, mockCompanyId, {
        output_type: '' as any,
        content: 'a'.repeat(100),
      })).rejects.toThrow('Output type is required');
    });
  });

  describe('user context headers', () => {
    it('should include user ID header when session is found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ contexts: [] }),
      });

      await listContexts(mockSessionId, mockCompanyId, {});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Singularity-User-Id': mockUserId,
          }),
        })
      );
    });

    it('should continue without user header when session lookup fails', async () => {
      getSessionById.mockRejectedValue(new Error('Session not found'));
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ contexts: [] }),
      });

      // Should not throw, should continue without user header
      await listContexts(mockSessionId, mockCompanyId, {});

      expect(mockFetch).toHaveBeenCalled();
      // The call should still happen, just without the user header
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['X-Singularity-Company-Id']).toBe(mockCompanyId);
    });
  });
});
