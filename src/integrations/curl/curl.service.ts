import axios, { AxiosRequestConfig, Method } from 'axios';
import { ActionContext } from '../actions/types';

interface CurlRequestOptions {
  url: string;
  method: Method;
  headers: { [key: string]: string };
  body: string;
  timeout: number;
  max_response_chars?: number;
}

interface CurlResponse {
  status: number;
  data: any;
  headers: any;
  error?: string;
  truncated?: boolean;
}

const DEFAULT_MAX_CHARS = 16000 * 4; // 16k tokens 

const truncateData = (data: any, maxChars: number): { data: any; truncated: boolean } => {
  // Convert any response to string for consistent handling
  const stringData = typeof data === 'string' ? data : JSON.stringify(data);
  
  if (stringData.length > maxChars) {
    return {
      data: stringData.slice(0, maxChars) + '... [truncated]',
      truncated: true
    };
  }
  
  // If not truncated, return original data format
  return { data, truncated: false };
};

export async function performCurlRequest(
  context: ActionContext,
  options: CurlRequestOptions
): Promise<CurlResponse> {
  const { url, method, headers, body, timeout, max_response_chars } = options;
  const effectiveMaxChars = max_response_chars ?? DEFAULT_MAX_CHARS;

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
    
    // Apply truncation with effectiveMaxChars
    const { data: truncatedData, truncated } = truncateData(response.data, effectiveMaxChars);

    const result: CurlResponse = {
      status: response.status,
      data: truncatedData,
      headers: response.headers,
      truncated
    };

    if (response.status >= 400) {
      result.error = `HTTP ${response.status}: ${response.statusText}`;
    }

    if (truncated) {
      const truncationMessage = 'Response was truncated due to character limit.';
      result.error = result.error 
        ? `${result.error} ${truncationMessage}`
        : truncationMessage;
    }

    return result;
  } catch (error: any) {
    console.error('performCurlRequest: Error performing request', error);
    return {
      status: 500,
      data: null,
      headers: {},
      error: `Request failed: ${error.message}`,
      truncated: false
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
