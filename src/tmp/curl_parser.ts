import { readFileSync } from 'fs';
import axios from 'axios';
import * as querystring from 'querystring';

export const readAndParseRequest = (filePath: string): {
  url: string;
  method: string;
  headers: Record<string, string>;
  data: any;
} => {
  const content = readFileSync(filePath, 'utf-8');
  return parseCurlCommand(content);
};

export const parseCurlCommand = (curlCommand: string): {
  url: string;
  method: string;
  headers: Record<string, string>;
  data: any;
} => {
  // Extract URL - support both single and double quotes
  const urlMatch = curlCommand.match(/curl\s+(?:--location\s+)?['"]([^'"]+)['"]/);
  const url = urlMatch?.[1];
  if (!url) throw new Error('Could not parse URL');

  // Extract headers - support both single and double quotes
  const headers: Record<string, string> = {};
  const headerMatches = curlCommand.matchAll(/--header\s+['"]([^:]+):\s*([^'"]+)['"]/g);
  for (const match of Array.from(headerMatches)) {
    headers[match[1]] = match[2];
  }

  // Try to extract data-raw JSON
  let data = null;
  const dataRawMatch = curlCommand.match(/--data-raw\s+'({[\s\S]*?})'(?:\s|$)/);
  if (dataRawMatch?.[1]) {
    try {
      // Clean up the JSON string
      const jsonStr = dataRawMatch[1]
        .replace(/\n/g, '')  // Remove newlines
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
      data = JSON.parse(jsonStr);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      throw error;
    }
  }

  // If no data-raw, try to extract data-urlencode parameters
  if (!data) {
    const formData: Record<string, string> = {};
    const dataUrlencodeMatches = curlCommand.matchAll(/--data-urlencode\s+['"]([^=]+)=([^'"]+)['"]?/g);
    for (const match of Array.from(dataUrlencodeMatches)) {
      formData[match[1]] = match[2];
    }
    if (Object.keys(formData).length > 0) {
      data = querystring.stringify(formData);
    }
  }

  // Determine HTTP method
  let method: string;
  const methodMatch = curlCommand.match(/-X\s+['"]?([A-Z]+)['"]?/);
  if (methodMatch) {
    method = methodMatch[1];
  } else {
    // If there's data, it's a POST request
    method = data ? 'POST' : 'GET';
  }

  return { 
    url, 
    method,
    headers, 
    data
  };
};

export const executeCurlRequest = async (
  url: string, 
  headers: Record<string, string>, 
  data: any,
  method: string = 'GET'
) => {
  try {
    const config: any = {
      method: method.toLowerCase(),
      url,
      headers,
      validateStatus: () => true, // Accept any status code
      maxRedirects: 5 // Allow redirects
    };

    // Only add data for POST requests
    if (method.toUpperCase() === 'POST' && data) {
      config.data = data;
    }

    const response = await axios(config);

    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        data: error.response?.data,
        headers: error.response?.headers || {},
        error: error.message
      };
    }
    throw error;
  }
};
