import { ActionContext } from '../actions/types';
import { parseCurlCommand, executeCurlRequest } from '../../tmp/curl_parser';

interface CurlResponse {
  status: number;
  data: any;
  headers: any;
  error?: string;
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

    const response = await executeCurlRequest(url, headers, data, method);
    
    const result: CurlResponse = {
      status: response.status,
      data: response.data,
      headers: response.headers
    };

    // Check for actual error conditions
    if (response.status >= 400) {
      result.error = `HTTP ${response.status}: Request failed`;
    }

    return result;
  } catch (error: any) {
    console.error('performCurlRequest: Error performing request', error);
    return {
      status: 500,
      data: null,
      headers: {},
      error: `Request failed: ${error.message}`
    };
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
