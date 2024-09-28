import axios, { AxiosRequestConfig, Method } from 'axios';
import { ActionContext } from '../actions/types';

interface CurlRequestOptions {
  url: string;
  method: Method;
  headers: { [key: string]: string };
  body: string;
  timeout: number;
}

interface CurlResponse {
  status: number;
  data: any;
  headers: any;
  error?: string;
}

export async function performCurlRequest(
  context: ActionContext,
  options: CurlRequestOptions
): Promise<CurlResponse> {
  const { url, method, headers, body, timeout } = options;

  if (!isValidUrl(url)) {
    throw new Error('Invalid or disallowed URL.');
  }

  try {
    const axiosConfig: AxiosRequestConfig = {
      url,
      method,
      headers,
      timeout,
      maxContentLength: 1024 * 1024, // Limit response size to 1MB
      validateStatus: () => true, // Allow all status codes
    };

    if (method !== 'GET' && body) {
      axiosConfig.data = body;
    }

    const response = await axios.request(axiosConfig);

    const result: CurlResponse = {
      status: response.status,
      data: response.data,
      headers: response.headers,
    };

    if (response.status >= 400) {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
    }

    return result;
  } catch (error: any) {
    console.error('performCurlRequest: Error performing request', error);
    return {
      status: 500,
      data: null,
      headers: {},
      error: `Request failed: ${error.message}`,
    };
  }
}

function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return true;
  } catch {
    return false;
  }
}