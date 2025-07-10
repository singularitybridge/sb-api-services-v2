import { CodeSandbox } from '@codesandbox/sdk';
import { getApiKey } from '../../services/api.key.service';

const getSDK = async (companyId: string): Promise<{ success: boolean; sdk?: CodeSandbox; error?: string }> => {
  try {
    console.log('[CodeSandbox SDK] Getting API key for company:', companyId);
    const apiKey = await getApiKey(companyId, 'codesandbox_api_key');
    if (!apiKey) {
      console.log('[CodeSandbox SDK] No API key found for company:', companyId);
      return { success: false, error: 'CodeSandbox API key not found. Please configure your API key in the integration settings.' };
    }
    console.log('[CodeSandbox SDK] API key found, creating SDK');
    return { success: true, sdk: new CodeSandbox(apiKey) };
  } catch (error) {
    console.error('[CodeSandbox SDK] Failed to get CodeSandbox SDK:', error);
    return { success: false, error: `Failed to initialize CodeSandbox: ${(error as Error).message}` };
  }
};

export const createSandbox = async (companyId: string, templateId: string) => {
  try {
    const sdkResult = await getSDK(companyId);
    if (!sdkResult.success || !sdkResult.sdk) {
      return { success: false, error: sdkResult.error || 'Failed to initialize CodeSandbox SDK' };
    }
    
    const sandbox = await sdkResult.sdk.sandboxes.create({ id: templateId });
    // Add the standalone URL to the sandbox data
    const sandboxWithUrls = {
      ...sandbox,
      urls: {
        standard: `https://codesandbox.io/s/${sandbox.id}`,
        embed: `https://codesandbox.io/embed/${sandbox.id}`,
        standalone: `https://${sandbox.id}.csb.app/`,
        preview: `https://codesandbox.io/p/sandbox/${sandbox.id}`,
      }
    };
    return { success: true, data: sandboxWithUrls };
  } catch (error) {
    console.error('Failed to create sandbox:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const runCommandInSandbox = async (companyId: string, sandboxId: string, command: string) => {
  try {
    const sdkResult = await getSDK(companyId);
    if (!sdkResult.success || !sdkResult.sdk) {
      return { success: false, error: sdkResult.error || 'Failed to initialize CodeSandbox SDK' };
    }
    
    const sandbox = await sdkResult.sdk.sandboxes.resume(sandboxId);
    const client = await sandbox.connect();
    const result = await client.commands.run(command, {
      cwd: '/workspace',
    });
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to execute command:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const readFileFromSandbox = async (companyId: string, sandboxId: string, path: string) => {
  try {
    const sdkResult = await getSDK(companyId);
    if (!sdkResult.success || !sdkResult.sdk) {
      return { success: false, error: sdkResult.error || 'Failed to initialize CodeSandbox SDK' };
    }
    
    const sandbox = await sdkResult.sdk.sandboxes.resume(sandboxId);
    const client = await sandbox.connect();
    // Use cat to read file content
    const content = await client.commands.run(`cat ${path}`);
    return { success: true, data: content };
  } catch (error) {
    console.error('Failed to read file:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const writeFileToSandbox = async (companyId: string, sandboxId: string, path: string, content: string) => {
  try {
    const sdkResult = await getSDK(companyId);
    if (!sdkResult.success || !sdkResult.sdk) {
      return { success: false, error: sdkResult.error || 'Failed to initialize CodeSandbox SDK' };
    }
    
    const sandbox = await sdkResult.sdk.sandboxes.resume(sandboxId);
    const client = await sandbox.connect();
    // Use echo and redirection to write file content
    // Escape single quotes in the content to prevent shell injection issues
    const escapedContent = content.replace(/'/g, "'\\''");
    await client.commands.run(`echo '${escapedContent}' > ${path}`);
    return { success: true, message: 'File updated successfully' };
  } catch (error) {
    console.error('Failed to write file:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const listSandboxes = async (companyId: string, limit: number = 20) => {
  try {
    const sdkResult = await getSDK(companyId);
    if (!sdkResult.success || !sdkResult.sdk) {
      return { success: false, error: sdkResult.error || 'Failed to initialize CodeSandbox SDK' };
    }
    
    const response = await sdkResult.sdk.sandboxes.list({
      limit,
    });
    
    const sandboxList = response.sandboxes.map(sandbox => ({
      id: sandbox.id,
      title: sandbox.title || 'Untitled',
      createdAt: sandbox.createdAt,
      updatedAt: sandbox.updatedAt,
      publicUrl: `https://codesandbox.io/s/${sandbox.id}`,
      embedUrl: `https://codesandbox.io/embed/${sandbox.id}`,
      standaloneUrl: `https://${sandbox.id}.csb.app/`,
      privacy: sandbox.privacy,
      tags: sandbox.tags || [],
    }));
    
    return { success: true, data: sandboxList, totalCount: response.totalCount };
  } catch (error) {
    console.error('Failed to list sandboxes:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const getSandboxInfo = async (companyId: string, sandboxId: string) => {
  try {
    // This function doesn't need SDK, just returns URLs
    const sandboxInfo = {
      id: sandboxId,
      urls: {
        public: `https://codesandbox.io/s/${sandboxId}`,
        embed: `https://codesandbox.io/embed/${sandboxId}`,
        api: `https://codesandbox.io/api/v1/sandboxes/${sandboxId}`,
        editor: `https://codesandbox.io/s/${sandboxId}`,
        standalone: `https://${sandboxId}.csb.app/`,
      },
    };
    
    return { success: true, data: sandboxInfo };
  } catch (error) {
    console.error('Failed to get sandbox info:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const getSandboxUrl = async (companyId: string, sandboxId: string) => {
  try {
    // This function doesn't need SDK, just returns URLs
    const urls = {
      standard: `https://codesandbox.io/s/${sandboxId}`,
      embed: `https://codesandbox.io/embed/${sandboxId}`,
      standalone: `https://${sandboxId}.csb.app/`,
      preview: `https://codesandbox.io/p/sandbox/${sandboxId}`,
    };
    
    return { success: true, data: urls };
  } catch (error) {
    console.error('Failed to get sandbox URL:', error);
    return { success: false, error: (error as Error).message };
  }
};