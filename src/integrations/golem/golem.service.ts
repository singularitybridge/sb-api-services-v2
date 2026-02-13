import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';

// Types
export interface GolemSession {
  id: string;
  title?: string;
  stats?: {
    messageCount?: number;
    tokenCount?: number;
  };
  [key: string]: any;
}

export interface GolemMessage {
  role: 'user' | 'assistant';
  parts: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
  [key: string]: any;
}

export interface SendPromptResult {
  success: boolean;
  result: any;
}

/**
 * Validate that a URL is not pointing to internal/private networks (SSRF protection)
 */
function isInternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Block localhost, internal IPs, cloud metadata endpoints
    const blockedPatterns = [
      /^localhost$/i,
      /^127\./,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2\d|3[01])\./,
      /^169\.254\./, // AWS/cloud metadata
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
      /^0\.0\.0\.0$/,
    ];

    return blockedPatterns.some(p => p.test(hostname));
  } catch {
    return true; // Invalid URLs are blocked
  }
}

// Helper to get credentials
async function getCredentials(
  companyId: string,
  sandboxUrl?: string
): Promise<{ baseUrl: string; password: string }> {
  const password = await getApiKey(companyId, 'golem_server_password');

  if (!password) {
    throw new Error('Missing Golem configuration. Please configure golem_server_password.');
  }

  let baseUrl: string;

  if (sandboxUrl) {
    // Validate URL is not pointing to internal networks (SSRF protection)
    if (isInternalUrl(sandboxUrl)) {
      throw new Error('Invalid sandbox URL: internal/private network addresses are not allowed.');
    }
    baseUrl = sandboxUrl;
  } else {
    // Fall back to stored URL
    const storedUrl = await getApiKey(companyId, 'golem_server_url');
    if (!storedUrl) {
      throw new Error('Missing Golem configuration. Please provide sandboxUrl or configure golem_server_url.');
    }
    baseUrl = storedUrl;
  }

  // Remove trailing slash if present
  const cleanUrl = baseUrl.replace(/\/$/, '');

  return { baseUrl: cleanUrl, password };
}

/**
 * Clone a GitHub repository into the sandbox workspace
 * The Golem sandbox is pre-configured with GitHub credentials
 */
export async function cloneRepository(
  companyId: string,
  sessionId: string,
  repoUrl: string,
  targetDir?: string,
  branch?: string,
  sandboxUrl?: string
): Promise<SendPromptResult> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  const targetPath = targetDir || repoUrl.split('/').pop()?.replace('.git', '') || 'repo';
  let cloneCommand = `git clone ${repoUrl} ${targetPath}`;

  if (branch) {
    cloneCommand += ` -b ${branch}`;
  }

  const prompt = `Run the following commands:
1. cd /data/workspace
2. ${cloneCommand}
3. cd ${targetPath} && npm install (if package.json exists)
4. Configure git user: git config user.email "agent@singularitybridge.ai" && git config user.name "Golem Agent"

Report what was cloned and installed.`;

  try {
    const response = await axios.post(
      `${baseUrl}/session/${sessionId}/prompt_async`,
      { parts: [{ type: 'text', text: prompt }] },
      {
        auth: { username: 'golem', password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
      }
    );
    return { success: true, result: response.data };
  } catch (error: any) {
    console.error('Error cloning repository:', error.message);
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to clone repository'
    );
  }
}

/**
 * Create a new Golem session
 */
export async function createSession(
  companyId: string,
  sandboxUrl?: string
): Promise<GolemSession> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  try {
    const response = await axios.post(
      `${baseUrl}/session`,
      {},
      {
        auth: { username: 'golem', password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error creating Golem session:', error.message);
    if (error.response?.status === 502) {
      throw new Error('Golem server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to create session'
    );
  }
}

/**
 * Send a prompt to a Golem session (async)
 */
export async function sendPrompt(
  companyId: string,
  sessionId: string,
  prompt: string,
  sandboxUrl?: string
): Promise<SendPromptResult> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  try {
    const response = await axios.post(
      `${baseUrl}/session/${sessionId}/prompt_async`,
      { parts: [{ type: 'text', text: prompt }] },
      {
        auth: { username: 'golem', password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
      }
    );
    return { success: true, result: response.data };
  } catch (error: any) {
    console.error('Error sending prompt to Golem:', error.message);
    if (error.response?.status === 502) {
      throw new Error('Golem server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to send prompt'
    );
  }
}

/**
 * Get all messages from a Golem session
 */
export async function getMessages(
  companyId: string,
  sessionId: string,
  sandboxUrl?: string
): Promise<GolemMessage[]> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  try {
    const response = await axios.get(
      `${baseUrl}/session/${sessionId}/message`,
      {
        auth: { username: 'golem', password },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error fetching Golem messages:', error.message);
    if (error.response?.status === 502) {
      throw new Error('Golem server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to fetch messages'
    );
  }
}

/**
 * Get session details
 */
export async function getSession(
  companyId: string,
  sessionId: string,
  sandboxUrl?: string
): Promise<GolemSession> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  try {
    const response = await axios.get(
      `${baseUrl}/session/${sessionId}`,
      {
        auth: { username: 'golem', password },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error fetching Golem session:', error.message);
    if (error.response?.status === 502) {
      throw new Error('Golem server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to fetch session'
    );
  }
}

/**
 * List all sessions
 */
export async function listSessions(
  companyId: string,
  sandboxUrl?: string
): Promise<GolemSession[]> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  try {
    const response = await axios.get(
      `${baseUrl}/session`,
      {
        auth: { username: 'golem', password },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error listing Golem sessions:', error.message);
    if (error.response?.status === 502) {
      throw new Error('Golem server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to list sessions'
    );
  }
}

/**
 * Run/switch to a different app in the sandbox
 */
export async function runApp(
  companyId: string,
  sessionId: string,
  appDirectory: string,
  command?: string,
  sandboxUrl?: string
): Promise<SendPromptResult> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  const startCmd = command || 'npm start';

  const prompt = `Run the following commands to switch the running app:

1. cd ${appDirectory}
2. If package.json exists and node_modules doesn't, run: npm install
3. Restart the app process: pm2 restart app --update-env
4. Wait 3 seconds and check status: sleep 3 && pm2 status app

The app should start with: ${startCmd}
Report the result.`;

  try {
    const response = await axios.post(
      `${baseUrl}/session/${sessionId}/prompt_async`,
      { parts: [{ type: 'text', text: prompt }] },
      {
        auth: { username: 'golem', password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
      }
    );
    return { success: true, result: response.data };
  } catch (error: any) {
    console.error('Error running app:', error.message);
    if (error.response?.status === 502) {
      throw new Error('Golem server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to run app'
    );
  }
}

/**
 * Validate connection to Golem server (for Test Connection button)
 */
export async function validateConnection(
  apiKeys: Record<string, string>
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { golem_server_url, golem_server_password } = apiKeys || {};

  if (!golem_server_url || !golem_server_password) {
    return {
      success: false,
      error: 'Missing server URL or password',
    };
  }

  const cleanUrl = golem_server_url.replace(/\/$/, '');

  try {
    const response = await axios.get(
      `${cleanUrl}/global/health`,
      {
        auth: { username: 'golem', password: golem_server_password },
        timeout: 10000,
      }
    );

    if (response.status === 200) {
      return { success: true, message: '✓ Golem server connected' };
    }

    return { success: false, error: `✗ Golem: Unexpected response ${response.status}` };
  } catch (error: any) {
    if (error.response?.status === 502) {
      return { success: false, error: '✗ Golem: Server waking up, retry in a few seconds' };
    }
    return { success: false, error: `✗ Golem: ${error.message || 'Connection failed'}` };
  }
}
