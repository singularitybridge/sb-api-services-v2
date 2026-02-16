import axios from 'axios';
import NodeCache from 'node-cache';
import { getApiKey } from '../../services/api.key.service';

const COMPOSIO_API_BASE = 'https://backend.composio.dev/api/v3';

// Cache credentials (30 min TTL)
const credentialsCache = new NodeCache({ stdTTL: 1800 });

// Cache tool listings (5 min TTL)
const toolsCache = new NodeCache({ stdTTL: 300 });

interface ComposioToolInfo {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ComposioCredentials {
  apiKey: string;
  externalUserId: string;
}

async function getCredentials(companyId: string): Promise<ComposioCredentials> {
  const cacheKey = `creds:${companyId}`;
  const cached = credentialsCache.get<ComposioCredentials>(cacheKey);
  if (cached) return cached;

  const apiKey = await getApiKey(companyId, 'composio_api_key');
  if (!apiKey) {
    throw new Error('Composio API key not configured');
  }

  const externalUserId = await getApiKey(companyId, 'composio_external_user_id');
  if (!externalUserId) {
    throw new Error('Composio external user ID not configured');
  }

  const creds = { apiKey, externalUserId };
  credentialsCache.set(cacheKey, creds);
  return creds;
}

export async function listTools(
  companyId: string,
  toolkit?: string,
): Promise<ComposioToolInfo[]> {
  const toolsCacheKey = `tools:${companyId}:${toolkit || 'all'}`;
  const cached = toolsCache.get<ComposioToolInfo[]>(toolsCacheKey);
  if (cached) return cached;

  const { apiKey } = await getCredentials(companyId);

  const params: Record<string, string> = {};
  if (toolkit) {
    params.toolkit_slug = toolkit;
  }

  const response = await axios.get(`${COMPOSIO_API_BASE}/tools`, {
    headers: { 'x-api-key': apiKey },
    params,
    timeout: 15000,
  });

  const items = response.data?.items || [];
  const result: ComposioToolInfo[] = items.map((tool: any) => ({
    name: tool.slug,
    description: tool.description || tool.name,
    parameters: tool.input_parameters || {},
  }));

  toolsCache.set(toolsCacheKey, result);
  return result;
}

export async function executeTool(
  companyId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { apiKey, externalUserId } = await getCredentials(companyId);

  try {
    const response = await axios.post(
      `${COMPOSIO_API_BASE}/tools/execute/${toolName}`,
      {
        arguments: args,
        user_id: externalUserId,
        version: 'latest',
      },
      {
        headers: { 'x-api-key': apiKey },
        timeout: 60000,
      },
    );

    const data = response.data;
    if (data.successful === false) {
      throw new Error(data.error || `Tool execution failed: ${toolName}`);
    }

    return data.data || data;
  } catch (error: any) {
    if (error.response) {
      const detail = JSON.stringify(error.response.data);
      throw new Error(
        `Composio execute failed (${error.response.status}): ${detail}`,
      );
    }
    throw error;
  }
}

export async function verifyConnection(
  apiKey: string,
  _externalUserId: string,
): Promise<{ valid: boolean; toolCount?: number; error?: string }> {
  try {
    const response = await axios.get(`${COMPOSIO_API_BASE}/tools`, {
      headers: { 'x-api-key': apiKey },
      params: { toolkit_slug: 'gmail', limit: 100 },
      timeout: 10000,
    });

    const items = response.data?.items || [];
    return { valid: true, toolCount: items.length };
  } catch (error: any) {
    if (error.response?.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }
    return {
      valid: false,
      error: error.response?.data?.error?.message || error.message || 'Failed to connect to Composio',
    };
  }
}
