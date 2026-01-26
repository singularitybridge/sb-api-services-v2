import { ActionContext } from '../actions/types';

interface CurlResponse {
  status: number;
  data: any;
  headers: Record<string, string>;
  error?: string;
}

interface ParsedCurlCommand {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Parse a curl command string into its components
 */
function parseCurlCommand(curlCommand: string): ParsedCurlCommand {
  // Normalize multi-line commands
  const normalized = curlCommand
    .split('\n')
    .map((line) => line.trim())
    .map((line) => (line.endsWith('\\') ? line.slice(0, -1).trim() : line))
    .join(' ')
    .trim();

  // Remove 'curl' prefix
  const withoutCurl = normalized.replace(/^curl\s+/i, '');

  let url = '';
  let method = 'GET';
  const headers: Record<string, string> = {};
  let body: string | undefined;

  // Tokenize the command respecting quotes
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < withoutCurl.length; i++) {
    const char = withoutCurl[i];

    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuote) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current) {
    tokens.push(current);
  }

  // Parse tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token === '-X' || token === '--request') {
      method = tokens[++i]?.toUpperCase() || 'GET';
    } else if (token === '-H' || token === '--header') {
      const headerValue = tokens[++i];
      if (headerValue) {
        const colonIndex = headerValue.indexOf(':');
        if (colonIndex > 0) {
          const key = headerValue.slice(0, colonIndex).trim();
          const value = headerValue.slice(colonIndex + 1).trim();
          headers[key] = value;
        }
      }
    } else if (token === '-d' || token === '--data' || token === '--data-raw') {
      body = tokens[++i];
      if (method === 'GET') {
        method = 'POST';
      }
    } else if (token === '--data-binary') {
      body = tokens[++i];
      if (body?.startsWith('@')) {
        // File reference - not supported, skip
        body = undefined;
      }
      if (method === 'GET') {
        method = 'POST';
      }
    } else if (
      !token.startsWith('-') &&
      (token.startsWith('http://') || token.startsWith('https://'))
    ) {
      url = token;
    } else if (token === '--url') {
      url = tokens[++i] || '';
    } else if (
      token === '-s' ||
      token === '--silent' ||
      token === '-S' ||
      token === '--show-error' ||
      token === '-k' ||
      token === '--insecure' ||
      token === '-L' ||
      token === '--location' ||
      token === '-i' ||
      token === '--include' ||
      token === '-v' ||
      token === '--verbose'
    ) {
      // Skip flags that don't need values
      continue;
    } else if (token === '-o' || token === '--output') {
      // Skip output file flag and its value
      i++;
    } else if (token === '-u' || token === '--user') {
      // Basic auth
      const credentials = tokens[++i];
      if (credentials) {
        const encoded = Buffer.from(credentials).toString('base64');
        headers['Authorization'] = `Basic ${encoded}`;
      }
    } else if (!token.startsWith('-') && !url) {
      // Assume it's a URL if it doesn't start with - and we don't have one yet
      url = token;
    }
  }

  return { url, method, headers, body };
}

export async function performCurlRequest(
  _context: ActionContext,
  curlCommand: string,
): Promise<CurlResponse> {
  try {
    // Validate the command starts with curl
    if (!curlCommand.trim().toLowerCase().startsWith('curl')) {
      return {
        status: 400,
        data: null,
        headers: {},
        error: 'Invalid curl command. Command must start with "curl"',
      };
    }

    // Parse the curl command
    const parsed = parseCurlCommand(curlCommand);

    if (!parsed.url) {
      return {
        status: 400,
        data: null,
        headers: {},
        error: 'Could not extract URL from curl command',
      };
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      method: parsed.method,
      headers: parsed.headers,
    };

    if (parsed.body && ['POST', 'PUT', 'PATCH'].includes(parsed.method)) {
      fetchOptions.body = parsed.body;
    }

    // Execute the request using native fetch
    const response = await fetch(parsed.url, fetchOptions);

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Get response body
    const responseText = await response.text();

    // Try to parse as JSON if it looks like JSON
    let data: any;
    const trimmed = responseText.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = responseText;
      }
    } else if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
      // XML content
      data = responseText;
    } else {
      // Plain text or other content
      data = responseText || null;
    }

    return {
      status: response.status,
      data,
      headers: responseHeaders,
    };
  } catch (error: any) {
    console.error('performCurlRequest: Error performing request', error);
    return {
      status: 500,
      data: null,
      headers: {},
      error:
        error.message || 'An error occurred while performing the curl request',
    };
  }
}
