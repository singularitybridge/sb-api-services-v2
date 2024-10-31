import { ActionContext } from '../actions/types';
import { parseCurlCommand, executeCurlRequest } from '../../tmp/curl_parser';

interface CurlResponse {
  status: number;
  data: any;
  headers: any;
}

export async function performCurlRequest(
  context: ActionContext,
  curlCommand: string
): Promise<CurlResponse> {
  try {
    const { url, method, headers, data } = parseCurlCommand(curlCommand);

    if (!isValidUrl(url)) {
      throw new Error('Invalid or disallowed URL.');
    }

    // Execute the request and get raw response
    const response = await executeCurlRequest(url, headers, data, method);
    
    // Return the response as-is without modifying status or adding error fields
    return {
      status: response.status,
      data: response.data || null,
      headers: response.headers || {}
    };
  } catch (error: any) {
    console.error('performCurlRequest: Error performing request', error);
    throw error;
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
