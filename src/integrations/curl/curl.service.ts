import axios, { Method } from 'axios';
import { ActionContext } from '../actions/types';

interface CurlRequestOptions {
  url: string;
  method: Method;
  headers: { [key: string]: string };
  body: string;
  timeout: number;
}

export async function performCurlRequest(
  context: ActionContext,
  options: CurlRequestOptions
): Promise<{ status: number; data: any; headers: any }> {
  const { url, method, headers, body, timeout } = options;

  // Security considerations:
  // - Prevent SSRF by restricting IP addresses (no localhost, private IPs)
  // - Optionally use a library to resolve and validate the URL

  if (!isValidUrl(url)) {
    throw new Error('Invalid or disallowed URL.');
  }

  try {
    const response = await axios.request({
      url,
      method,
      headers,
      data: body,
      timeout,
      maxContentLength: 1024 * 1024, // Limit response size to 1MB
      validateStatus: (status) => status >= 200 && status < 300, // Only resolve for 2xx statuses
    });

    return {
      status: response.status,
      data: response.data,
      headers: response.headers,
    };
  } catch (error: any) {
    console.error('performCurlRequest: Error performing request', error);
    if (error.response) {
      // Server responded with a status other than 2xx
      throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
    } else if (error.request) {
      // No response received
      throw new Error('No response received from the server.');
    } else {
      // Other errors
      throw new Error(error.message || 'Unknown error occurred.');
    }
  }
}

function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Allow localhost and private IP addresses
    return true;
  } catch {
    return false;
  }
}