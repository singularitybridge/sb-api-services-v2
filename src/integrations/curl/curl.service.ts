import { ActionContext } from '../actions/types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CurlResponse {
  status: number;
  data: any;
  headers: Record<string, string>;
}

const normalizeCurlCommand = (command: string): string => {
  // Split into lines and trim each line
  const lines = command.split('\n').map(line => line.trim());
  
  // Process each line and remove trailing backslashes
  const processedLines = lines.map(line => 
    line.endsWith('\\') ? line.slice(0, -1).trim() : line
  );

  // Join all lines with spaces and add write-out for status code
  return `${processedLines.join(' ')} -w "\nSTATUS_CODE:%{http_code}"`;
};

export async function performCurlRequest(
  context: ActionContext,
  curlCommand: string
): Promise<CurlResponse> {
  try {
    // Validate and normalize the command
    if (!curlCommand.trim().toLowerCase().startsWith('curl')) {
      throw new Error('Invalid curl command. Command must start with "curl"');
    }
    const normalizedCommand = normalizeCurlCommand(curlCommand);

    // Execute the curl command
    const { stdout } = await execAsync(normalizedCommand);
    const response = stdout.toString();

    // Extract status code using our marker
    const statusMatch = response.match(/\nSTATUS_CODE:(\d+)$/);
    if (!statusMatch) {
      throw new Error('Could not extract status code from response');
    }

    // Get response body (everything before our status code marker)
    const responseBody = response.slice(0, response.lastIndexOf('\nSTATUS_CODE:')).trim();
    const status = parseInt(statusMatch[1], 10);

    // Try to parse response body based on content
    let data: any;
    if (responseBody.trim().startsWith('{')) {
      // Attempt JSON parse
      try {
        data = JSON.parse(responseBody);
      } catch {
        data = responseBody;
      }
    } else if (responseBody.trim().startsWith('<?xml') || responseBody.trim().startsWith('<')) {
      // XML content
      data = responseBody;
    } else {
      // Plain text or other content
      data = responseBody || null;
    }

    return { status, data, headers: {} };
  } catch (error: any) {
    console.error('performCurlRequest: Error performing request', error);
    throw error;
  }
}
