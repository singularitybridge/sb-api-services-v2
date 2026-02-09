import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';
import { TestConnectionResult } from '../../services/integration-config.service';

async function getBaseUrl(companyId: string): Promise<string> {
  const url = await getApiKey(companyId, 'trip_os_api_url');
  if (!url) {
    throw new Error('Trip OS API URL is not configured. Please set it in integration settings.');
  }
  return url.replace(/\/$/, '');
}

export async function tripOsGet(
  companyId: string,
  path: string,
  params?: Record<string, string>,
): Promise<any> {
  const baseUrl = await getBaseUrl(companyId);
  const response = await axios.get(`${baseUrl}${path}`, {
    params,
    timeout: 15000,
  });
  return response.data;
}

export async function tripOsPost(
  companyId: string,
  path: string,
  body: Record<string, any>,
): Promise<any> {
  const baseUrl = await getBaseUrl(companyId);
  const response = await axios.post(`${baseUrl}${path}`, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  return response.data;
}

export async function validateConnection(
  apiKeys: Record<string, string>,
): Promise<TestConnectionResult> {
  const url = apiKeys.trip_os_api_url;
  if (!url) {
    return { success: false, error: 'Trip OS API URL is not configured' };
  }

  try {
    const response = await axios.get(`${url.replace(/\/$/, '')}/api/health`, {
      timeout: 10000,
    });
    if (response.status === 200) {
      return { success: true, message: 'Connected to Trip OS API' };
    }
    return { success: false, error: `Unexpected status: ${response.status}` };
  } catch (error: any) {
    return { success: false, error: error.message || 'Connection failed' };
  }
}
