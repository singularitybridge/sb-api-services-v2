import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';
import { TestConnectionResult } from '../../services/integration-config.service';

async function getConfig(companyId: string): Promise<{ baseUrl: string; apiKey: string }> {
  const [url, apiKey] = await Promise.all([
    getApiKey(companyId, 'trip_os_api_url'),
    getApiKey(companyId, 'trip_os_api_key'),
  ]);
  if (!url) {
    throw new Error('Trip OS API URL is not configured. Please set it in integration settings.');
  }
  if (!apiKey) {
    throw new Error('Trip OS API Key is not configured. Please set it in integration settings.');
  }
  return { baseUrl: url.replace(/\/$/, ''), apiKey };
}

export async function tripOsGet(
  companyId: string,
  path: string,
  params?: Record<string, string>,
): Promise<any> {
  const { baseUrl, apiKey } = await getConfig(companyId);
  const response = await axios.get(`${baseUrl}${path}`, {
    params,
    headers: { 'x-api-key': apiKey },
    timeout: 15000,
  });
  return response.data;
}

export async function tripOsPost(
  companyId: string,
  path: string,
  body: Record<string, any>,
): Promise<any> {
  const { baseUrl, apiKey } = await getConfig(companyId);
  const response = await axios.post(`${baseUrl}${path}`, body, {
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    timeout: 15000,
  });
  return response.data;
}

export async function tripOsPatch(
  companyId: string,
  path: string,
  body: Record<string, any>,
): Promise<any> {
  const { baseUrl, apiKey } = await getConfig(companyId);
  const response = await axios.patch(`${baseUrl}${path}`, body, {
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    timeout: 15000,
  });
  return response.data;
}

export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const url = apiKeys.trip_os_api_url;
  const apiKey = apiKeys.trip_os_api_key;
  if (!url) {
    return { success: false, error: 'Trip OS API URL is not configured' };
  }
  if (!apiKey) {
    return { success: false, error: 'Trip OS API Key is not configured' };
  }

  try {
    const response = await axios.get(`${url.replace(/\/$/, '')}/api/data/destinations`, {
      headers: { 'x-api-key': apiKey },
      params: { limit: '1' },
      timeout: 10000,
    });
    if (response.status === 200) {
      return { success: true, message: 'Connected to Trip OS API' };
    }
    return { success: false, error: `Unexpected status: ${response.status}` };
  } catch (error: any) {
    if (error.response?.status === 401) {
      return { success: false, error: 'Invalid API key' };
    }
    return { success: false, error: error.message || 'Connection failed' };
  }
}
