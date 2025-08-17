import { CodeSandbox } from '@codesandbox/sdk';
import { getApiKey } from '../../services/api.key.service';
import { shellEscape } from './utils';

const getSDK = async (
  companyId: string,
): Promise<{ success: boolean; sdk?: CodeSandbox; error?: string }> => {
  try {
    console.log('[CodeSandbox SDK] Getting API key for company:', companyId);
    const apiKey = await getApiKey(companyId, 'codesandbox_api_key');
    if (!apiKey) {
      console.log('[CodeSandbox SDK] No API key found for company:', companyId);
      return {
        success: false,
        error:
          'CodeSandbox API key not found. Please configure your API key in the integration settings.',
      };
    }
    console.log('[CodeSandbox SDK] API key found, creating SDK');
    return { success: true, sdk: new CodeSandbox(apiKey) };
  } catch (error) {
    console.error('[CodeSandbox SDK] Failed to get CodeSandbox SDK:', error);
    return {
      success: false,
      error: `Failed to initialize CodeSandbox: ${(error as Error).message}`,
    };
  }
};

export const createSandbox = async (companyId: string, templateId: string) => {
  try {
    const sdkResult = await getSDK(companyId);
    if (!sdkResult.success || !sdkResult.sdk) {
      return {
        success: false,
        error: sdkResult.error || 'Failed to initialize CodeSandbox SDK',
      };
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
      },
    };
    return { success: true, data: sandboxWithUrls };
  } catch (error) {
    console.error('Failed to create sandbox:', error);
    return { success: false, error: (error as Error).message };
  }
};

export const runCommandInSandbox = async (
  companyId: string,
  sandboxId: string,
  command: string,
) => {
  const sdkResult = await getSDK(companyId);
  if (!sdkResult.success || !sdkResult.sdk) {
    return {
      success: false,
      error: sdkResult.error || 'Failed to initialize SDK',
    };
  }

  try {
    const sandbox = await sdkResult.sdk.sandboxes.resume(sandboxId);
    const client = await sandbox.connect();

    // Determine if this is a long-running command
    // Temporarily disable background execution for git clone to debug
    const longRunningCommands = [
      'npm install',
      'yarn install',
      'npm run',
      'yarn run',
    ];
    const isLongRunning = longRunningCommands.some((cmd) =>
      command.includes(cmd),
    );

    if (isLongRunning) {
      console.log(
        `[CodeSandbox] Running long command in background: ${command}`,
      );

      // Use runBackground for long operations
      const bgCommand = await client.commands.runBackground(command);
      console.log(
        `[CodeSandbox] Background command started, type:`,
        typeof bgCommand,
      );

      // Check if bgCommand has the expected methods
      if (!bgCommand || typeof bgCommand.waitUntilComplete !== 'function') {
        console.error(
          `[CodeSandbox] Invalid background command object:`,
          bgCommand,
        );
        throw new Error(
          'Failed to start background command - invalid command object',
        );
      }

      // Collect output
      let output = '';
      let errorOutput = '';

      const outputDisposer = bgCommand.onOutput((data: any) => {
        if (data.type === 'stdout') {
          output += data.data;
          console.log(`[CodeSandbox] stdout:`, data.data.substring(0, 100));
        } else if (data.type === 'stderr') {
          errorOutput += data.data;
          console.log(`[CodeSandbox] stderr:`, data.data.substring(0, 100));
        }
      });

      try {
        console.log(`[CodeSandbox] Waiting for command completion...`);
        // Wait for completion with a timeout (5 minutes for git clone)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Command timeout after 5 minutes')),
            300000,
          ),
        );

        const result = await Promise.race([
          bgCommand.waitUntilComplete(),
          timeoutPromise,
        ]);

        console.log(`[CodeSandbox] Command completed with result:`, result);
        outputDisposer.dispose();

        return {
          success: (result as any).exitCode === 0,
          data: {
            stdout: output,
            stderr: errorOutput,
            exitCode: (result as any).exitCode,
            output: output || errorOutput || 'Command completed',
          },
        };
      } catch (error) {
        outputDisposer.dispose();
        console.error(`[CodeSandbox] Background command error:`, error);
        // Return partial output even on error
        return {
          success: false,
          error: (error as Error).message,
          details: errorOutput || output || 'Command failed or timed out',
        };
      }
    } else {
      // For short commands, use regular run with stderr redirect
      console.log(`[CodeSandbox] Running command: ${command}`);
      const modifiedCommand = command.includes('2>&1')
        ? command
        : `${command} 2>&1`;

      try {
        const result = await client.commands.run(modifiedCommand);
        console.log(`[CodeSandbox] Command result:`, result);

        // Check if result is a string or object
        if (typeof result === 'string') {
          return {
            success: true,
            data: {
              stdout: result,
              output: result,
            },
          };
        } else {
          return {
            success: true,
            data: result,
          };
        }
      } catch (cmdError) {
        console.error(`[CodeSandbox] Command error:`, cmdError);
        return {
          success: false,
          error: (cmdError as Error).message,
          details:
            (cmdError as any).stderr ||
            (cmdError as any).output ||
            'Command failed',
        };
      }
    }
  } catch (error) {
    console.error('Failed to execute command:', error);
    return {
      success: false,
      error: (error as Error).message,
      details: (error as any).stderr || (error as any).output,
    };
  }
};

export const readFileFromSandbox = async (
  companyId: string,
  sandboxId: string,
  path: string,
) => {
  const sdkResult = await getSDK(companyId);
  if (!sdkResult.success || !sdkResult.sdk) {
    return {
      success: false,
      error: sdkResult.error || 'Failed to initialize SDK',
    };
  }

  try {
    const sandbox = await sdkResult.sdk.sandboxes.resume(sandboxId);
    const client = await sandbox.connect();

    // Use FileSystem API instead of cat command
    const content = await client.fs.readTextFile(path);

    return { success: true, data: content };
  } catch (error) {
    // Try to read as binary if text fails
    try {
      const sandbox = await sdkResult.sdk.sandboxes.resume(sandboxId);
      const client = await sandbox.connect();
      const binaryContent = await client.fs.readFile(path);

      // Convert Uint8Array to string
      const decoder = new TextDecoder();
      const content = decoder.decode(binaryContent);

      return { success: true, data: content };
    } catch (binaryError) {
      console.error('Failed to read file:', error);
      return {
        success: false,
        error: `File not found or cannot be read: ${path}`,
      };
    }
  }
};

export const writeFileToSandbox = async (
  companyId: string,
  sandboxId: string,
  path: string,
  content: string,
) => {
  const sdkResult = await getSDK(companyId);
  if (!sdkResult.success || !sdkResult.sdk) {
    return {
      success: false,
      error: sdkResult.error || 'Failed to initialize SDK',
    };
  }

  try {
    const sandbox = await sdkResult.sdk.sandboxes.resume(sandboxId);
    const client = await sandbox.connect();

    // Ensure directory exists
    const dir = path.substring(0, path.lastIndexOf('/'));
    if (dir) {
      try {
        await client.fs.mkdir(dir, true);
      } catch (e) {
        // Directory might already exist, that's ok
      }
    }

    // Use FileSystem API instead of echo command
    await client.fs.writeTextFile(path, content);

    return {
      success: true,
      message: 'File written successfully',
      data: { path },
    };
  } catch (error) {
    console.error('Failed to write file:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export const listSandboxes = async (companyId: string, limit: number = 20) => {
  try {
    const sdkResult = await getSDK(companyId);
    if (!sdkResult.success || !sdkResult.sdk) {
      return {
        success: false,
        error: sdkResult.error || 'Failed to initialize CodeSandbox SDK',
      };
    }

    const response = await sdkResult.sdk.sandboxes.list({
      limit,
    });

    const sandboxList = response.sandboxes.map((sandbox) => ({
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

    return {
      success: true,
      data: sandboxList,
      totalCount: response.totalCount,
    };
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

export const deleteFile = async (
  companyId: string,
  sandboxId: string,
  path: string,
) => {
  const sdkResult = await getSDK(companyId);
  if (!sdkResult.success || !sdkResult.sdk) {
    return {
      success: false,
      error: sdkResult.error || 'Failed to initialize SDK',
    };
  }

  try {
    const sandbox = await sdkResult.sdk.sandboxes.resume(sandboxId);
    const client = await sandbox.connect();

    await client.fs.remove(path);

    return {
      success: true,
      message: 'File or directory deleted successfully',
    };
  } catch (error) {
    console.error('Failed to delete file:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};

export const listDirectory = async (
  companyId: string,
  sandboxId: string,
  path: string = '.',
) => {
  const sdkResult = await getSDK(companyId);
  if (!sdkResult.success || !sdkResult.sdk) {
    return {
      success: false,
      error: sdkResult.error || 'Failed to initialize SDK',
    };
  }

  try {
    const sandbox = await sdkResult.sdk.sandboxes.resume(sandboxId);
    const client = await sandbox.connect();

    const files = await client.fs.readdir(path);

    return {
      success: true,
      data: files,
    };
  } catch (error) {
    console.error('Failed to list directory:', error);
    return {
      success: false,
      error: (error as Error).message,
    };
  }
};
