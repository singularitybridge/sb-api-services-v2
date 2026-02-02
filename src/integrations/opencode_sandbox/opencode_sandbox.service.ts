import axios from 'axios';
import { getApiKey } from '../../services/api.key.service';

// Types
export interface OpenCodeSession {
  id: string;
  title?: string;
  stats?: {
    messageCount?: number;
    tokenCount?: number;
  };
  [key: string]: any;
}

export interface OpenCodeMessage {
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
// If sandboxUrl is provided, use it instead of the stored URL (for multi-sandbox support)
async function getCredentials(
  companyId: string,
  sandboxUrl?: string
): Promise<{ baseUrl: string; password: string; githubToken?: string }> {
  const password = await getApiKey(companyId, 'opencode_server_password');

  if (!password) {
    throw new Error('Missing OpenCode configuration. Please configure opencode_server_password.');
  }

  // Get optional GitHub token
  const githubToken = await getApiKey(companyId, 'github_token');

  let baseUrl: string;

  if (sandboxUrl) {
    // Validate URL is not pointing to internal networks (SSRF protection)
    if (isInternalUrl(sandboxUrl)) {
      throw new Error('Invalid sandbox URL: internal/private network addresses are not allowed.');
    }
    baseUrl = sandboxUrl;
  } else {
    // Fall back to stored URL
    const storedUrl = await getApiKey(companyId, 'opencode_server_url');
    if (!storedUrl) {
      throw new Error('Missing OpenCode configuration. Please provide sandboxUrl or configure opencode_server_url.');
    }
    baseUrl = storedUrl;
  }

  // Remove trailing slash if present
  const cleanUrl = baseUrl.replace(/\/$/, '');

  return { baseUrl: cleanUrl, password, githubToken: githubToken || undefined };
}

/**
 * Get the configured GitHub token for a company
 */
export async function getGitHubToken(companyId: string): Promise<string | null> {
  return getApiKey(companyId, 'github_token');
}

/**
 * Clone a GitHub repository using the configured token
 * Sends a prompt to the OpenCode agent to clone the repo with proper authentication
 */
export async function cloneRepository(
  companyId: string,
  sessionId: string,
  repoUrl: string,
  targetDir?: string,
  branch?: string,
  sandboxUrl?: string
): Promise<SendPromptResult> {
  const { baseUrl, password, githubToken } = await getCredentials(companyId, sandboxUrl);

  // Build clone command with token authentication if available
  let cloneCommand: string;
  const targetPath = targetDir || repoUrl.split('/').pop()?.replace('.git', '') || 'repo';

  if (githubToken && repoUrl.includes('github.com')) {
    // Use token for authentication (HTTPS with token)
    const authUrl = repoUrl.replace('https://github.com/', `https://x-access-token:${githubToken}@github.com/`);
    cloneCommand = `git clone ${authUrl} ${targetPath}`;
  } else {
    cloneCommand = `git clone ${repoUrl} ${targetPath}`;
  }

  if (branch) {
    cloneCommand += ` -b ${branch}`;
  }

  // Build the full prompt
  const prompt = `Run the following commands:
1. cd /data/workspace
2. ${cloneCommand}
3. cd ${targetPath} && npm install (if package.json exists)
4. Configure git user: git config user.email "agent@singularitybridge.ai" && git config user.name "OpenCode Agent"

Report what was cloned and installed.`;

  try {
    const response = await axios.post(
      `${baseUrl}/session/${sessionId}/prompt_async`,
      { parts: [{ type: 'text', text: prompt }] },
      {
        auth: { username: 'opencode', password },
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
 * Create a new OpenCode session
 * @param sandboxUrl - Optional URL of the sandbox (e.g., https://my-app.fly.dev). If not provided, uses stored URL.
 */
export async function createSession(
  companyId: string,
  sandboxUrl?: string
): Promise<OpenCodeSession> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  try {
    const response = await axios.post(
      `${baseUrl}/session`,
      {},
      {
        auth: { username: 'opencode', password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error creating OpenCode session:', error.message);
    if (error.response?.status === 502) {
      throw new Error('OpenCode server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to create session'
    );
  }
}

/**
 * Send a prompt to an OpenCode session (async - recommended)
 * @param sandboxUrl - Optional URL of the sandbox (e.g., https://my-app.fly.dev). If not provided, uses stored URL.
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
        auth: { username: 'opencode', password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
      }
    );
    return { success: true, result: response.data };
  } catch (error: any) {
    console.error('Error sending prompt to OpenCode:', error.message);
    if (error.response?.status === 502) {
      throw new Error('OpenCode server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to send prompt'
    );
  }
}

/**
 * Get all messages from an OpenCode session
 * @param sandboxUrl - Optional URL of the sandbox (e.g., https://my-app.fly.dev). If not provided, uses stored URL.
 */
export async function getMessages(
  companyId: string,
  sessionId: string,
  sandboxUrl?: string
): Promise<OpenCodeMessage[]> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  try {
    const response = await axios.get(
      `${baseUrl}/session/${sessionId}/message`,
      {
        auth: { username: 'opencode', password },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error fetching OpenCode messages:', error.message);
    if (error.response?.status === 502) {
      throw new Error('OpenCode server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to fetch messages'
    );
  }
}

/**
 * Get session details
 * @param sandboxUrl - Optional URL of the sandbox (e.g., https://my-app.fly.dev). If not provided, uses stored URL.
 */
export async function getSession(
  companyId: string,
  sessionId: string,
  sandboxUrl?: string
): Promise<OpenCodeSession> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  try {
    const response = await axios.get(
      `${baseUrl}/session/${sessionId}`,
      {
        auth: { username: 'opencode', password },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error fetching OpenCode session:', error.message);
    if (error.response?.status === 502) {
      throw new Error('OpenCode server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to fetch session'
    );
  }
}

/**
 * List all sessions
 * @param sandboxUrl - Optional URL of the sandbox (e.g., https://my-app.fly.dev). If not provided, uses stored URL.
 */
export async function listSessions(
  companyId: string,
  sandboxUrl?: string
): Promise<OpenCodeSession[]> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  try {
    const response = await axios.get(
      `${baseUrl}/session`,
      {
        auth: { username: 'opencode', password },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Error listing OpenCode sessions:', error.message);
    if (error.response?.status === 502) {
      throw new Error('OpenCode server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to list sessions'
    );
  }
}

/**
 * Validate GitHub token by calling the GitHub API
 */
async function validateGitHubToken(
  token: string
): Promise<{ valid: boolean; username?: string; scopes?: string; error?: string }> {
  try {
    const response = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: 10000,
    });

    if (response.status === 200) {
      const scopes = response.headers['x-oauth-scopes'] || 'fine-grained (no scopes header)';
      return {
        valid: true,
        username: response.data.login,
        scopes,
      };
    }

    return { valid: false, error: `Unexpected response: ${response.status}` };
  } catch (error: any) {
    if (error.response?.status === 401) {
      return { valid: false, error: 'Invalid or expired GitHub token' };
    }
    if (error.response?.status === 403) {
      return { valid: false, error: 'GitHub token lacks required permissions' };
    }
    return { valid: false, error: error.message || 'Failed to validate GitHub token' };
  }
}

/**
 * Run/switch to a different app in the sandbox
 * Updates /data/active-app.json and restarts the app process via supervisord
 */
export async function runApp(
  companyId: string,
  sessionId: string,
  appDirectory: string,
  command?: string,
  sandboxUrl?: string
): Promise<SendPromptResult> {
  const { baseUrl, password } = await getCredentials(companyId, sandboxUrl);

  // Build the app config JSON
  const appConfig = {
    directory: appDirectory,
    command: command || 'npm start',
  };

  // Build the prompt to update config and restart
  const prompt = `Run the following commands to switch the running app:

1. Update the app config:
   echo '${JSON.stringify(appConfig)}' > /data/active-app.json

2. Restart the app process:
   supervisorctl -c /etc/supervisor/conf.d/supervisord.conf restart app

3. Wait 3 seconds and check the app is running:
   sleep 3 && supervisorctl -c /etc/supervisor/conf.d/supervisord.conf status app

Report the result.`;

  try {
    const response = await axios.post(
      `${baseUrl}/session/${sessionId}/prompt_async`,
      { parts: [{ type: 'text', text: prompt }] },
      {
        auth: { username: 'opencode', password },
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
      }
    );
    return { success: true, result: response.data };
  } catch (error: any) {
    console.error('Error running app:', error.message);
    if (error.response?.status === 502) {
      throw new Error('OpenCode server is waking up. Please retry in a few seconds.');
    }
    throw new Error(
      error.response?.data?.error || error.message || 'Failed to run app'
    );
  }
}

/**
 * Validate connection to OpenCode server and optionally GitHub (for Test Connection button)
 */
export async function validateConnection(
  apiKeys: Record<string, string>
): Promise<{ success: boolean; message?: string; error?: string }> {
  const { opencode_server_url, opencode_server_password, github_token } = apiKeys || {};

  if (!opencode_server_url || !opencode_server_password) {
    return {
      success: false,
      error: 'Missing server URL or password',
    };
  }

  const cleanUrl = opencode_server_url.replace(/\/$/, '');
  const results: string[] = [];
  let hasError = false;

  // Test OpenCode connection
  try {
    const response = await axios.get(
      `${cleanUrl}/global/health`,
      {
        auth: { username: 'opencode', password: opencode_server_password },
        timeout: 10000,
      }
    );

    if (response.status === 200) {
      results.push('✓ OpenCode server connected');
    } else {
      results.push(`✗ OpenCode: Unexpected response ${response.status}`);
      hasError = true;
    }
  } catch (error: any) {
    if (error.response?.status === 502) {
      results.push('✗ OpenCode: Server waking up, retry in a few seconds');
    } else {
      results.push(`✗ OpenCode: ${error.message || 'Connection failed'}`);
    }
    hasError = true;
  }

  // Test GitHub token if provided
  if (github_token) {
    const ghResult = await validateGitHubToken(github_token);
    if (ghResult.valid) {
      results.push(`✓ GitHub authenticated as @${ghResult.username}`);
    } else {
      results.push(`✗ GitHub: ${ghResult.error}`);
      hasError = true;
    }
  } else {
    results.push('○ GitHub token not configured (optional)');
  }

  if (hasError) {
    return {
      success: false,
      error: results.join('\n'),
    };
  }

  return {
    success: true,
    message: results.join('\n'),
  };
}
